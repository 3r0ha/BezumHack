import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { publishNotification } from "../index";

export const meetingsRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

function getUserId(req: Request): string {
  return (req as any).user?.userId || "";
}

// GET /project/:projectId — list meetings for project
meetingsRouter.get("/project/:projectId", asyncHandler(async (req, res) => {
  const meetings = await prisma.meeting.findMany({
    where: { projectId: req.params.projectId },
    include: {
      slots: { orderBy: { startTime: "asc" } },
      documents: { include: { document: { select: { id: true, title: true, status: true } } } },
      epoch: { select: { id: true, title: true } },
      task: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(meetings);
}));

// POST / — create meeting (can start in SCHEDULING mode with proposed slots)
meetingsRouter.post("/", asyncHandler(async (req, res) => {
  const { title, projectId, epochId, taskId, participants, slots, scheduledAt, duration, documentIds } = req.body;
  if (!title || !projectId) {
    res.status(400).json({ error: "title and projectId are required" });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const organizerId = getUserId(req);

  // If scheduledAt is provided directly → SCHEDULED, otherwise → SCHEDULING (waiting for slot votes)
  const status = scheduledAt ? "SCHEDULED" : (slots && slots.length > 0 ? "SCHEDULING" : "SCHEDULED");

  const meeting = await prisma.meeting.create({
    data: {
      title,
      projectId,
      epochId: epochId || null,
      taskId: taskId || null,
      organizerId,
      status: status as any,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      duration: duration || null,
      participants: participants || [organizerId],
      slots: slots && slots.length > 0
        ? {
            create: (slots as Array<{ startTime: string; endTime: string }>).map(s => ({
              startTime: new Date(s.startTime),
              endTime: new Date(s.endTime),
              votes: [organizerId],
            })),
          }
        : undefined,
      documents: documentIds && documentIds.length > 0
        ? { create: (documentIds as string[]).map((did: string) => ({ documentId: did })) }
        : undefined,
    },
    include: {
      slots: { orderBy: { startTime: "asc" } },
      documents: { include: { document: { select: { id: true, title: true } } } },
      epoch: { select: { id: true, title: true } },
      task: { select: { id: true, title: true, status: true } },
    },
  });

  // Notify all participants about meeting invitation
  for (const uid of (participants || [])) {
    if (uid !== organizerId) {
      publishNotification(req.app, {
        userId: uid,
        type: "MEETING_INVITED",
        title: status === "SCHEDULING" ? "Приглашение на согласование встречи" : "Новая встреча запланирована",
        body: status === "SCHEDULING"
          ? `Выберите удобное время для встречи «${title}»`
          : `Встреча «${title}» запланирована`,
        link: `/meetings/${meeting.id}`,
        priority: "HIGH",
      });
    }
  }

  res.status(201).json(meeting);
}));

// GET /:id — get meeting details
meetingsRouter.get("/:id", asyncHandler(async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { id: req.params.id },
    include: {
      slots: { orderBy: { startTime: "asc" } },
      documents: {
        include: {
          document: {
            select: { id: true, title: true, status: true, visibility: true },
          },
        },
      },
      epoch: { select: { id: true, title: true } },
      task: { select: { id: true, title: true, status: true, priority: true } },
    },
  });
  if (!meeting) { res.status(404).json({ error: "Meeting not found" }); return; }
  res.json(meeting);
}));

// POST /:id/vote — vote for a time slot (bidirectional slot agreement)
meetingsRouter.post("/:id/vote", asyncHandler(async (req, res) => {
  const { slotId } = req.body;
  if (!slotId) { res.status(400).json({ error: "slotId is required" }); return; }

  const userId = getUserId(req);

  const meeting = await prisma.meeting.findUnique({
    where: { id: req.params.id },
    include: { slots: true },
  });
  if (!meeting) { res.status(404).json({ error: "Meeting not found" }); return; }
  if (meeting.status !== "SCHEDULING") {
    res.status(400).json({ error: "Meeting is not in SCHEDULING status" }); return;
  }

  const slot = meeting.slots.find(s => s.id === slotId);
  if (!slot) { res.status(404).json({ error: "Slot not found" }); return; }

  // Add vote if not already voted
  const votes = slot.votes.includes(userId) ? slot.votes : [...slot.votes, userId];
  await prisma.meetingSlot.update({ where: { id: slotId }, data: { votes } });

  // Check if all participants voted for this slot
  const allParticipants = meeting.participants;
  const updatedSlots = await prisma.meetingSlot.findMany({ where: { meetingId: meeting.id } });

  // Auto-finalize: find earliest slot where all participants voted
  const winnerSlot = updatedSlots
    .filter(s => allParticipants.every(uid => s.votes.includes(uid)))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

  if (winnerSlot) {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "SCHEDULED",
        scheduledAt: winnerSlot.startTime,
        duration: Math.round((winnerSlot.endTime.getTime() - winnerSlot.startTime.getTime()) / 60000),
      },
    });

    // Notify all participants that a time was agreed
    for (const uid of allParticipants) {
      publishNotification(req.app, {
        userId: uid,
        type: "MEETING_SCHEDULED",
        title: "Встреча согласована",
        body: `Встреча «${meeting.title}» запланирована на ${winnerSlot.startTime.toLocaleString("ru")}`,
        link: `/meetings/${meeting.id}`,
        priority: "HIGH",
      });
    }
  }

  const updatedMeeting = await prisma.meeting.findUnique({
    where: { id: meeting.id },
    include: { slots: { orderBy: { startTime: "asc" } } },
  });
  res.json(updatedMeeting);
}));

// PATCH /:id — update meeting (status, recording, transcription, summary, etc.)
meetingsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { status, scheduledAt, duration, recordingUrl, transcription, summary, nextcloudRoomId } = req.body;

  const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: "Meeting not found" }); return; }

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (scheduledAt !== undefined) data.scheduledAt = new Date(scheduledAt);
  if (duration !== undefined) data.duration = duration;
  if (recordingUrl !== undefined) data.recordingUrl = recordingUrl;
  if (transcription !== undefined) data.transcription = transcription;
  if (summary !== undefined) data.summary = summary;
  if (nextcloudRoomId !== undefined) data.nextcloudRoomId = nextcloudRoomId;

  const meeting = await prisma.meeting.update({
    where: { id: req.params.id },
    data,
    include: {
      slots: true,
      documents: { include: { document: { select: { id: true, title: true } } } },
      task: { select: { id: true, title: true } },
    },
  });

  // When meeting is COMPLETED with summary → notify participants
  if (status === "COMPLETED" && summary) {
    for (const uid of meeting.participants) {
      publishNotification(req.app, {
        userId: uid,
        type: "MEETING_SUMMARY_READY",
        title: "Суммаризация встречи готова",
        body: `Итоги встречи «${meeting.title}» доступны`,
        link: `/meetings/${meeting.id}`,
      });
    }
  }

  res.json(meeting);
}));

// POST /:id/documents — attach document to meeting
meetingsRouter.post("/:id/documents", asyncHandler(async (req, res) => {
  const { documentId } = req.body;
  if (!documentId) { res.status(400).json({ error: "documentId is required" }); return; }

  const md = await prisma.meetingDocument.upsert({
    where: { meetingId_documentId: { meetingId: req.params.id, documentId } },
    create: { meetingId: req.params.id, documentId },
    update: {},
    include: { document: { select: { id: true, title: true } } },
  });
  res.status(201).json(md);
}));

// DELETE /:id/documents/:documentId — detach document
meetingsRouter.delete("/:id/documents/:documentId", asyncHandler(async (req, res) => {
  await prisma.meetingDocument.deleteMany({
    where: { meetingId: req.params.id, documentId: req.params.documentId },
  });
  res.status(204).send();
}));

// POST /:id/summarize — trigger AI summarization of transcription
meetingsRouter.post("/:id/summarize", asyncHandler(async (req, res) => {
  const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!meeting) { res.status(404).json({ error: "Meeting not found" }); return; }

  if (!meeting.transcription) {
    res.status(400).json({ error: "No transcription available to summarize" }); return;
  }

  // Call AI service
  try {
    const aiUrl = process.env.AI_SERVICE_URL || "http://ai:3004";
    const aiRes = await fetch(`${aiUrl}/summarize/meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: meeting.transcription, meeting_title: meeting.title }),
    });

    if (!aiRes.ok) throw new Error("AI service error");

    const aiData = await aiRes.json() as { summary: string; action_items: string[] };

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { summary: aiData.summary },
    });

    // Notify participants
    for (const uid of meeting.participants) {
      publishNotification(req.app, {
        userId: uid,
        type: "MEETING_SUMMARY_READY",
        title: "Суммаризация встречи готова",
        body: `AI сформировал итоги встречи «${meeting.title}»`,
        link: `/meetings/${meeting.id}`,
      });
    }

    res.json({ meeting: updated, actionItems: aiData.action_items });
  } catch (err) {
    // Fallback mock summary
    const mockSummary = `[Автосуммаризация] Встреча «${meeting.title}» завершена. На встрече обсуждались ключевые вопросы по проекту. Требуется дальнейшее следование принятым решениям.`;
    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { summary: mockSummary },
    });
    res.json({ meeting: updated, actionItems: [], mock: true });
  }
}));

// DELETE /:id
meetingsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: "Meeting not found" }); return; }
  await prisma.meeting.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

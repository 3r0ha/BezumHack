import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { createTaskSchema, updateTaskSchema } from "../validators";

export const tasksRouter = Router();

// Async handler wrapper to catch errors and forward to error middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// GET /project/:projectId — list tasks for project
tasksRouter.get("/project/:projectId", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.projectId },
    include: {
      blockedBy: { include: { blockingTask: true } },
      blocks: { include: { blockedTask: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(tasks);
}));

// POST / — create task
tasksRouter.post("/", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createTaskSchema.parse(req.body);
  const { title, description, priority, projectId, assigneeId, estimatedHours, dueDate, dependsOn } = parsed;

  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      priority,
      projectId,
      assigneeId,
      estimatedHours,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      ...(dependsOn && dependsOn.length > 0
        ? {
            blockedBy: {
              create: (dependsOn as string[]).map((blockingTaskId: string) => ({
                blockingTaskId,
              })),
            },
          }
        : {}),
    },
    include: {
      blockedBy: { include: { blockingTask: true } },
      blocks: { include: { blockedTask: true } },
    },
  });

  res.status(201).json(task);
}));

// PATCH /:id — update task (including status transitions)
tasksRouter.patch("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = updateTaskSchema.parse(req.body);
  const { title, description, status, priority, assigneeId, estimatedHours, dueDate } = parsed;

  const existing = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      blockedBy: { include: { blockingTask: true } },
    },
  });

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // If transitioning to IN_PROGRESS or beyond, check that blocking tasks are DONE
  if (status && status !== "BACKLOG" && status !== "TODO") {
    const unresolvedBlockers = existing.blockedBy.filter(
      (dep) => dep.blockingTask.status !== "DONE"
    );

    if (unresolvedBlockers.length > 0) {
      res.status(400).json({
        error: "Cannot advance task — unresolved blocking dependencies",
        blockers: unresolvedBlockers.map((dep) => ({
          id: dep.blockingTask.id,
          title: dep.blockingTask.title,
          status: dep.blockingTask.status,
        })),
      });
      return;
    }
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (priority !== undefined) data.priority = priority;
  if (assigneeId !== undefined) data.assigneeId = assigneeId;
  if (estimatedHours !== undefined) data.estimatedHours = estimatedHours;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data,
    include: {
      blockedBy: { include: { blockingTask: true } },
      blocks: { include: { blockedTask: true } },
    },
  });

  res.json(task);
}));

// DELETE /:id — delete task
tasksRouter.delete("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await prisma.task.delete({ where: { id: req.params.id } });

  res.status(204).send();
}));

// POST /:id/dependencies — add dependency {blockingTaskId}
tasksRouter.post("/:id/dependencies", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { blockingTaskId } = req.body;
  const blockedTaskId = req.params.id;

  if (!blockingTaskId) {
    res.status(400).json({ error: "blockingTaskId is required" });
    return;
  }

  if (blockedTaskId === blockingTaskId) {
    res.status(400).json({ error: "A task cannot depend on itself" });
    return;
  }

  // Verify both tasks exist
  const [blockedTask, blockingTask] = await Promise.all([
    prisma.task.findUnique({ where: { id: blockedTaskId } }),
    prisma.task.findUnique({ where: { id: blockingTaskId } }),
  ]);

  if (!blockedTask) {
    res.status(404).json({ error: "Blocked task not found" });
    return;
  }
  if (!blockingTask) {
    res.status(404).json({ error: "Blocking task not found" });
    return;
  }

  // Check for circular dependency: would adding this edge create a cycle?
  const wouldCreateCycle = await detectCycle(blockingTaskId, blockedTaskId);
  if (wouldCreateCycle) {
    res.status(400).json({ error: "Adding this dependency would create a circular dependency" });
    return;
  }

  const dependency = await prisma.taskDependency.create({
    data: { blockedTaskId, blockingTaskId },
    include: {
      blockedTask: true,
      blockingTask: true,
    },
  });

  res.status(201).json(dependency);
}));

// DELETE /:id/dependencies/:depId — remove dependency
tasksRouter.delete("/:id/dependencies/:depId", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.taskDependency.findUnique({
    where: { id: req.params.depId },
  });

  if (!existing) {
    res.status(404).json({ error: "Dependency not found" });
    return;
  }

  await prisma.taskDependency.delete({ where: { id: req.params.depId } });

  res.status(204).send();
}));

// GET /:id/dependency-graph — return task with all transitive dependencies (detect circular deps)
tasksRouter.get("/:id/dependency-graph", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const visited = new Set<string>();
  const graph: Record<string, string[]> = {};
  let hasCycle = false;

  async function traverseDependencies(taskId: string, ancestors: Set<string>): Promise<void> {
    if (ancestors.has(taskId)) {
      hasCycle = true;
      return;
    }

    if (visited.has(taskId)) {
      return;
    }

    visited.add(taskId);
    ancestors.add(taskId);

    const dependencies = await prisma.taskDependency.findMany({
      where: { blockedTaskId: taskId },
      include: { blockingTask: true },
    });

    graph[taskId] = dependencies.map((dep) => dep.blockingTaskId);

    for (const dep of dependencies) {
      await traverseDependencies(dep.blockingTaskId, new Set(ancestors));
    }

    ancestors.delete(taskId);
  }

  await traverseDependencies(req.params.id, new Set());

  // Collect all tasks in the graph
  const allTaskIds = Array.from(visited);
  const allTasks = await prisma.task.findMany({
    where: { id: { in: allTaskIds } },
  });

  const taskMap = Object.fromEntries(allTasks.map((t) => [t.id, t]));

  res.json({
    taskId: req.params.id,
    hasCycle,
    graph,
    tasks: taskMap,
    totalDependencies: allTaskIds.length - 1, // exclude the root task itself
  });
}));

/**
 * Detect if adding an edge from `fromTaskId` -> `toTaskId` (meaning toTaskId blocks fromTaskId)
 * would create a cycle. We check if `toTaskId` can already reach `fromTaskId` through existing
 * "blockedBy" edges. If so, adding fromTaskId being blocked by toTaskId would form a cycle.
 *
 * Actually, we want to check: does `blockedTaskId` transitively block `blockingTaskId`?
 * i.e., can we reach from blockingTaskId back to blockedTaskId via "blockedBy" edges?
 * If blockingTaskId is (transitively) blocked by blockedTaskId, then making blockedTaskId
 * also blocked by blockingTaskId creates a cycle.
 */
async function detectCycle(startTaskId: string, targetTaskId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue: string[] = [startTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === targetTaskId) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const deps = await prisma.taskDependency.findMany({
      where: { blockedTaskId: current },
    });

    for (const dep of deps) {
      if (!visited.has(dep.blockingTaskId)) {
        queue.push(dep.blockingTaskId);
      }
    }
  }

  return false;
}

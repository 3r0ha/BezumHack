import logging
from fastapi import APIRouter, Request
from pydantic import BaseModel

from src.ai_client import complete, is_configured, parse_json_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/summarize", tags=["meetings"])

MEETING_SYSTEM_PROMPT = (
    "Ты — ассистент по управлению проектами. Тебе дана транскрипция рабочей встречи. "
    "Твоя задача:\n"
    "1) Написать краткое резюме встречи (3-5 предложений)\n"
    "2) Выделить конкретные принятые решения\n"
    "3) Составить список action items (кто, что, когда)\n"
    "4) Отметить открытые вопросы\n\n"
    "Ответ строго в формате JSON:\n"
    "{\n"
    '  "summary": "Краткое резюме встречи",\n'
    '  "decisions": ["Решение 1", "Решение 2"],\n'
    '  "action_items": [\n'
    '    {"owner": "Имя или роль", "action": "Что нужно сделать", "deadline": "Срок или null"}\n'
    "  ],\n"
    '  "open_questions": ["Вопрос 1"]\n'
    "}"
)


class MeetingSummarizeRequest(BaseModel):
    text: str
    meeting_title: str = ""


class ActionItem(BaseModel):
    owner: str
    action: str
    deadline: str | None = None


class MeetingSummarizeResponse(BaseModel):
    summary: str
    decisions: list[str]
    action_items: list[ActionItem]
    open_questions: list[str]
    mock: bool = False


def _mock_response(title: str) -> MeetingSummarizeResponse:
    return MeetingSummarizeResponse(
        summary=f"[MOCK] Встреча «{title}» прошла в рабочем режиме. Команда обсудила текущий статус задач и приоритеты на следующий период.",
        decisions=[
            "[MOCK] Принято решение о приоритизации задач текущей эпохи",
            "[MOCK] Согласованы сроки следующего релиза",
        ],
        action_items=[
            ActionItem(owner="Менеджер", action="[MOCK] Обновить статус задач в Kanban", deadline="До конца дня"),
            ActionItem(owner="Разработчик", action="[MOCK] Создать MR для текущей задачи", deadline=None),
        ],
        open_questions=["[MOCK] Уточнить требования у заказчика"],
        mock=True,
    )


@router.post("/meeting", response_model=MeetingSummarizeResponse)
async def summarize_meeting(request: Request, body: MeetingSummarizeRequest):
    """Summarize a meeting transcription and extract action items."""
    if not is_configured():
        logger.info("AI not configured — returning mock meeting summary")
        return _mock_response(body.meeting_title)

    user_msg = f"Встреча: {body.meeting_title}\n\nТранскрипция:\n{body.text}"

    try:
        raw = await complete(MEETING_SYSTEM_PROMPT, user_msg, max_tokens=2048, temperature=0.3)
        parsed = parse_json_response(raw)

        return MeetingSummarizeResponse(
            summary=parsed.get("summary", ""),
            decisions=parsed.get("decisions", []),
            action_items=[
                ActionItem(**item) for item in parsed.get("action_items", [])
            ],
            open_questions=parsed.get("open_questions", []),
            mock=False,
        )
    except Exception as e:
        logger.error(f"Meeting summarization failed: {e}")
        return _mock_response(body.meeting_title)

import os
import logging

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/summarize", tags=["summarize"])

AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")

SYSTEM_PROMPT = (
    "Ты — опытный технический аналитик. Тебе дано техническое задание (ТЗ). "
    "Сделай краткое резюме для разработчика, выделив: "
    "1) ключевые требования, "
    "2) технологический стек, "
    "3) сроки и дедлайны, "
    "4) возможные риски. "
    "Ответ дай в формате: сначала общее резюме (краткий абзац), затем список ключевых пунктов. "
    "Каждый ключевой пункт — одно предложение."
)

TASKS_SYSTEM_PROMPT = (
    "Ты — опытный менеджер проектов и техлид. "
    "Тебе дан список задач с названиями и описаниями. "
    "Проанализируй их и предложи декомпозицию: разбей каждую задачу на подзадачи, "
    "укажи зависимости между задачами и приоритеты. "
    "Ответ дай в формате JSON:\n"
    "{\n"
    '  "summary": "Общий обзор проекта",\n'
    '  "task_breakdown": [\n'
    "    {\n"
    '      "original_title": "Название исходной задачи",\n'
    '      "subtasks": ["Подзадача 1", "Подзадача 2"],\n'
    '      "priority": "high|medium|low",\n'
    '      "dependencies": ["Название зависимой задачи"]\n'
    "    }\n"
    "  ]\n"
    "}"
)


class SummarizeRequest(BaseModel):
    text: str
    max_length: int = Field(default=500, description="Maximum summary length in characters")


class SummarizeResponse(BaseModel):
    summary: str
    key_points: list[str]


class TaskItem(BaseModel):
    title: str
    description: str = ""


class SummarizeTasksRequest(BaseModel):
    tasks: list[TaskItem] = Field(..., min_length=1, description="List of tasks to analyze")


class TaskBreakdownItem(BaseModel):
    original_title: str
    subtasks: list[str]
    priority: str
    dependencies: list[str] = []


class SummarizeTasksResponse(BaseModel):
    summary: str
    task_breakdown: list[TaskBreakdownItem]


def _get_mock_response() -> SummarizeResponse:
    return SummarizeResponse(
        summary="[MOCK] This is a mock summary of the technical specification. "
        "The project involves building a web application with a microservice architecture.",
        key_points=[
            "[MOCK] Key requirement: RESTful API with authentication",
            "[MOCK] Tech stack: Python, FastAPI, PostgreSQL",
            "[MOCK] Deadline: 2 weeks",
            "[MOCK] Risk: Third-party API integration complexity",
        ],
    )


def _get_mock_tasks_response(tasks: list[TaskItem]) -> SummarizeTasksResponse:
    return SummarizeTasksResponse(
        summary="[MOCK] Автоматически сгенерированная декомпозиция задач",
        task_breakdown=[
            TaskBreakdownItem(
                original_title=task.title,
                subtasks=[
                    f"[MOCK] Анализ требований для: {task.title}",
                    f"[MOCK] Реализация: {task.title}",
                    f"[MOCK] Тестирование: {task.title}",
                ],
                priority="medium",
                dependencies=[],
            )
            for task in tasks
        ],
    )


def _parse_ai_response(content: str) -> SummarizeResponse:
    lines = content.strip().split("\n")
    summary_lines = []
    key_points = []
    in_key_points = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if summary_lines and not in_key_points:
                in_key_points = True
            continue
        if stripped.startswith(("-", "*", "\u2022")) or (
            len(stripped) > 2 and stripped[0].isdigit() and stripped[1] in ".)"
        ):
            in_key_points = True
            point = stripped.lstrip("-*\u2022 ")
            if len(point) > 2 and point[0].isdigit() and point[1] in ".)":
                point = point[2:].strip()
            if point:
                key_points.append(point)
        elif not in_key_points:
            summary_lines.append(stripped)
        else:
            key_points.append(stripped)

    summary = " ".join(summary_lines) if summary_lines else content[:500]
    if not key_points:
        key_points = [summary]

    return SummarizeResponse(summary=summary, key_points=key_points)


@router.post("/", response_model=SummarizeResponse)
async def summarize_text(request: Request, body: SummarizeRequest):
    client = request.app.state.anthropic_client
    if client is None:
        logger.info("API-ключ не настроен, возвращаем мок-ответ")
        return _get_mock_response()

    try:
        logger.info(f"Запрос на суммаризацию текста (длина: {len(body.text)} символов)")
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=body.max_length * 2,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Summarize the following technical specification:\n\n{body.text}",
                }
            ],
        )
        content = message.content[0].text
        logger.info("Суммаризация текста выполнена успешно")
        return _parse_ai_response(content)
    except Exception as e:
        logger.error(f"Ошибка API Anthropic: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка AI-сервиса: не удалось выполнить суммаризацию. {str(e)}",
        )


@router.post("/document", response_model=SummarizeResponse)
async def summarize_document(request: Request, file: UploadFile = File(...)):
    try:
        content_bytes = await file.read()
        text = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Файл должен быть в кодировке UTF-8",
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Не удалось прочитать файл: {str(e)}",
        )

    client = request.app.state.anthropic_client
    if client is None:
        logger.info("API-ключ не настроен, возвращаем мок-ответ")
        return _get_mock_response()

    try:
        logger.info(f"Запрос на суммаризацию документа '{file.filename}' (размер: {len(text)} символов)")
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Summarize the following technical specification document:\n\n{text}",
                }
            ],
        )
        ai_content = message.content[0].text
        logger.info("Суммаризация документа выполнена успешно")
        return _parse_ai_response(ai_content)
    except Exception as e:
        logger.error(f"Ошибка API Anthropic: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка AI-сервиса: не удалось выполнить суммаризацию документа. {str(e)}",
        )


@router.post("/tasks", response_model=SummarizeTasksResponse)
async def summarize_tasks(request: Request, body: SummarizeTasksRequest):
    """Accepts a list of tasks and returns auto-generated task breakdown."""
    client = request.app.state.anthropic_client
    if client is None:
        logger.info("API-ключ не настроен, возвращаем мок-ответ для декомпозиции задач")
        return _get_mock_tasks_response(body.tasks)

    tasks_text = "\n".join(
        f"- {task.title}: {task.description}" if task.description else f"- {task.title}"
        for task in body.tasks
    )

    try:
        logger.info(f"Запрос на декомпозицию {len(body.tasks)} задач")
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=2048,
            system=TASKS_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Проанализируй и декомпозируй следующие задачи:\n\n{tasks_text}",
                }
            ],
        )
        content = message.content[0].text.strip()

        import json

        try:
            parsed = json.loads(content)
            logger.info("Декомпозиция задач выполнена успешно")
            return SummarizeTasksResponse(
                summary=parsed.get("summary", ""),
                task_breakdown=[
                    TaskBreakdownItem(
                        original_title=item.get("original_title", ""),
                        subtasks=item.get("subtasks", []),
                        priority=item.get("priority", "medium"),
                        dependencies=item.get("dependencies", []),
                    )
                    for item in parsed.get("task_breakdown", [])
                ],
            )
        except (json.JSONDecodeError, KeyError, ValueError) as parse_error:
            logger.warning(f"Не удалось разобрать ответ AI как JSON: {parse_error}")
            return _get_mock_tasks_response(body.tasks)
    except Exception as e:
        logger.error(f"Ошибка API Anthropic: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка AI-сервиса: не удалось выполнить декомпозицию задач. {str(e)}",
        )

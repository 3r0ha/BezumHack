import os
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Literal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/estimate", tags=["estimate"])

AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")


class EstimateRequest(BaseModel):
    title: str
    description: str
    context: str = Field(default="", description="Additional context for estimation")


class EstimateResponse(BaseModel):
    complexity: Literal["low", "medium", "high", "critical"]
    estimated_hours: float
    reasoning: str
    suggested_subtasks: list[str]


class BatchEstimateRequest(BaseModel):
    tasks: list[EstimateRequest] = Field(..., min_length=1, description="List of tasks to estimate")


class BatchEstimateItem(BaseModel):
    title: str
    complexity: Literal["low", "medium", "high", "critical"]
    estimated_hours: float
    reasoning: str
    suggested_subtasks: list[str]


class BatchEstimateResponse(BaseModel):
    estimates: list[BatchEstimateItem]
    total_hours: float


def _get_mock_response() -> EstimateResponse:
    return EstimateResponse(
        complexity="medium",
        estimated_hours=8.0,
        reasoning="[MOCK] Based on the task description, this appears to be a medium-complexity task "
        "involving standard CRUD operations with some business logic.",
        suggested_subtasks=[
            "[MOCK] Set up project structure",
            "[MOCK] Implement data models",
            "[MOCK] Create API endpoints",
            "[MOCK] Write unit tests",
            "[MOCK] Integration testing and review",
        ],
    )


def _get_mock_batch_response(tasks: list[EstimateRequest]) -> BatchEstimateResponse:
    estimates = [
        BatchEstimateItem(
            title=task.title,
            complexity="medium",
            estimated_hours=8.0,
            reasoning=f"[MOCK] Оценка для задачи '{task.title}': средняя сложность, стандартная реализация.",
            suggested_subtasks=[
                f"[MOCK] Анализ требований: {task.title}",
                f"[MOCK] Реализация: {task.title}",
                f"[MOCK] Тестирование: {task.title}",
            ],
        )
        for task in tasks
    ]
    return BatchEstimateResponse(
        estimates=estimates,
        total_hours=sum(e.estimated_hours for e in estimates),
    )


@router.post("/", response_model=EstimateResponse)
async def estimate_task(request: Request, body: EstimateRequest):
    client = request.app.state.anthropic_client
    if client is None:
        logger.info("API-ключ не настроен, возвращаем мок-ответ")
        return _get_mock_response()

    context_section = f"\nAdditional context: {body.context}" if body.context else ""

    try:
        logger.info(f"Запрос на оценку задачи: '{body.title}'")
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=1024,
            system=(
                "You are an experienced software engineering project manager and technical lead. "
                "Analyze the given task and provide a complexity estimate. "
                "Respond with ONLY a JSON object in the format:\n"
                "{\n"
                '  "complexity": "low|medium|high|critical",\n'
                '  "estimated_hours": <number>,\n'
                '  "reasoning": "<explanation>",\n'
                '  "suggested_subtasks": ["<subtask1>", "<subtask2>", ...]\n'
                "}\n\n"
                "Complexity guidelines:\n"
                "- low: Simple changes, up to 4 hours\n"
                "- medium: Moderate work, 4-16 hours\n"
                "- high: Complex work, 16-40 hours\n"
                "- critical: Very complex, 40+ hours, high risk"
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Estimate the following task:\n\n"
                        f"Title: {body.title}\n"
                        f"Description: {body.description}"
                        f"{context_section}"
                    ),
                }
            ],
        )
        content = message.content[0].text.strip()

        import json

        try:
            parsed = json.loads(content)
            logger.info(f"Оценка задачи '{body.title}' выполнена: {parsed.get('complexity', 'unknown')}")
            return EstimateResponse(
                complexity=parsed["complexity"],
                estimated_hours=float(parsed["estimated_hours"]),
                reasoning=parsed["reasoning"],
                suggested_subtasks=parsed.get("suggested_subtasks", []),
            )
        except (json.JSONDecodeError, KeyError, ValueError) as parse_error:
            logger.warning(f"Не удалось разобрать ответ AI как JSON: {parse_error}")
            return EstimateResponse(
                complexity="medium",
                estimated_hours=8.0,
                reasoning=content,
                suggested_subtasks=[],
            )
    except Exception as e:
        logger.error(f"Ошибка API Anthropic: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка AI-сервиса: не удалось выполнить оценку задачи. {str(e)}",
        )


@router.post("/batch", response_model=BatchEstimateResponse)
async def estimate_batch(request: Request, body: BatchEstimateRequest):
    """Accepts multiple tasks and returns estimates for all of them."""
    client = request.app.state.anthropic_client
    if client is None:
        logger.info("API-ключ не настроен, возвращаем мок-ответ для пакетной оценки")
        return _get_mock_batch_response(body.tasks)

    tasks_text = "\n".join(
        f"Task {i+1}:\n  Title: {task.title}\n  Description: {task.description}"
        + (f"\n  Context: {task.context}" if task.context else "")
        for i, task in enumerate(body.tasks)
    )

    try:
        logger.info(f"Запрос на пакетную оценку {len(body.tasks)} задач")
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=2048,
            system=(
                "You are an experienced software engineering project manager and technical lead. "
                "Analyze multiple tasks and provide complexity estimates for each. "
                "Respond with ONLY a JSON object in the format:\n"
                "{\n"
                '  "estimates": [\n'
                "    {\n"
                '      "title": "<task title>",\n'
                '      "complexity": "low|medium|high|critical",\n'
                '      "estimated_hours": <number>,\n'
                '      "reasoning": "<explanation>",\n'
                '      "suggested_subtasks": ["<subtask1>", "<subtask2>", ...]\n'
                "    }\n"
                "  ]\n"
                "}\n\n"
                "Complexity guidelines:\n"
                "- low: Simple changes, up to 4 hours\n"
                "- medium: Moderate work, 4-16 hours\n"
                "- high: Complex work, 16-40 hours\n"
                "- critical: Very complex, 40+ hours, high risk"
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"Estimate the following tasks:\n\n{tasks_text}",
                }
            ],
        )
        content = message.content[0].text.strip()

        import json

        try:
            parsed = json.loads(content)
            estimates = [
                BatchEstimateItem(
                    title=item.get("title", body.tasks[i].title if i < len(body.tasks) else "Unknown"),
                    complexity=item["complexity"],
                    estimated_hours=float(item["estimated_hours"]),
                    reasoning=item["reasoning"],
                    suggested_subtasks=item.get("suggested_subtasks", []),
                )
                for i, item in enumerate(parsed.get("estimates", []))
            ]
            total_hours = sum(e.estimated_hours for e in estimates)
            logger.info(f"Пакетная оценка выполнена: {len(estimates)} задач, всего {total_hours} часов")
            return BatchEstimateResponse(estimates=estimates, total_hours=total_hours)
        except (json.JSONDecodeError, KeyError, ValueError) as parse_error:
            logger.warning(f"Не удалось разобрать ответ AI как JSON: {parse_error}")
            return _get_mock_batch_response(body.tasks)
    except Exception as e:
        logger.error(f"Ошибка API Anthropic: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка AI-сервиса: не удалось выполнить пакетную оценку задач. {str(e)}",
        )

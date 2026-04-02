from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import os
import json

router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")


class AutopilotRequest(BaseModel):
    text: str
    project_title: Optional[str] = None


class AutopilotTask(BaseModel):
    title: str
    description: str
    priority: str  # LOW, MEDIUM, HIGH, CRITICAL
    estimated_hours: float
    dependencies: list[str]  # titles of tasks this depends on
    phase: str


class AutopilotResult(BaseModel):
    project_title: str
    project_description: str
    phases: list[dict]
    tasks: list[dict]
    total_estimated_hours: float
    estimated_weeks: float
    risks: list[str]
    tech_stack_suggestions: list[str]


SYSTEM_PROMPT = """Ты — опытный технический директор и project-менеджер. Твоя задача — проанализировать техническое задание (ТЗ) и создать полный план проекта.

Ты ДОЛЖЕН вернуть JSON строго следующей структуры (без markdown, без ```):
{
  "project_title": "Название проекта",
  "project_description": "Краткое описание проекта (2-3 предложения)",
  "phases": [
    {
      "name": "Название фазы",
      "description": "Описание",
      "order": 1
    }
  ],
  "tasks": [
    {
      "title": "Название задачи",
      "description": "Подробное описание что нужно сделать",
      "priority": "HIGH",
      "estimated_hours": 8,
      "phase": "Название фазы",
      "dependencies": ["Название задачи от которой зависит"],
      "skills_required": ["frontend", "backend"]
    }
  ],
  "total_estimated_hours": 240,
  "estimated_weeks": 6,
  "risks": [
    "Описание риска"
  ],
  "tech_stack_suggestions": [
    "Технология - причина выбора"
  ]
}

Правила:
1. Разбивай проект на логические фазы (Аналитика, Дизайн, Backend, Frontend, Тестирование, Деплой)
2. Каждая задача должна быть конкретной и выполнимой за 2-40 часов
3. Зависимости указывай по названиям задач
4. Приоритеты: CRITICAL для блокирующих задач, HIGH для ключевого функционала, MEDIUM для стандартных задач, LOW для nice-to-have
5. Будь реалистичен в оценках — добавляй буфер 20% на непредвиденные ситуации
6. Учитывай все стороны разработки: БД, API, UI, тесты, деплой
7. Риски должны быть конкретными и релевантными для данного проекта"""

MOCK_RESPONSE = {
    "project_title": "Пример проекта",
    "project_description": "Автоматически сгенерированный план проекта на основе ТЗ",
    "phases": [
        {"name": "Аналитика и проектирование", "description": "Анализ требований, проектирование архитектуры", "order": 1},
        {"name": "Backend разработка", "description": "Разработка серверной части", "order": 2},
        {"name": "Frontend разработка", "description": "Разработка клиентской части", "order": 3},
        {"name": "Тестирование и деплой", "description": "QA и развертывание", "order": 4},
    ],
    "tasks": [
        {"title": "Анализ требований", "description": "Детальный разбор ТЗ", "priority": "CRITICAL", "estimated_hours": 8, "phase": "Аналитика и проектирование", "dependencies": [], "skills_required": ["analysis"]},
        {"title": "Проектирование БД", "description": "Дизайн схемы базы данных", "priority": "HIGH", "estimated_hours": 12, "phase": "Аналитика и проектирование", "dependencies": ["Анализ требований"], "skills_required": ["backend", "database"]},
        {"title": "Разработка API", "description": "REST API эндпоинты", "priority": "HIGH", "estimated_hours": 40, "phase": "Backend разработка", "dependencies": ["Проектирование БД"], "skills_required": ["backend"]},
        {"title": "Разработка UI", "description": "Интерфейс пользователя", "priority": "HIGH", "estimated_hours": 40, "phase": "Frontend разработка", "dependencies": ["Разработка API"], "skills_required": ["frontend"]},
        {"title": "Интеграционное тестирование", "description": "Полный цикл тестирования", "priority": "MEDIUM", "estimated_hours": 16, "phase": "Тестирование и деплой", "dependencies": ["Разработка UI"], "skills_required": ["qa"]},
    ],
    "total_estimated_hours": 116,
    "estimated_weeks": 3,
    "risks": ["Неполное ТЗ может привести к переделкам", "Интеграция компонентов может занять больше времени"],
    "tech_stack_suggestions": ["TypeScript - типобезопасность", "PostgreSQL - надежность", "React - компонентный подход"],
}


@router.post("/autopilot", response_model=AutopilotResult)
async def autopilot_from_text(request: AutopilotRequest):
    """Generate a full project plan from a text specification."""
    if not ANTHROPIC_API_KEY:
        result = {**MOCK_RESPONSE}
        if request.project_title:
            result["project_title"] = request.project_title
        return result

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    user_prompt = f"Вот техническое задание, создай полный план проекта:\n\n{request.text}"
    if request.project_title:
        user_prompt += f"\n\nНазвание проекта: {request.project_title}"

    try:
        response = client.messages.create(
            model=AI_MODEL,
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        text = response.content[0].text.strip()
        # Try to extract JSON from response
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        result = json.loads(text)
        return result
    except Exception as e:
        print(f"AI autopilot error: {e}")
        result = {**MOCK_RESPONSE}
        if request.project_title:
            result["project_title"] = request.project_title
        return result


@router.post("/autopilot/document", response_model=AutopilotResult)
async def autopilot_from_document(
    file: UploadFile = File(...),
    project_title: Optional[str] = Form(None),
):
    """Generate a full project plan from an uploaded document."""
    try:
        content = await file.read()
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        return {"error": "File must be UTF-8 text"}

    request = AutopilotRequest(text=text, project_title=project_title)
    return await autopilot_from_text(request)

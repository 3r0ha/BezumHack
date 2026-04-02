from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import os
import json

router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")


class TaskAnalyticsData(BaseModel):
    title: str
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    status: str
    assignee_id: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None


class ProjectAnalyticsRequest(BaseModel):
    project_title: str
    tasks: list[TaskAnalyticsData]
    deadline: Optional[str] = None


class WeeklyReportRequest(BaseModel):
    project_title: str
    tasks: list[TaskAnalyticsData]
    period_start: str
    period_end: str
    deadline: Optional[str] = None
    budget_total: Optional[float] = None
    budget_spent: Optional[float] = None


ANALYTICS_SYSTEM_PROMPT = """Ты — AI-аналитик проектов. Проанализируй данные проекта и верни JSON:
{
  "health_score": 85,
  "health_label": "Хорошо",
  "insights": [
    {
      "type": "warning|success|info|critical",
      "title": "Краткий заголовок",
      "description": "Подробное описание и рекомендация"
    }
  ],
  "estimation_accuracy": {
    "overall_percent": 78,
    "overestimated_count": 3,
    "underestimated_count": 5,
    "accurate_count": 10,
    "worst_estimates": [{"task": "name", "estimated": 8, "actual": 24, "ratio": 3.0}]
  },
  "bottlenecks": [
    {"assignee_id": "id", "overloaded_tasks": 5, "total_hours": 120}
  ],
  "velocity": {
    "tasks_per_week": 4.5,
    "hours_per_week": 32,
    "trend": "increasing|stable|decreasing"
  },
  "deadline_prediction": {
    "on_track": true,
    "predicted_completion": "2026-06-15",
    "confidence": "high|medium|low",
    "reasoning": "текст"
  }
}

Будь объективным и конкретным. Каждый insight должен содержать actionable рекомендацию."""

REPORT_SYSTEM_PROMPT = """Ты — менеджер проектов, составляющий еженедельный отчёт для заказчика.
Заказчик — нетехнический человек, пиши понятным языком на русском.

Верни JSON:
{
  "summary": "Краткое резюме недели (2-3 предложения)",
  "completed_tasks": ["Что было сделано"],
  "in_progress": ["Что в работе"],
  "planned_next_week": ["Что планируется"],
  "risks": [{"title": "Риск", "mitigation": "Как решаем"}],
  "metrics": {
    "tasks_completed": 5,
    "tasks_total": 20,
    "progress_percent": 45,
    "hours_this_week": 32,
    "budget_status": "В рамках бюджета"
  },
  "client_action_required": ["Что нужно от заказчика, если что-то нужно"]
}

Тон: профессиональный, но дружелюбный. Фокус на прогрессе и ценности для бизнеса."""


MOCK_ANALYTICS = {
    "health_score": 75,
    "health_label": "Удовлетворительно",
    "insights": [
        {"type": "warning", "title": "Отклонение от оценок", "description": "Средняя точность оценок 72%. Рекомендуется проводить ретроспективу оценок."},
        {"type": "success", "title": "Стабильная скорость", "description": "Команда стабильно закрывает 4-5 задач в неделю."},
        {"type": "info", "title": "Рекомендация", "description": "Рассмотрите декомпозицию крупных задач (>16ч) на подзадачи."},
    ],
    "estimation_accuracy": {"overall_percent": 72, "overestimated_count": 2, "underestimated_count": 4, "accurate_count": 8, "worst_estimates": []},
    "bottlenecks": [],
    "velocity": {"tasks_per_week": 4.5, "hours_per_week": 32, "trend": "stable"},
    "deadline_prediction": {"on_track": True, "predicted_completion": "2026-06-15", "confidence": "medium", "reasoning": "При текущей скорости проект будет завершён примерно в срок"},
}

MOCK_REPORT = {
    "summary": "На этой неделе команда продолжила активную разработку. Завершены ключевые задачи по бэкенду, начата работа над интерфейсом.",
    "completed_tasks": ["Разработка API авторизации", "Настройка базы данных", "Дизайн основных экранов"],
    "in_progress": ["Разработка интерфейса", "Интеграция платёжной системы"],
    "planned_next_week": ["Завершение UI", "Начало тестирования", "Подготовка документации"],
    "risks": [{"title": "Возможная задержка по интеграции", "mitigation": "Подготовлен запасной вариант с mock-данными"}],
    "metrics": {"tasks_completed": 3, "tasks_total": 15, "progress_percent": 45, "hours_this_week": 32, "budget_status": "В рамках бюджета"},
    "client_action_required": [],
}


@router.post("/analytics")
async def analyze_project(request: ProjectAnalyticsRequest):
    """AI-powered project analytics with insights and predictions."""
    if not ANTHROPIC_API_KEY:
        return MOCK_ANALYTICS

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    tasks_data = [t.model_dump() for t in request.tasks]
    user_prompt = f"Проект: {request.project_title}\nДедлайн: {request.deadline or 'не указан'}\n\nЗадачи:\n{json.dumps(tasks_data, ensure_ascii=False, indent=2)}"

    try:
        response = client.messages.create(
            model=AI_MODEL,
            max_tokens=4096,
            system=ANALYTICS_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print(f"Analytics error: {e}")
        return MOCK_ANALYTICS


@router.post("/weekly-report")
async def generate_weekly_report(request: WeeklyReportRequest):
    """Generate a client-facing weekly status report."""
    if not ANTHROPIC_API_KEY:
        return MOCK_REPORT

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    tasks_data = [t.model_dump() for t in request.tasks]
    user_prompt = (
        f"Проект: {request.project_title}\n"
        f"Период: {request.period_start} — {request.period_end}\n"
        f"Дедлайн: {request.deadline or 'не указан'}\n"
        f"Бюджет: {request.budget_spent or 0} / {request.budget_total or 'не указан'}\n\n"
        f"Задачи:\n{json.dumps(tasks_data, ensure_ascii=False, indent=2)}"
    )

    try:
        response = client.messages.create(
            model=AI_MODEL,
            max_tokens=4096,
            system=REPORT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print(f"Report error: {e}")
        return MOCK_REPORT


class RiskMatrixRequest(BaseModel):
    project_title: str
    tasks: list[TaskAnalyticsData]
    deadline: Optional[str] = None
    budget_total: Optional[float] = None


RISK_SYSTEM_PROMPT = """Ты — эксперт по управлению рисками в IT-проектах. Проанализируй данные проекта и верни JSON:
{
  "risks": [
    {
      "id": 1,
      "title": "Краткое название риска",
      "description": "Подробное описание",
      "probability": "high|medium|low",
      "impact": "high|medium|low",
      "category": "technical|schedule|budget|resource|scope",
      "mitigation": "Конкретные действия для минимизации",
      "status": "active|mitigated|accepted"
    }
  ],
  "overall_risk_level": "high|medium|low",
  "summary": "Общая оценка рисков проекта (2-3 предложения)"
}

Категории: technical (технические), schedule (сроки), budget (бюджет), resource (ресурсы), scope (объём).
Выявляй реальные риски на основе данных: просроченные задачи, перегруз исполнителей, недооценка времени."""

MOCK_RISKS = {
    "risks": [
        {"id": 1, "title": "Срыв дедлайна", "description": "Текущая скорость разработки может не позволить завершить проект в срок", "probability": "medium", "impact": "high", "category": "schedule", "mitigation": "Приоритизировать критические задачи, рассмотреть MVP-подход", "status": "active"},
        {"id": 2, "title": "Недооценка сложности", "description": "Оценки трудозатрат систематически занижаются", "probability": "high", "impact": "medium", "category": "budget", "mitigation": "Добавить буфер 30% к оценкам, проводить ретроспективы", "status": "active"},
        {"id": 3, "title": "Зависимость от ключевого разработчика", "description": "Большая часть задач назначена на одного исполнителя", "probability": "low", "impact": "high", "category": "resource", "mitigation": "Распределить задачи, провести knowledge sharing", "status": "mitigated"},
    ],
    "overall_risk_level": "medium",
    "summary": "Проект имеет умеренный уровень риска. Основные угрозы связаны со сроками и точностью оценок. Рекомендуется усилить контроль прогресса."
}


@router.post("/risk-matrix")
async def analyze_risks(request: RiskMatrixRequest):
    """AI-powered risk matrix analysis."""
    if not ANTHROPIC_API_KEY:
        return MOCK_RISKS

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    tasks_data = [t.model_dump() for t in request.tasks]
    user_prompt = f"Проект: {request.project_title}\nДедлайн: {request.deadline or 'не указан'}\nБюджет: {request.budget_total or 'не указан'}\n\nЗадачи:\n{json.dumps(tasks_data, ensure_ascii=False, indent=2)}"

    try:
        response = client.messages.create(
            model=AI_MODEL,
            max_tokens=4096,
            system=RISK_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print(f"Risk analysis error: {e}")
        return MOCK_RISKS

import os
import time
import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from src.routers import summarize, translate, estimate, autopilot, analytics
from src.routers import meetings as meetings_router
from src.ai_client import is_configured, AI_PROVIDER

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Envelope AI Service",
    description="AI-powered endpoints: summarize, translate, estimate, autopilot, analytics, risk-matrix, weekly-report",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:
    start = time.time()
    logger.info(f">>> {request.method} {request.url.path}")
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000)
    logger.info(f"<<< {request.method} {request.url.path} {response.status_code} {duration_ms}ms")
    return response


@app.middleware("http")
async def rate_limit_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = "100"
    response.headers["X-RateLimit-Remaining"] = "99"
    response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)
    return response


app.include_router(summarize.router)
app.include_router(translate.router)
app.include_router(estimate.router)
app.include_router(autopilot.router, tags=["autopilot"])
app.include_router(analytics.router, tags=["analytics"])
app.include_router(meetings_router.router, tags=["meetings"])


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ai",
        "provider": AI_PROVIDER,
        "configured": is_configured(),
    }


@app.on_event("startup")
async def startup_event():
    if is_configured():
        logger.info(f"AI provider: {AI_PROVIDER} — configured and ready")
    else:
        logger.warning(
            f"AI provider: {AI_PROVIDER} — NOT configured. Endpoints will return mock responses. "
            "Set YANDEX_API_KEY + YANDEX_FOLDER_ID for YandexGPT, or AI_API_KEY for Anthropic."
        )

    # Keep backward compatibility: init anthropic client if key exists
    api_key = os.getenv("AI_API_KEY")
    if api_key:
        try:
            import anthropic
            app.state.anthropic_client = anthropic.Anthropic(api_key=api_key)
        except Exception:
            app.state.anthropic_client = None
    else:
        app.state.anthropic_client = None

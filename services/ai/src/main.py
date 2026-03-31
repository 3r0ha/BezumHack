import os
import time
import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from src.routers import summarize, translate, estimate

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Microservice",
    description="AI-powered endpoints for summarization, translation, and task estimation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/response logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:
    start = time.time()
    logger.info(f">>> {request.method} {request.url.path}")

    response = await call_next(request)

    duration_ms = round((time.time() - start) * 1000)
    logger.info(
        f"<<< {request.method} {request.url.path} {response.status_code} {duration_ms}ms"
    )

    return response


# Rate limiting headers middleware
@app.middleware("http")
async def rate_limit_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    # Rate limiting concept: add informational headers
    response.headers["X-RateLimit-Limit"] = "100"
    response.headers["X-RateLimit-Remaining"] = "99"
    response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)
    return response


app.include_router(summarize.router)
app.include_router(translate.router)
app.include_router(estimate.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai"}


@app.on_event("startup")
async def startup_event():
    # Use AI_API_KEY consistently (matches docker-compose env var name)
    api_key = os.getenv("AI_API_KEY")
    if api_key:
        import anthropic

        app.state.anthropic_client = anthropic.Anthropic(api_key=api_key)
        logger.info("Anthropic client initialized successfully")
    else:
        app.state.anthropic_client = None
        logger.warning(
            "AI_API_KEY not set. AI endpoints will return mock responses."
        )

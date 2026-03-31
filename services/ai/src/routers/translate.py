import os
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/translate", tags=["translate"])

AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = Field(default="auto", description="Source language code or 'auto' for detection")
    target_lang: str = Field(default="en", description="Target language code")


class TranslateResponse(BaseModel):
    translated_text: str
    detected_language: str


def _get_mock_response(target_lang: str) -> TranslateResponse:
    return TranslateResponse(
        translated_text="[MOCK] This is a mock translation of the provided text.",
        detected_language="ru" if target_lang == "en" else "en",
    )


@router.post("/", response_model=TranslateResponse)
async def translate_text(request: Request, body: TranslateRequest):
    client = request.app.state.anthropic_client
    if client is None:
        logger.info("API-ключ не настроен, возвращаем мок-ответ для перевода")
        return _get_mock_response(body.target_lang)

    source_instruction = (
        f"from {body.source_lang}" if body.source_lang != "auto" else "(auto-detect the source language)"
    )

    try:
        logger.info(
            f"Запрос на перевод текста (длина: {len(body.text)} символов, "
            f"источник: {body.source_lang}, цель: {body.target_lang})"
        )
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=2048,
            system=(
                "You are a professional translator. Translate the given text accurately, "
                "preserving the original meaning, tone, and formatting. "
                "Respond with ONLY a JSON object in the format: "
                '{"translated_text": "...", "detected_language": "..."} '
                "where detected_language is the ISO 639-1 code of the source language."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Translate the following text {source_instruction} to {body.target_lang}:\n\n"
                        f"{body.text}"
                    ),
                }
            ],
        )
        content = message.content[0].text.strip()

        import json

        try:
            parsed = json.loads(content)
            logger.info("Перевод выполнен успешно")
            return TranslateResponse(
                translated_text=parsed["translated_text"],
                detected_language=parsed.get("detected_language", "unknown"),
            )
        except (json.JSONDecodeError, KeyError):
            logger.warning("Не удалось разобрать ответ AI как JSON, возвращаем сырой текст")
            return TranslateResponse(
                translated_text=content,
                detected_language="unknown",
            )
    except Exception as e:
        logger.error(f"Ошибка API Anthropic: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка AI-сервиса: не удалось выполнить перевод. {str(e)}",
        )

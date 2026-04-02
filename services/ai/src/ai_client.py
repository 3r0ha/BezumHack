"""
Universal AI client supporting YandexGPT and Anthropic Claude.
System prompts loaded from /src/prompts/*.txt files.

Environment variables:
- AI_PROVIDER: "yandex" | "anthropic" (default: "yandex")
- YANDEX_API_KEY: IAM token or API key
- YANDEX_FOLDER_ID: Yandex Cloud folder ID
- YANDEX_MODEL: model name (default: "yandexgpt/latest")
- AI_API_KEY: Anthropic API key (fallback)
- AI_MODEL: Anthropic model (default: "claude-sonnet-4-20250514")
"""

import os
import json
import logging
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────

AI_PROVIDER = os.getenv("AI_PROVIDER", "yandex")
YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
YANDEX_FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "")
YANDEX_MODEL = os.getenv("YANDEX_MODEL", "yandexgpt/latest")
YANDEX_API_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

ANTHROPIC_API_KEY = os.getenv("AI_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")

PROMPTS_DIR = Path(__file__).parent / "prompts"


# ─── Prompt loader ────────────────────────────────────────────────────

_prompt_cache: dict[str, str] = {}


def get_prompt(name: str) -> str:
    """Load a system prompt from file. Cached after first read."""
    if name in _prompt_cache:
        return _prompt_cache[name]

    filepath = PROMPTS_DIR / f"{name}.txt"
    if not filepath.exists():
        logger.warning(f"Prompt file not found: {filepath}")
        return f"You are a helpful AI assistant."

    text = filepath.read_text(encoding="utf-8").strip()
    _prompt_cache[name] = text
    logger.info(f"Loaded prompt '{name}' ({len(text)} chars)")
    return text


def reload_prompts():
    """Clear cache and reload all prompts from disk."""
    _prompt_cache.clear()
    for f in PROMPTS_DIR.glob("*.txt"):
        get_prompt(f.stem)
    logger.info(f"Reloaded {len(_prompt_cache)} prompts")


# ─── Provider check ──────────────────────────────────────────────────

def is_configured() -> bool:
    """Check if any AI provider is configured."""
    if AI_PROVIDER == "yandex":
        return bool(YANDEX_API_KEY and YANDEX_FOLDER_ID)
    return bool(ANTHROPIC_API_KEY)


# ─── Completion ──────────────────────────────────────────────────────

async def complete(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """Send completion request to configured AI provider. Returns raw text."""
    if AI_PROVIDER == "yandex" and YANDEX_API_KEY and YANDEX_FOLDER_ID:
        return await _yandex_complete(system_prompt, user_message, max_tokens, temperature)
    elif ANTHROPIC_API_KEY:
        return await _anthropic_complete(system_prompt, user_message, max_tokens, temperature)
    else:
        raise RuntimeError("No AI provider configured")


async def complete_with_prompt(
    prompt_name: str,
    user_message: str,
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """Load prompt from file by name and send completion."""
    system_prompt = get_prompt(prompt_name)
    return await complete(system_prompt, user_message, max_tokens, temperature)


# ─── YandexGPT ───────────────────────────────────────────────────────

async def _yandex_complete(
    system_prompt: str,
    user_message: str,
    max_tokens: int,
    temperature: float,
) -> str:
    model_uri = f"gpt://{YANDEX_FOLDER_ID}/{YANDEX_MODEL}"

    headers = {"Content-Type": "application/json"}
    if YANDEX_API_KEY.startswith("t1."):
        headers["Authorization"] = f"Bearer {YANDEX_API_KEY}"
    else:
        headers["Authorization"] = f"Api-Key {YANDEX_API_KEY}"

    payload = {
        "modelUri": model_uri,
        "completionOptions": {
            "stream": False,
            "temperature": temperature,
            "maxTokens": str(max_tokens),
        },
        "messages": [
            {"role": "system", "text": system_prompt},
            {"role": "user", "text": user_message},
        ],
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(YANDEX_API_URL, json=payload, headers=headers)

        if response.status_code != 200:
            logger.error(f"YandexGPT error {response.status_code}: {response.text[:500]}")
            raise RuntimeError(f"YandexGPT API error: {response.status_code}")

        data = response.json()
        alternatives = data.get("result", {}).get("alternatives", [])
        if not alternatives:
            raise RuntimeError("YandexGPT returned empty response")

        text = alternatives[0].get("message", {}).get("text", "")
        logger.info(f"YandexGPT response: {len(text)} chars")
        return text


# ─── Anthropic Claude ────────────────────────────────────────────────

async def _anthropic_complete(
    system_prompt: str,
    user_message: str,
    max_tokens: int,
    temperature: float,
) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    message = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    text = message.content[0].text.strip()
    logger.info(f"Anthropic response: {len(text)} chars")
    return text


# ─── JSON parser ─────────────────────────────────────────────────────

def parse_json_response(text: str) -> dict:
    """Parse JSON from AI response, handling markdown code blocks."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("```")
        if len(lines) >= 2:
            text = lines[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse JSON: {text[:200]}")
        raise

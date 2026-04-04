import json
from collections.abc import AsyncGenerator
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.core.logging import get_logger

logger = get_logger(__name__)

# Approximate pricing per 1M tokens (USD) — update as models change
_PRICING: dict[str, dict[str, float]] = {
    "openai/gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "openai/gpt-4o": {"input": 2.50, "output": 10.00},
    "openai/text-embedding-3-small": {"input": 0.02, "output": 0.0},
}


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    pricing = _PRICING.get(model, {"input": 0.0, "output": 0.0})
    return (prompt_tokens * pricing["input"] + completion_tokens * pricing["output"]) / 1_000_000


class LLMClient:
    """LLM client backed by OpenRouter (OpenAI-compatible API)."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        )

    async def create_embeddings(self, texts: list[str]) -> list[list[float]]:
        try:
            response = await self.client.embeddings.create(
                input=texts,
                model=settings.embedding_model,
                dimensions=settings.embedding_dimensions,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error("embedding_error", error=str(e))
            raise ExternalServiceError("OpenRouter", str(e)) from e

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        response_format: dict[str, Any] | None = None,
    ) -> tuple[str, int, int]:
        """Returns (content, prompt_tokens, completion_tokens)."""
        try:
            kwargs: dict[str, Any] = {
                "model": settings.chat_model,
                "messages": messages,
                "temperature": 0.1,
            }
            if response_format is not None:
                kwargs["response_format"] = response_format

            response = await self.client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content or ""
            usage = response.usage
            prompt_tokens = usage.prompt_tokens if usage else 0
            completion_tokens = usage.completion_tokens if usage else 0
            return content, prompt_tokens, completion_tokens
        except Exception as e:
            logger.error("chat_completion_error", error=str(e))
            raise ExternalServiceError("OpenRouter", str(e)) from e

    async def chat_completion_stream(
        self,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        try:
            stream = await self.client.chat.completions.create(
                model=settings.chat_model,
                messages=messages,
                temperature=0.1,
                stream=True,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error("chat_stream_error", error=str(e))
            raise ExternalServiceError("OpenRouter", str(e)) from e

    async def structured_extraction(
        self,
        text: str,
        schema: dict[str, Any],
        instructions: str | None = None,
    ) -> tuple[dict[str, Any], int, int]:
        """Extract structured data from text. Returns (data, prompt_tokens, completion_tokens)."""
        system_prompt = (
            "You are a data extraction assistant. Extract information from the provided text "
            "according to the given JSON schema. Return ONLY valid JSON matching the schema."
        )
        if instructions:
            system_prompt += f"\n\nAdditional instructions: {instructions}"

        user_prompt = (
            f"Extract data from this text according to the schema.\n\n"
            f"Schema:\n```json\n{json.dumps(schema, indent=2)}\n```\n\n"
            f"Text:\n{text}"
        )

        content, prompt_tokens, completion_tokens = await self.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ExternalServiceError("OpenRouter", f"Invalid JSON response: {e}") from e

        return data, prompt_tokens, completion_tokens

"""Model provider abstraction for agent skills."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

logger = logging.getLogger("ai_agent_platform.model_provider")


class BaseModelProvider(ABC):
    """Abstract model provider contract."""

    @abstractmethod
    def generate(self, prompt: str, system: str = "", max_tokens: int = 512) -> str:
        """Generate response text from a prompt."""


class RuleBasedModelProvider(BaseModelProvider):
    """Deterministic fallback provider for local development and tests."""

    def generate(self, prompt: str, system: str = "", max_tokens: int = 512) -> str:
        cleaned = prompt.strip()
        if not cleaned:
            return "I can help you manage your inbox, summarize threads, and draft replies."
        return cleaned


class ClaudeModelProvider(BaseModelProvider):
    """Anthropic Claude provider for production AI responses."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6") -> None:
        try:
            import anthropic  # noqa: PLC0415
            self._client = anthropic.Anthropic(api_key=api_key)
        except ImportError as exc:
            raise ImportError(
                "anthropic package required. Install: pip install anthropic"
            ) from exc
        self._model = model
        logger.info("ClaudeModelProvider initialized model=%s", model)

    def generate(self, prompt: str, system: str = "", max_tokens: int = 512) -> str:
        import anthropic  # noqa: PLC0415

        system_text = (
            system
            or "You are MailZen, an intelligent email assistant. "
            "Be concise, professional, and action-oriented."
        )
        try:
            msg = self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=system_text,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text
        except anthropic.APIError as exc:
            logger.error("Claude API error: %s", exc)
            raise RuntimeError(f"Claude API error: {exc}") from exc


class OpenAIModelProvider(BaseModelProvider):
    """OpenAI provider for production AI responses."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini") -> None:
        try:
            from openai import OpenAI  # noqa: PLC0415
            self._client = OpenAI(api_key=api_key)
        except ImportError as exc:
            raise ImportError(
                "openai package required. Install: pip install openai"
            ) from exc
        self._model = model
        logger.info("OpenAIModelProvider initialized model=%s", model)

    def generate(self, prompt: str, system: str = "", max_tokens: int = 512) -> str:
        from openai import OpenAIError  # noqa: PLC0415

        system_text = (
            system
            or "You are MailZen, an intelligent email assistant. "
            "Be concise, professional, and action-oriented."
        )
        try:
            resp = self._client.chat.completions.create(
                model=self._model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": prompt},
                ],
            )
            return resp.choices[0].message.content or ""
        except OpenAIError as exc:
            logger.error("OpenAI API error: %s", exc)
            raise RuntimeError(f"OpenAI API error: {exc}") from exc

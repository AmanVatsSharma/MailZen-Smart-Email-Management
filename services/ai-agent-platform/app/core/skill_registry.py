"""Skill registration and lookup for platform runtime."""

from __future__ import annotations

import logging

from app.config.settings import settings
from app.core.model_provider import (
    BaseModelProvider,
    ClaudeModelProvider,
    OpenAIModelProvider,
    RuleBasedModelProvider,
)

logger = logging.getLogger("ai_agent_platform.skill_registry")


def _build_model_provider() -> BaseModelProvider:
    """Instantiate the correct model provider from environment settings."""
    provider = settings.agent_llm_provider.strip().lower()
    api_key = settings.agent_llm_api_key.strip()
    model = settings.agent_llm_model.strip()

    if provider == "claude" and api_key:
        logger.info("Using ClaudeModelProvider model=%s", model or "claude-sonnet-4-6")
        return ClaudeModelProvider(api_key, model or "claude-sonnet-4-6")
    if provider == "openai" and api_key:
        logger.info("Using OpenAIModelProvider model=%s", model or "gpt-4o-mini")
        return OpenAIModelProvider(api_key, model or "gpt-4o-mini")
    logger.info("Using RuleBasedModelProvider (no LLM API key configured)")
    return RuleBasedModelProvider()


class SkillRegistry:
    """In-memory skill registry with lazy instantiation and shared LLM provider."""

    def __init__(self) -> None:
        self._model_provider: BaseModelProvider = _build_model_provider()
        self._factories: dict[str, object] = {}
        self._cache: dict[str, object] = {}
        self._init_factories()

    def _init_factories(self) -> None:
        from app.skills.auth.skill import AuthSkill  # noqa: PLC0415
        from app.skills.coordinator.skill import CoordinatorSkill  # noqa: PLC0415
        from app.skills.followup.skill import FollowupSkill  # noqa: PLC0415
        from app.skills.inbox.skill import InboxSkill  # noqa: PLC0415
        from app.skills.summarize.skill import SummarizeSkill  # noqa: PLC0415
        from app.skills.triage.skill import TriageSkill  # noqa: PLC0415
        from app.skills.unsubscribe.skill import UnsubscribeSkill  # noqa: PLC0415

        mp = self._model_provider
        self._factories = {
            "auth": lambda: AuthSkill(mp),
            "auth-login": lambda: AuthSkill(mp),
            "inbox": lambda: InboxSkill(mp),
            "triage": lambda: TriageSkill(mp),
            "summarize": lambda: SummarizeSkill(mp),
            "followup": lambda: FollowupSkill(mp),
            "unsubscribe": lambda: UnsubscribeSkill(mp),
            "coordinator": lambda: CoordinatorSkill(mp, self),
        }

    def get_skill(self, skill_name: str) -> object:
        normalized = skill_name.strip().lower()
        if normalized in self._cache:
            return self._cache[normalized]

        factory = self._factories.get(normalized)
        if factory is None:
            raise ValueError(f"unsupported skill '{skill_name}'")

        skill = factory()  # type: ignore[operator]
        self._cache[normalized] = skill
        return skill

    def registered_skills(self) -> list[str]:
        return sorted(self._factories.keys())

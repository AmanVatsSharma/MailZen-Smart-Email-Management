"""Coordinator skill plugin — orchestrates multiple specialist agent skills in parallel."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.model_provider import BaseModelProvider, RuleBasedModelProvider
from app.skills.coordinator.graph import build_coordinator_skill_graph

if TYPE_CHECKING:
    from app.core.skill_registry import SkillRegistry


class CoordinatorSkill:
    """Routes requests to specialist skills and aggregates their responses."""

    def __init__(
        self,
        model_provider: BaseModelProvider | None = None,
        registry: "SkillRegistry | None" = None,
    ) -> None:
        from app.core.skill_registry import SkillRegistry as SR  # noqa: PLC0415

        self._registry = registry or SR()
        self._graph = build_coordinator_skill_graph(
            model_provider or RuleBasedModelProvider(), self._registry
        )

    def run(self, request: AgentRequest) -> AgentResponse:
        """Execute coordinator graph and return aggregated multi-skill response."""
        state = self._graph.invoke(
            {
                "request": request,
                "routed_skills": [],
                "sub_responses": [],
                "assistant_text": "",
                "suggested_actions": [],
                "safety_flags": [],
                "intent": "coordinator_route",
                "confidence": 0.5,
            }
        )

        return AgentResponse(
            version="v1",
            skill="coordinator",
            assistantText=state["assistant_text"],
            intent=state["intent"],
            confidence=float(state["confidence"]),
            suggestedActions=state["suggested_actions"],
            uiHints={
                "surface": request.context.surface,
                "locale": request.context.locale,
            },
            safetyFlags=state["safety_flags"],
        )

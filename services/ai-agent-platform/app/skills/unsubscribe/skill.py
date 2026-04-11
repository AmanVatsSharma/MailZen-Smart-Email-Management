"""Unsubscribe skill plugin — detects list emails and manages newsletter subscriptions."""

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.model_provider import BaseModelProvider, RuleBasedModelProvider
from app.skills.unsubscribe.graph import build_unsubscribe_skill_graph


class UnsubscribeSkill:
    """Detects promotional/newsletter emails and helps users unsubscribe intelligently."""

    def __init__(self, model_provider: BaseModelProvider | None = None) -> None:
        self._graph = build_unsubscribe_skill_graph(model_provider or RuleBasedModelProvider())

    def run(self, request: AgentRequest) -> AgentResponse:
        """Execute unsubscribe graph and return subscription management response."""
        state = self._graph.invoke(
            {
                "request": request,
                "is_list_email": False,
                "list_type": "unknown",
                "unsubscribe_url": "",
                "keep_recommendation": True,
                "keep_reason": "",
                "assistant_text": "",
                "suggested_actions": [],
                "safety_flags": [],
                "intent": "unsubscribe_detect",
                "confidence": 0.5,
            }
        )

        return AgentResponse(
            version="v1",
            skill="unsubscribe",
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

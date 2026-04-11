"""Followup skill plugin — detects stale threads and drafts follow-up messages."""

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.model_provider import BaseModelProvider, RuleBasedModelProvider
from app.skills.followup.graph import build_followup_skill_graph


class FollowupSkill:
    """Detects unanswered sent emails and autonomously drafts follow-up messages."""

    def __init__(self, model_provider: BaseModelProvider | None = None) -> None:
        self._graph = build_followup_skill_graph(model_provider or RuleBasedModelProvider())

    def run(self, request: AgentRequest) -> AgentResponse:
        """Execute followup graph and return follow-up assessment response."""
        state = self._graph.invoke(
            {
                "request": request,
                "days_unanswered": 0,
                "needs_followup": False,
                "urgency_score": 0.0,
                "draft_followup": "",
                "suggested_send_at": "",
                "assistant_text": "",
                "suggested_actions": [],
                "safety_flags": [],
                "intent": "followup_detect",
                "confidence": 0.5,
            }
        )

        return AgentResponse(
            version="v1",
            skill="followup",
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

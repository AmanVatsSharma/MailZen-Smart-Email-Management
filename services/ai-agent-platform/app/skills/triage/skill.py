"""Triage skill plugin — classifies email category, priority, and intent."""

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.model_provider import BaseModelProvider, RuleBasedModelProvider
from app.skills.triage.graph import build_triage_skill_graph


class TriageSkill:
    """Autonomously triages incoming emails: category, priority, sentiment, reply-required."""

    def __init__(self, model_provider: BaseModelProvider | None = None) -> None:
        self._graph = build_triage_skill_graph(model_provider or RuleBasedModelProvider())

    def run(self, request: AgentRequest) -> AgentResponse:
        """Execute triage graph and return structured classification response."""
        state = self._graph.invoke(
            {
                "request": request,
                "category": "work",
                "priority": "normal",
                "sentiment": "neutral",
                "requires_reply": False,
                "estimated_read_time_sec": 60,
                "assistant_text": "",
                "suggested_actions": [],
                "safety_flags": [],
                "intent": "triage_classify",
                "confidence": 0.5,
            }
        )

        return AgentResponse(
            version="v1",
            skill="triage",
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

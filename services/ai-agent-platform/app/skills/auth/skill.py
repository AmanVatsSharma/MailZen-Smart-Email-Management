"""Auth skill plugin for the platform skill registry."""

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.model_provider import RuleBasedModelProvider
from app.skills.auth.graph import build_auth_skill_graph


class AuthSkill:
    """Handles auth-oriented assistant guidance and action hints."""

    def __init__(self) -> None:
        self._graph = build_auth_skill_graph(RuleBasedModelProvider())

    def run(self, request: AgentRequest) -> AgentResponse:
        """Execute the auth graph and map output to standard response."""

        state = self._graph.invoke(
            {
                "request": request,
                "intent": "general_auth_help",
                "confidence": 0.5,
                "assistant_text": "",
                "suggested_actions": [],
                "safety_flags": [],
            }
        )

        return AgentResponse(
            version="v1",
            skill="auth",
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

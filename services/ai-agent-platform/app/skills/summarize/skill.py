"""Summarize skill plugin — intelligent thread summarization with action item extraction."""

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.model_provider import BaseModelProvider, RuleBasedModelProvider
from app.skills.summarize.graph import build_summarize_skill_graph


class SummarizeSkill:
    """Summarizes email threads and extracts action items, people, and deadlines."""

    def __init__(self, model_provider: BaseModelProvider | None = None) -> None:
        self._graph = build_summarize_skill_graph(model_provider or RuleBasedModelProvider())

    def run(self, request: AgentRequest) -> AgentResponse:
        """Execute summarize graph and return structured summary response."""
        state = self._graph.invoke(
            {
                "request": request,
                "thread_context": "",
                "summary": "",
                "action_items": [],
                "key_people": [],
                "deadlines": [],
                "topics": [],
                "assistant_text": "",
                "suggested_actions": [],
                "safety_flags": [],
                "intent": "summarize_thread",
                "confidence": 0.5,
            }
        )

        return AgentResponse(
            version="v1",
            skill="summarize",
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

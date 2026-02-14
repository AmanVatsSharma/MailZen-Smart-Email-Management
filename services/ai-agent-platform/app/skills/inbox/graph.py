"""LangGraph flow for inbox skill reasoning and action hints."""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import SafetyFlag, SuggestedAction
from app.core.model_provider import BaseModelProvider


class InboxGraphState(TypedDict):
    """Execution state for inbox skill graph."""

    request: AgentRequest
    intent: str
    confidence: float
    assistant_text: str
    suggested_actions: list[SuggestedAction]
    safety_flags: list[SafetyFlag]


def _last_user_message(request: AgentRequest) -> str:
    for message in reversed(request.messages):
        if message.role == "user":
            return message.content.lower()
    return request.messages[-1].content.lower()


def _is_allowed(action_name: str, request: AgentRequest) -> bool:
    if not request.allowedActions:
        return True
    return action_name in request.allowedActions


def classify_intent_node(state: InboxGraphState) -> dict[str, object]:
    """Classify inbox intent from the latest user message."""

    message = _last_user_message(state["request"])
    if any(token in message for token in ("summary", "summarize", "brief")):
        return {"intent": "summarize_thread", "confidence": 0.91}
    if any(token in message for token in ("draft", "reply", "respond")):
        return {"intent": "compose_reply_draft", "confidence": 0.9}
    if any(token in message for token in ("open", "show thread", "view thread")):
        return {"intent": "open_thread", "confidence": 0.84}
    return {"intent": "inbox_general_help", "confidence": 0.73}


def draft_response_node(
    state: InboxGraphState, model_provider: BaseModelProvider
) -> dict[str, object]:
    """Draft assistant response for inbox workflows."""

    request = state["request"]
    intent = state["intent"]
    subject = request.context.metadata.get("subject", "the selected thread")

    templates = {
        "summarize_thread": (
            f"I can summarize {subject}. "
            "Use the summary action and I will produce a concise overview."
        ),
        "compose_reply_draft": (
            f"I can draft a reply for {subject}. "
            "Use the draft action and I will prepare a response you can edit."
        ),
        "open_thread": (
            f"I can help you open and inspect {subject}. "
            "Use the open-thread action to focus this conversation."
        ),
        "inbox_general_help": (
            "I can summarize threads, suggest drafts, and help navigate your inbox actions."
        ),
    }
    prompt = templates.get(intent, templates["inbox_general_help"])
    assistant_text = model_provider.generate(prompt)
    return {"assistant_text": assistant_text}


def suggest_actions_node(state: InboxGraphState) -> dict[str, object]:
    """Attach inbox action hints with safe payloads."""

    request = state["request"]
    intent = state["intent"]
    metadata = request.context.metadata
    thread_id = metadata.get("threadId", "")
    subject = metadata.get("subject", "this thread")

    actions: list[SuggestedAction] = []
    if intent == "summarize_thread" and _is_allowed("inbox.summarize_thread", request):
        actions.append(
            SuggestedAction(
                name="inbox.summarize_thread",
                label="Summarize this thread",
                payload={"threadId": thread_id},
            )
        )

    if intent == "compose_reply_draft" and _is_allowed(
        "inbox.compose_reply_draft", request
    ):
        actions.append(
            SuggestedAction(
                name="inbox.compose_reply_draft",
                label="Generate draft reply",
                payload={
                    "threadId": thread_id,
                    "draft": f"Hi, thanks for your message about {subject}. "
                    "Here are the next steps from my side...",
                },
            )
        )

    if intent == "open_thread" and _is_allowed("inbox.open_thread", request):
        actions.append(
            SuggestedAction(
                name="inbox.open_thread",
                label="Open this thread",
                payload={"threadId": thread_id},
            )
        )

    last_user_message = _last_user_message(request)
    safety_flags: list[SafetyFlag] = []
    if "password" in last_user_message or "token" in last_user_message:
        safety_flags.append(
            SafetyFlag(
                code="possible_secret_exposure",
                severity="warn",
                message="Avoid sharing credentials in inbox assistant chat.",
            )
        )

    return {
        "suggested_actions": actions,
        "safety_flags": safety_flags,
    }


def build_inbox_skill_graph(model_provider: BaseModelProvider):
    """Build and compile the inbox skill LangGraph workflow."""

    graph = StateGraph(InboxGraphState)
    graph.add_node("classify_intent", classify_intent_node)
    graph.add_node(
        "draft_response",
        lambda state: draft_response_node(state, model_provider),  # noqa: E731
    )
    graph.add_node("suggest_actions", suggest_actions_node)

    graph.add_edge(START, "classify_intent")
    graph.add_edge("classify_intent", "draft_response")
    graph.add_edge("draft_response", "suggest_actions")
    graph.add_edge("suggest_actions", END)
    return graph.compile()

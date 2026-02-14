"""LangGraph flow for auth skill reasoning and action hints."""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import SafetyFlag, SuggestedAction
from app.core.model_provider import BaseModelProvider


class AuthGraphState(TypedDict):
    """Execution state for auth skill graph."""

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


def classify_intent_node(state: AuthGraphState) -> dict[str, object]:
    """Classify request intent using deterministic heuristics."""

    message = _last_user_message(state["request"])

    if any(token in message for token in ("forgot", "reset", "recover")):
        return {"intent": "forgot_password", "confidence": 0.92}
    if any(token in message for token in ("signup", "sign up", "register")):
        return {"intent": "signup_help", "confidence": 0.9}
    if any(token in message for token in ("otp", "verification code", "code not")):
        return {"intent": "otp_help", "confidence": 0.86}
    if any(
        token in message
        for token in ("can't login", "cannot login", "invalid password", "locked")
    ):
        return {"intent": "login_troubleshoot", "confidence": 0.88}
    return {"intent": "general_auth_help", "confidence": 0.75}


def draft_response_node(
    state: AuthGraphState, model_provider: BaseModelProvider
) -> dict[str, object]:
    """Draft a concise assistant response mapped to the classified intent."""

    intent = state["intent"]
    templates = {
        "forgot_password": (
            "I can help you reset your password. "
            "Use the forgot-password flow and I can prefill your email."
        ),
        "signup_help": (
            "I can guide you through creating an account. "
            "You can start signup and I will walk each step."
        ),
        "otp_help": (
            "I can help with OTP issues. "
            "Please confirm your phone format and request a new code."
        ),
        "login_troubleshoot": (
            "I can help troubleshoot sign-in issues. "
            "Let's verify email, password reset option, and lockout status."
        ),
        "general_auth_help": (
            "I can help with login, registration, password reset, and OTP support."
        ),
    }
    prompt = templates.get(intent, templates["general_auth_help"])
    assistant_text = model_provider.generate(prompt)
    return {"assistant_text": assistant_text}


def suggest_actions_node(state: AuthGraphState) -> dict[str, object]:
    """Attach allowed UI action hints and safety flags."""

    request = state["request"]
    intent = state["intent"]
    context_email = request.context.email or ""
    actions: list[SuggestedAction] = []

    if intent == "forgot_password" and _is_allowed("auth.forgot_password", request):
        actions.append(
            SuggestedAction(
                name="auth.forgot_password",
                label="Send password reset link",
                payload={"email": context_email},
            )
        )
    if intent == "signup_help" and _is_allowed("auth.open_register", request):
        actions.append(
            SuggestedAction(
                name="auth.open_register",
                label="Open registration flow",
            )
        )
    if intent == "otp_help" and _is_allowed("auth.send_signup_otp", request):
        actions.append(
            SuggestedAction(
                name="auth.send_signup_otp",
                label="Request new OTP",
            )
        )
    if intent in {"general_auth_help", "login_troubleshoot"} and _is_allowed(
        "auth.open_login", request
    ):
        actions.append(
            SuggestedAction(
                name="auth.open_login",
                label="Return to login form",
            )
        )

    last_user_message = _last_user_message(request)
    safety_flags: list[SafetyFlag] = []
    if "password is" in last_user_message or "token" in last_user_message:
        safety_flags.append(
            SafetyFlag(
                code="possible_secret_exposure",
                severity="warn",
                message="Avoid sharing passwords or token values in chat.",
            )
        )

    return {
        "suggested_actions": actions,
        "safety_flags": safety_flags,
    }


def build_auth_skill_graph(model_provider: BaseModelProvider):
    """Build and compile the auth skill LangGraph workflow."""

    graph = StateGraph(AuthGraphState)

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

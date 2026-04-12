"""LangGraph flow for newsletter/promo detection and unsubscribe management."""

from __future__ import annotations

import logging
import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import SafetyFlag, SuggestedAction
from app.core.model_provider import BaseModelProvider

logger = logging.getLogger("ai_agent_platform.unsubscribe")

# Patterns that strongly indicate list/promo emails
_LIST_PATTERNS = [
    r"list-unsubscribe",
    r"unsubscribe\s+(?:here|now|link|from)",
    r"manage\s+(?:your\s+)?(?:preferences|subscription)",
    r"opt.out",
    r"you(?:'re| are) receiving this (?:email|message)",
    r"to\s+stop\s+receiving",
]

_PROMO_SUBJECT_PATTERNS = [
    r"\d+%\s+off",
    r"(?:flash|limited|exclusive)\s+(?:sale|offer|deal)",
    r"(?:weekly|monthly|daily)\s+(?:digest|newsletter|update|roundup)",
    r"(?:newsletter|bulletin|dispatch)\s*(?:#\d+)?$",
]

_UNSUBSCRIBE_URL_PATTERN = re.compile(
    r'https?://[^\s"\'<>]+(?:unsubscribe|optout|opt-out|remove|preference)[^\s"\'<>]*',
    re.IGNORECASE,
)


class UnsubscribeGraphState(TypedDict):
    """Execution state for the unsubscribe skill graph."""

    request: AgentRequest
    is_list_email: bool
    list_type: str
    unsubscribe_url: str
    keep_recommendation: bool
    keep_reason: str
    assistant_text: str
    suggested_actions: list[SuggestedAction]
    safety_flags: list[SafetyFlag]
    intent: str
    confidence: float


def detect_list_email_node(state: UnsubscribeGraphState) -> dict[str, object]:
    """Detect if email is a newsletter/promo using header patterns and heuristics."""
    request = state["request"]
    md = request.context.metadata
    body = (md.get("emailBody") or md.get("body", "")).lower()
    subject = (md.get("emailSubject") or md.get("subject", "")).lower()
    headers = (md.get("emailHeaders") or md.get("headers", "")).lower()

    # Check explicit unsubscribe headers (most reliable signal)
    has_list_header = "list-unsubscribe" in headers or "list-id" in headers

    # Check body patterns
    body_signals = sum(
        1 for p in _LIST_PATTERNS if re.search(p, body + headers, re.IGNORECASE)
    )

    # Check subject patterns
    subject_signals = sum(
        1 for p in _PROMO_SUBJECT_PATTERNS if re.search(p, subject, re.IGNORECASE)
    )

    is_list_email = has_list_header or body_signals >= 2 or subject_signals >= 1

    # Determine list type
    list_type = "unknown"
    if is_list_email:
        if any(t in subject for t in ("newsletter", "digest", "roundup", "weekly", "monthly")):
            list_type = "newsletter"
        elif any(t in subject for t in ("sale", "offer", "% off", "promo", "deal")):
            list_type = "promotional"
        elif any(t in subject for t in ("order", "receipt", "invoice", "payment", "shipped")):
            list_type = "transactional"
        elif any(t in subject for t in ("notification", "alert", "update")):
            list_type = "notification"
        else:
            list_type = "newsletter"

    return {
        "is_list_email": is_list_email,
        "list_type": list_type,
        "intent": "unsubscribe_detect",
        "confidence": 0.95 if has_list_header else (0.8 if is_list_email else 0.7),
    }


def extract_unsubscribe_link_node(state: UnsubscribeGraphState) -> dict[str, object]:
    """Extract unsubscribe URL from email body or headers."""
    if not state["is_list_email"]:
        return {"unsubscribe_url": ""}

    request = state["request"]
    md = request.context.metadata
    body = md.get("emailBody") or md.get("body", "")
    headers = md.get("emailHeaders") or md.get("headers", "")

    # Try header first (most reliable)
    header_match = re.search(
        r"list-unsubscribe:\s*<?(https?://[^\s>,<]+)>?",
        headers,
        re.IGNORECASE,
    )
    if header_match:
        return {"unsubscribe_url": header_match.group(1)}

    # Try body
    body_match = _UNSUBSCRIBE_URL_PATTERN.search(body)
    if body_match:
        return {"unsubscribe_url": body_match.group(0)}

    return {"unsubscribe_url": ""}


def classify_value_node(
    state: UnsubscribeGraphState, model_provider: BaseModelProvider
) -> dict[str, object]:
    """Use LLM to determine if the subscription is worth keeping."""
    if not state["is_list_email"]:
        return {
            "keep_recommendation": True,
            "keep_reason": "This does not appear to be a list email.",
            "assistant_text": "This email doesn't appear to be a newsletter or promotional email.",
        }

    request = state["request"]
    md = request.context.metadata
    subject = md.get("emailSubject") or md.get("subject", "")
    from_address = md.get("emailFrom") or md.get("from", "")
    list_type = state["list_type"]

    system = (
        "You are an email assistant helping users decide which subscriptions to keep. "
        "Be practical and direct. Return ONLY: keep or unsubscribe, then a brief reason."
    )
    prompt = (
        f"Should the user keep this {list_type} subscription?\n"
        f"From: {from_address}\n"
        f"Subject: {subject}\n\n"
        f"Reply with exactly: 'keep: <one sentence reason>' or 'unsubscribe: <one sentence reason>'"
    )

    try:
        raw = model_provider.generate(prompt, system=system, max_tokens=80).strip().lower()
        keep = raw.startswith("keep")
        reason = raw.split(":", 1)[-1].strip() if ":" in raw else raw
    except RuntimeError:
        keep = list_type in ("transactional",)
        reason = (
            "Transactional emails are usually important to keep."
            if keep
            else "Promotional emails can usually be safely unsubscribed."
        )

    url = state.get("unsubscribe_url", "")
    if keep:
        assistant_text = f"This looks like a {list_type} worth keeping. {reason.capitalize()}"
    elif url:
        assistant_text = f"You can unsubscribe from this {list_type}. {reason.capitalize()}"
    else:
        assistant_text = (
            f"This appears to be a {list_type}. "
            f"{reason.capitalize()} No direct unsubscribe link was found."
        )

    return {
        "keep_recommendation": keep,
        "keep_reason": reason,
        "assistant_text": assistant_text,
    }


def suggest_unsubscribe_actions_node(state: UnsubscribeGraphState) -> dict[str, object]:
    """Generate unsubscribe action suggestions."""
    request = state["request"]
    md = request.context.metadata
    thread_id = md.get("threadId", "")
    from_address = md.get("emailFrom") or md.get("from", "")

    actions: list[SuggestedAction] = []
    safety_flags: list[SafetyFlag] = []

    if state["is_list_email"]:
        url = state.get("unsubscribe_url", "")
        if url and not state["keep_recommendation"]:
            actions.append(
                SuggestedAction(
                    name="unsubscribe.execute",
                    label="Unsubscribe now",
                    payload={
                        "threadId": thread_id,
                        "unsubscribeUrl": url,
                        "emailFrom": from_address,
                        "listType": state["list_type"],
                    },
                )
            )
            # Security flag for external unsubscribe URLs
            safety_flags.append(
                SafetyFlag(
                    code="external_unsubscribe_link",
                    severity="info",
                    message="Unsubscribe action will open an external URL. MailZen will handle this safely.",
                )
            )

        actions.append(
            SuggestedAction(
                name="unsubscribe.block_sender",
                label=f"Block all emails from {from_address}",
                payload={"emailFrom": from_address, "listType": state["list_type"]},
            )
        )

        if state["keep_recommendation"]:
            actions.append(
                SuggestedAction(
                    name="inbox.apply_label",
                    label=f"Auto-label as {state['list_type']}",
                    payload={
                        "threadId": thread_id,
                        "label": state["list_type"],
                        "emailFrom": from_address,
                    },
                )
            )

    return {"suggested_actions": actions, "safety_flags": safety_flags}


def build_unsubscribe_skill_graph(model_provider: BaseModelProvider):
    """Build and compile the unsubscribe skill LangGraph workflow."""
    graph = StateGraph(UnsubscribeGraphState)
    graph.add_node("detect_list_email", detect_list_email_node)
    graph.add_node("extract_unsubscribe_link", extract_unsubscribe_link_node)
    graph.add_node(
        "classify_value",
        lambda state: classify_value_node(state, model_provider),
    )
    graph.add_node("suggest_unsubscribe_actions", suggest_unsubscribe_actions_node)

    graph.add_edge(START, "detect_list_email")
    graph.add_edge("detect_list_email", "extract_unsubscribe_link")
    graph.add_edge("extract_unsubscribe_link", "classify_value")
    graph.add_edge("classify_value", "suggest_unsubscribe_actions")
    graph.add_edge("suggest_unsubscribe_actions", END)
    return graph.compile()

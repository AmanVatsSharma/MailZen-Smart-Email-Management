"""LangGraph flow for email triage — categorization, priority scoring, and action hints."""

from __future__ import annotations

import json
import logging
import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import SafetyFlag, SuggestedAction
from app.core.model_provider import BaseModelProvider

logger = logging.getLogger("ai_agent_platform.triage")

_VALID_CATEGORIES = {"work", "personal", "newsletter", "transaction", "social", "notification"}
_VALID_PRIORITIES = {"urgent", "high", "normal", "low"}
_VALID_SENTIMENTS = {"positive", "neutral", "negative", "urgent"}


class TriageGraphState(TypedDict):
    """Execution state for the triage skill graph."""

    request: AgentRequest
    category: str
    priority: str
    sentiment: str
    requires_reply: bool
    estimated_read_time_sec: int
    assistant_text: str
    suggested_actions: list[SuggestedAction]
    safety_flags: list[SafetyFlag]
    intent: str
    confidence: float


def _extract_email_context(request: AgentRequest) -> dict[str, str]:
    """Pull email fields from context metadata with safe fallbacks."""
    md = request.context.metadata
    return {
        "subject": md.get("emailSubject") or md.get("subject", "(no subject)"),
        "from_address": md.get("emailFrom") or md.get("from", "unknown"),
        "body": md.get("emailBody") or md.get("body", ""),
        "date": md.get("emailDate") or md.get("date", ""),
        "labels": md.get("labels", ""),
    }


def _rule_based_triage(subject: str, from_address: str, body: str) -> dict[str, object]:
    """Fast deterministic pre-classification before LLM call."""
    subject_lower = subject.lower()
    body_lower = body.lower()
    from_lower = from_address.lower()

    # Newsletter/promo detection
    if any(t in body_lower for t in ("unsubscribe", "list-unsubscribe", "opt out", "manage preferences")):
        return {"category": "newsletter", "priority": "low", "requires_reply": False}
    if any(t in subject_lower for t in ("newsletter", "weekly digest", "monthly update", "promo", "sale", "offer", "% off")):
        return {"category": "newsletter", "priority": "low", "requires_reply": False}

    # Transaction detection
    if any(t in subject_lower for t in ("invoice", "receipt", "order", "payment", "subscription", "billing", "charged")):
        return {"category": "transaction", "priority": "normal", "requires_reply": False}

    # Notification detection
    if any(t in from_lower for t in ("noreply", "no-reply", "donotreply", "notifications@", "alerts@", "support@")):
        return {"category": "notification", "priority": "low", "requires_reply": False}

    # Urgency detection
    if any(t in subject_lower for t in ("urgent", "asap", "critical", "action required", "immediate", "deadline")):
        return {"priority": "urgent"}

    return {}


def _parse_llm_json(raw: str) -> dict[str, object]:
    """Extract JSON from LLM response, handling markdown code blocks."""
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


def classify_email_node(
    state: TriageGraphState, model_provider: BaseModelProvider
) -> dict[str, object]:
    """Use LLM to classify email category, priority, and metadata."""

    request = state["request"]
    ctx = _extract_email_context(request)
    subject = ctx["subject"]
    from_address = ctx["from_address"]
    body = ctx["body"][:1500]  # Truncate to avoid token overflow

    # Fast rule-based pre-check
    precheck = _rule_based_triage(subject, from_address, body)

    # If pre-check gives high-confidence result, skip LLM
    if "category" in precheck and "priority" in precheck:
        return {
            "category": precheck["category"],
            "priority": precheck["priority"],
            "sentiment": "neutral",
            "requires_reply": precheck.get("requires_reply", False),
            "estimated_read_time_sec": max(30, len(body) // 5),
            "intent": "triage_classify",
            "confidence": 0.9,
        }

    # Override with any precheck signals before LLM
    priority_hint = precheck.get("priority", "")

    system = (
        "You are an email classification AI. Analyze emails and return precise JSON classifications. "
        "Never include explanations — return ONLY valid JSON."
    )
    prompt = (
        f"Classify this email:\n\n"
        f"From: {from_address}\n"
        f"Subject: {subject}\n"
        f"Body: {body}\n\n"
        f"Return a JSON object with these exact keys:\n"
        f'- "category": one of {list(_VALID_CATEGORIES)}\n'
        f'- "priority": one of {list(_VALID_PRIORITIES)}'
        + (f" (hint: likely '{priority_hint}')" if priority_hint else "")
        + "\n"
        f'- "sentiment": one of {list(_VALID_SENTIMENTS)}\n'
        f'- "requires_reply": true or false\n'
        f'- "estimated_read_time_sec": integer (30-600)\n\n'
        f"Return ONLY the JSON object."
    )

    try:
        raw = model_provider.generate(prompt, system=system, max_tokens=150)
        parsed = _parse_llm_json(raw)
    except RuntimeError:
        parsed = {}

    category = parsed.get("category", "work")
    if category not in _VALID_CATEGORIES:
        category = "work"

    priority = parsed.get("priority", "normal")
    if priority not in _VALID_PRIORITIES:
        priority = "normal"

    sentiment = parsed.get("sentiment", "neutral")
    if sentiment not in _VALID_SENTIMENTS:
        sentiment = "neutral"

    requires_reply = bool(parsed.get("requires_reply", False))
    read_time = int(parsed.get("estimated_read_time_sec", max(30, len(body) // 5)))

    return {
        "category": category,
        "priority": priority,
        "sentiment": sentiment,
        "requires_reply": requires_reply,
        "estimated_read_time_sec": max(15, min(read_time, 600)),
        "intent": "triage_classify",
        "confidence": 0.88 if parsed else 0.6,
    }


def draft_triage_response_node(state: TriageGraphState) -> dict[str, object]:
    """Generate a human-readable summary of the triage result."""
    category = state["category"]
    priority = state["priority"]
    requires_reply = state["requires_reply"]
    read_time = state["estimated_read_time_sec"]

    priority_descriptions = {
        "urgent": "This email requires immediate attention.",
        "high": "This email is high priority and should be addressed soon.",
        "normal": "This is a normal priority email.",
        "low": "This email is low priority.",
    }
    category_descriptions = {
        "work": "work email",
        "personal": "personal email",
        "newsletter": "newsletter",
        "transaction": "transactional notification",
        "social": "social notification",
        "notification": "automated notification",
    }

    reply_hint = " A reply is expected." if requires_reply else ""
    minutes = max(1, read_time // 60)
    time_hint = f" (~{minutes} min read)" if minutes > 1 else ""

    text = (
        f"{priority_descriptions.get(priority, '')} "
        f"Classified as a {category_descriptions.get(category, category)}{time_hint}.{reply_hint}"
    ).strip()

    return {"assistant_text": text}


def suggest_triage_actions_node(state: TriageGraphState) -> dict[str, object]:
    """Generate triage action suggestions based on classification."""
    request = state["request"]
    ctx = _extract_email_context(request)
    category = state["category"]
    priority = state["priority"]
    thread_id = request.context.metadata.get("threadId", "")

    actions: list[SuggestedAction] = []
    safety_flags: list[SafetyFlag] = []

    # Apply labels action
    actions.append(
        SuggestedAction(
            name="triage.apply_labels",
            label=f"Label as {category} / {priority}",
            payload={
                "threadId": thread_id,
                "category": category,
                "priority": priority,
                "sentiment": state["sentiment"],
                "requiresReply": str(state["requires_reply"]).lower(),
                "estimatedReadTimeSec": str(state["estimated_read_time_sec"]),
            },
        )
    )

    # Priority-specific actions
    if priority == "urgent":
        actions.append(
            SuggestedAction(
                name="triage.mark_urgent",
                label="Mark as urgent and move to top",
                payload={"threadId": thread_id, "priority": "urgent"},
            )
        )

    if category == "newsletter":
        actions.append(
            SuggestedAction(
                name="unsubscribe.detect",
                label="Check unsubscribe options",
                payload={"threadId": thread_id, "emailFrom": ctx["from_address"]},
            )
        )

    if state["requires_reply"] and priority in ("urgent", "high"):
        actions.append(
            SuggestedAction(
                name="inbox.compose_reply_draft",
                label="Draft a reply now",
                payload={"threadId": thread_id, "subject": ctx["subject"]},
            )
        )

    return {"suggested_actions": actions, "safety_flags": safety_flags}


def build_triage_skill_graph(model_provider: BaseModelProvider):
    """Build and compile the triage skill LangGraph workflow."""

    graph = StateGraph(TriageGraphState)
    graph.add_node(
        "classify_email",
        lambda state: classify_email_node(state, model_provider),
    )
    graph.add_node("draft_triage_response", draft_triage_response_node)
    graph.add_node("suggest_triage_actions", suggest_triage_actions_node)

    graph.add_edge(START, "classify_email")
    graph.add_edge("classify_email", "draft_triage_response")
    graph.add_edge("draft_triage_response", "suggest_triage_actions")
    graph.add_edge("suggest_triage_actions", END)
    return graph.compile()

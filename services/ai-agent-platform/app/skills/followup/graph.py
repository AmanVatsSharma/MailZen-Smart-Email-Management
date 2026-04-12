"""LangGraph flow for stale thread detection and follow-up drafting."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import SafetyFlag, SuggestedAction
from app.core.model_provider import BaseModelProvider

logger = logging.getLogger("ai_agent_platform.followup")


class FollowupGraphState(TypedDict):
    """Execution state for the followup skill graph."""

    request: AgentRequest
    days_unanswered: int
    needs_followup: bool
    urgency_score: float
    draft_followup: str
    suggested_send_at: str
    assistant_text: str
    suggested_actions: list[SuggestedAction]
    safety_flags: list[SafetyFlag]
    intent: str
    confidence: float


def _get_days_unanswered(request: AgentRequest) -> int:
    """Extract days unanswered from metadata, or compute from sent date."""
    md = request.context.metadata
    raw = md.get("daysUnanswered") or md.get("days_unanswered", "")
    if raw:
        try:
            return max(0, int(raw))
        except ValueError:
            pass

    sent_date_str = md.get("sentAt") or md.get("sent_at", "")
    if sent_date_str:
        try:
            sent_date = datetime.fromisoformat(sent_date_str.replace("Z", "+00:00"))
            delta = datetime.now(tz=timezone.utc) - sent_date
            return max(0, delta.days)
        except ValueError:
            pass

    return 0


def detect_stale_thread_node(state: FollowupGraphState) -> dict[str, object]:
    """Determine if a thread is stale and needs follow-up based on time rules."""
    request = state["request"]
    days = _get_days_unanswered(request)
    md = request.context.metadata
    priority = md.get("priority") or md.get("aiPriority", "normal")

    # Urgency thresholds by priority level
    thresholds = {"urgent": 1, "high": 2, "normal": 3, "low": 7}
    threshold = thresholds.get(priority.lower(), 3)

    needs_followup = days >= threshold
    urgency_score = min(1.0, days / (threshold * 2)) if threshold > 0 else 0.0

    return {
        "days_unanswered": days,
        "needs_followup": needs_followup,
        "urgency_score": round(urgency_score, 2),
        "intent": "followup_detect",
        "confidence": 0.9 if days > 0 else 0.6,
    }


def draft_followup_node(
    state: FollowupGraphState, model_provider: BaseModelProvider
) -> dict[str, object]:
    """Draft a polite follow-up message using LLM context."""
    request = state["request"]
    md = request.context.metadata
    subject = md.get("emailSubject") or md.get("subject", "my previous email")
    recipient = md.get("emailTo") or md.get("to", "")
    days = state["days_unanswered"]

    if not state["needs_followup"]:
        return {
            "draft_followup": "",
            "assistant_text": f"No follow-up needed yet. This email was sent {days} day(s) ago.",
        }

    system = (
        "You are MailZen, helping draft concise follow-up emails. "
        "Be polite, professional, and brief. Don't be pushy."
    )
    prompt = (
        f"Draft a short follow-up email for this situation:\n"
        f"- Original email subject: {subject}\n"
        f"- Sent to: {recipient or 'the recipient'}\n"
        f"- Days with no reply: {days}\n\n"
        f"Write only the email body (2-3 sentences). "
        f"Start with 'Hi,' or 'Hello,'. Be warm and professional."
    )

    try:
        draft = model_provider.generate(prompt, system=system, max_tokens=200)
    except RuntimeError:
        draft = (
            f"Hi,\n\nI wanted to follow up on my email from {days} days ago "
            f"regarding {subject}. Please let me know if you have any questions "
            f"or if you need additional information.\n\nBest regards"
        )

    days_str = f"{days} day{'s' if days != 1 else ''}"
    assistant_text = (
        f"No reply received in {days_str}. "
        f"I've drafted a follow-up message you can review and send."
    )

    return {"draft_followup": draft, "assistant_text": assistant_text}


def suggest_followup_schedule_node(state: FollowupGraphState) -> dict[str, object]:
    """Suggest an optimal send time and create action suggestions."""
    request = state["request"]
    md = request.context.metadata
    thread_id = md.get("threadId", "")
    subject = md.get("emailSubject") or md.get("subject", "email")
    urgency = state["urgency_score"]

    # Suggest send time based on urgency
    now = datetime.now(tz=timezone.utc)
    if urgency >= 0.8:
        send_delta = timedelta(hours=2)
    elif urgency >= 0.5:
        send_delta = timedelta(hours=24)
    else:
        send_delta = timedelta(days=2)

    # Nudge to 9am if needed
    suggested_send = now + send_delta
    if suggested_send.hour < 9:
        suggested_send = suggested_send.replace(hour=9, minute=0, second=0)
    elif suggested_send.hour > 17:
        suggested_send = (suggested_send + timedelta(days=1)).replace(
            hour=9, minute=0, second=0
        )

    suggested_send_at = suggested_send.isoformat()

    actions: list[SuggestedAction] = []
    if state["needs_followup"]:
        if state["draft_followup"]:
            actions.append(
                SuggestedAction(
                    name="followup.schedule_send",
                    label=f"Schedule follow-up for {suggested_send.strftime('%b %d %H:%M')}",
                    payload={
                        "threadId": thread_id,
                        "draft": state["draft_followup"][:500],
                        "suggestedSendAt": suggested_send_at,
                        "subject": f"Re: {subject}",
                    },
                )
            )
        actions.append(
            SuggestedAction(
                name="followup.snooze",
                label="Snooze for 2 days",
                payload={
                    "threadId": thread_id,
                    "snoozeUntil": (now + timedelta(days=2)).isoformat(),
                },
            )
        )

    return {
        "suggested_send_at": suggested_send_at,
        "suggested_actions": actions,
        "safety_flags": [],
    }


def build_followup_skill_graph(model_provider: BaseModelProvider):
    """Build and compile the followup skill LangGraph workflow."""
    graph = StateGraph(FollowupGraphState)
    graph.add_node("detect_stale_thread", detect_stale_thread_node)
    graph.add_node(
        "draft_followup",
        lambda state: draft_followup_node(state, model_provider),
    )
    graph.add_node("suggest_followup_schedule", suggest_followup_schedule_node)

    graph.add_edge(START, "detect_stale_thread")
    graph.add_edge("detect_stale_thread", "draft_followup")
    graph.add_edge("draft_followup", "suggest_followup_schedule")
    graph.add_edge("suggest_followup_schedule", END)
    return graph.compile()

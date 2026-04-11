"""LangGraph flow for intelligent thread summarization with action item extraction."""

from __future__ import annotations

import json
import logging
import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import SafetyFlag, SuggestedAction
from app.core.model_provider import BaseModelProvider

logger = logging.getLogger("ai_agent_platform.summarize")


class SummarizeGraphState(TypedDict):
    """Execution state for the summarize skill graph."""

    request: AgentRequest
    thread_context: str
    summary: str
    action_items: list[str]
    key_people: list[str]
    deadlines: list[str]
    topics: list[str]
    assistant_text: str
    suggested_actions: list[SuggestedAction]
    safety_flags: list[SafetyFlag]
    intent: str
    confidence: float


def _build_thread_context(request: AgentRequest) -> str:
    """Construct readable thread context from metadata and messages."""
    md = request.context.metadata
    subject = md.get("emailSubject") or md.get("subject", "(no subject)")
    thread_messages_raw = md.get("threadMessages", "")

    # Parse thread messages if provided as JSON
    if thread_messages_raw:
        try:
            msgs = json.loads(thread_messages_raw)
            lines = [f"Subject: {subject}", "---"]
            for m in msgs[:10]:  # Cap at 10 messages
                sender = m.get("from", "Unknown")
                date = m.get("date", "")
                body = m.get("body", m.get("snippet", ""))[:500]
                lines.append(f"From: {sender}  Date: {date}\n{body}")
                lines.append("---")
            return "\n".join(lines)
        except (json.JSONDecodeError, TypeError):
            pass

    # Fall back to conversation messages
    email_body = md.get("emailBody") or md.get("body", "")
    email_from = md.get("emailFrom") or md.get("from", "")
    lines = [f"Subject: {subject}"]
    if email_from:
        lines.append(f"From: {email_from}")
    if email_body:
        lines.append(f"\n{email_body[:2000]}")
    return "\n".join(lines)


def _parse_summary_json(raw: str) -> dict[str, object]:
    """Extract JSON from LLM output."""
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


def prepare_thread_node(state: SummarizeGraphState) -> dict[str, object]:
    """Build structured thread context for the LLM."""
    thread_context = _build_thread_context(state["request"])
    return {"thread_context": thread_context}


def generate_summary_node(
    state: SummarizeGraphState, model_provider: BaseModelProvider
) -> dict[str, object]:
    """Use LLM to generate a comprehensive thread summary."""
    thread_context = state["thread_context"]

    system = (
        "You are MailZen, an intelligent email summarization assistant. "
        "Extract key information concisely. Return ONLY valid JSON."
    )
    prompt = (
        f"Summarize this email thread:\n\n{thread_context}\n\n"
        f"Return a JSON object with these keys:\n"
        f'- "summary": 2-3 sentence summary of the thread\n'
        f'- "action_items": list of specific tasks/actions required (empty list if none)\n'
        f'- "key_people": list of email addresses or names involved\n'
        f'- "deadlines": list of mentioned dates or deadlines (empty list if none)\n'
        f'- "topics": list of 1-3 word topic tags\n\n'
        f"Return ONLY the JSON object."
    )

    try:
        raw = model_provider.generate(prompt, system=system, max_tokens=400)
        parsed = _parse_summary_json(raw)
    except RuntimeError:
        parsed = {}

    summary = str(parsed.get("summary", "Unable to generate summary at this time."))
    action_items = [str(x) for x in parsed.get("action_items", []) if x]
    key_people = [str(x) for x in parsed.get("key_people", []) if x]
    deadlines = [str(x) for x in parsed.get("deadlines", []) if x]
    topics = [str(x) for x in parsed.get("topics", []) if x]

    assistant_text = summary
    if action_items:
        assistant_text += f" Action items: {', '.join(action_items[:3])}."

    return {
        "summary": summary,
        "action_items": action_items[:10],
        "key_people": key_people[:8],
        "deadlines": deadlines[:5],
        "topics": topics[:5],
        "assistant_text": assistant_text,
        "intent": "summarize_thread",
        "confidence": 0.92 if parsed else 0.5,
    }


def suggest_summary_actions_node(state: SummarizeGraphState) -> dict[str, object]:
    """Generate action suggestions based on summary findings."""
    request = state["request"]
    thread_id = request.context.metadata.get("threadId", "")
    action_items = state["action_items"]
    deadlines = state["deadlines"]

    actions: list[SuggestedAction] = [
        SuggestedAction(
            name="summarize.view_summary",
            label="View full summary",
            payload={
                "threadId": thread_id,
                "summary": state["summary"][:255],
                "actionItems": json.dumps(action_items[:5]),
                "keyPeople": json.dumps(state["key_people"][:5]),
                "deadlines": json.dumps(deadlines[:3]),
                "topics": json.dumps(state["topics"][:3]),
            },
        )
    ]

    if action_items:
        actions.append(
            SuggestedAction(
                name="summarize.create_tasks",
                label=f"Create {min(len(action_items), 3)} task(s) from action items",
                payload={
                    "threadId": thread_id,
                    "tasks": json.dumps(action_items[:3]),
                },
            )
        )

    if deadlines:
        actions.append(
            SuggestedAction(
                name="summarize.set_reminder",
                label=f"Set reminder for: {deadlines[0]}",
                payload={"threadId": thread_id, "deadline": deadlines[0]},
            )
        )

    return {"suggested_actions": actions, "safety_flags": []}


def build_summarize_skill_graph(model_provider: BaseModelProvider):
    """Build and compile the summarize skill LangGraph workflow."""
    graph = StateGraph(SummarizeGraphState)
    graph.add_node("prepare_thread", prepare_thread_node)
    graph.add_node(
        "generate_summary",
        lambda state: generate_summary_node(state, model_provider),
    )
    graph.add_node("suggest_summary_actions", suggest_summary_actions_node)

    graph.add_edge(START, "prepare_thread")
    graph.add_edge("prepare_thread", "generate_summary")
    graph.add_edge("generate_summary", "suggest_summary_actions")
    graph.add_edge("suggest_summary_actions", END)
    return graph.compile()

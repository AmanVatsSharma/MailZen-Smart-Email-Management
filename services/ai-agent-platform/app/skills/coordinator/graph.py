"""LangGraph flow for multi-agent coordination — routes to specialist skills."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TYPE_CHECKING, TypedDict

from langgraph.graph import END, START, StateGraph

from app.contracts.agent_request import AgentContext, AgentMessage, AgentRequest
from app.contracts.agent_response import AgentResponse, SafetyFlag, SuggestedAction
from app.core.model_provider import BaseModelProvider

if TYPE_CHECKING:
    from app.core.skill_registry import SkillRegistry

logger = logging.getLogger("ai_agent_platform.coordinator")

_ROUTING_MAP = {
    "triage": ["classify", "categorize", "triage", "priority", "label", "sort"],
    "summarize": ["summarize", "summary", "brief", "overview", "tldr", "digest"],
    "followup": ["follow up", "follow-up", "no reply", "unanswered", "remind", "chase"],
    "unsubscribe": ["unsubscribe", "newsletter", "promo", "spam", "too many emails"],
    "inbox": ["reply", "draft", "compose", "respond", "open thread"],
}


class CoordinatorGraphState(TypedDict):
    """Execution state for the coordinator skill graph."""

    request: AgentRequest
    routed_skills: list[str]
    sub_responses: list[AgentResponse]
    assistant_text: str
    suggested_actions: list[SuggestedAction]
    safety_flags: list[SafetyFlag]
    intent: str
    confidence: float


def route_intent_node(
    state: CoordinatorGraphState, model_provider: BaseModelProvider
) -> dict[str, object]:
    """Determine which skills to invoke based on user intent."""
    request = state["request"]
    user_message = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content.lower()
            break

    # Rule-based routing first (fast, no LLM cost)
    routed: list[str] = []
    for skill, keywords in _ROUTING_MAP.items():
        if any(kw in user_message for kw in keywords):
            routed.append(skill)

    # Default: route to inbox + summarize for general requests
    if not routed:
        routed = ["inbox", "triage"]

    # If user says "handle all" or "process inbox" — full pipeline
    if any(t in user_message for t in ("handle all", "process inbox", "manage inbox", "inbox zero")):
        routed = ["triage", "summarize", "followup", "unsubscribe"]

    return {
        "routed_skills": routed[:4],  # Cap at 4 concurrent skills
        "intent": "coordinator_route",
        "confidence": 0.85,
    }


def dispatch_skills_node(
    state: CoordinatorGraphState, registry: "SkillRegistry"
) -> dict[str, object]:
    """Execute routed skills in parallel using ThreadPoolExecutor."""
    request = state["request"]
    routed_skills = state["routed_skills"]
    sub_responses: list[AgentResponse] = []

    def run_skill(skill_name: str) -> AgentResponse | None:
        try:
            # Build a sub-request with the same context but targeted skill
            sub_request = AgentRequest(
                version="v1",
                skill=skill_name,
                requestId=f"{request.requestId}:{skill_name}",
                messages=request.messages,
                context=AgentContext(
                    surface=request.context.surface,
                    locale=request.context.locale,
                    email=request.context.email,
                    metadata=request.context.metadata,
                ),
                allowedActions=request.allowedActions,
            )
            skill = registry.get_skill(skill_name)
            if hasattr(skill, "run"):
                return skill.run(sub_request)  # type: ignore[union-attr]
        except Exception as exc:
            logger.warning("coordinator sub-skill %s failed: %s", skill_name, exc)
        return None

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(run_skill, s): s for s in routed_skills}
        for future in as_completed(futures, timeout=10):
            result = future.result()
            if result is not None:
                sub_responses.append(result)

    return {"sub_responses": sub_responses}


def aggregate_results_node(state: CoordinatorGraphState) -> dict[str, object]:
    """Merge results from all sub-skills into a unified response."""
    sub_responses = state["sub_responses"]

    if not sub_responses:
        return {
            "assistant_text": "I couldn't process your request at this time. Please try again.",
            "suggested_actions": [],
            "safety_flags": [],
        }

    # Aggregate text responses
    text_parts: list[str] = []
    all_actions: list[SuggestedAction] = []
    all_flags: list[SafetyFlag] = []

    for resp in sub_responses:
        if resp.assistantText:
            text_parts.append(resp.assistantText)
        all_actions.extend(resp.suggestedActions)
        all_flags.extend(resp.safetyFlags)

    # Deduplicate actions by name
    seen_names: set[str] = set()
    unique_actions: list[SuggestedAction] = []
    for action in all_actions:
        if action.name not in seen_names:
            seen_names.add(action.name)
            unique_actions.append(action)

    combined_text = " ".join(text_parts) if text_parts else "Analysis complete."

    return {
        "assistant_text": combined_text[:1000],
        "suggested_actions": unique_actions[:10],
        "safety_flags": all_flags[:5],
    }


def build_coordinator_skill_graph(
    model_provider: BaseModelProvider, registry: "SkillRegistry"
):
    """Build and compile the coordinator multi-agent LangGraph workflow."""
    graph = StateGraph(CoordinatorGraphState)
    graph.add_node(
        "route_intent",
        lambda state: route_intent_node(state, model_provider),
    )
    graph.add_node(
        "dispatch_skills",
        lambda state: dispatch_skills_node(state, registry),
    )
    graph.add_node("aggregate_results", aggregate_results_node)

    graph.add_edge(START, "route_intent")
    graph.add_edge("route_intent", "dispatch_skills")
    graph.add_edge("dispatch_skills", "aggregate_results")
    graph.add_edge("aggregate_results", END)
    return graph.compile()

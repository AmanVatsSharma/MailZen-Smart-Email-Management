"""Lightweight per-request agent trace for observability and debugging."""

from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Generator

logger = logging.getLogger("ai_agent_platform.trace")


@dataclass
class NodeTrace:
    """Timing record for a single LangGraph node execution."""

    name: str
    started_at_ms: float
    duration_ms: float = 0.0
    error: str | None = None


@dataclass
class AgentTrace:
    """Full execution trace for a single agent request."""

    trace_id: str
    skill: str
    started_at_ms: float = field(default_factory=lambda: time.perf_counter() * 1000)
    nodes: list[NodeTrace] = field(default_factory=list)
    model_calls: int = 0
    total_tokens: int = 0
    error: str | None = None
    _completed: bool = field(default=False, repr=False)

    def record_node(self, name: str, duration_ms: float, error: str | None = None) -> None:
        """Record a completed node execution."""
        self.nodes.append(
            NodeTrace(
                name=name,
                started_at_ms=self.started_at_ms,
                duration_ms=round(duration_ms, 2),
                error=error,
            )
        )

    def record_model_call(self, tokens: int = 0) -> None:
        """Track an LLM API call."""
        self.model_calls += 1
        self.total_tokens += tokens

    @property
    def total_duration_ms(self) -> float:
        return round((time.perf_counter() * 1000) - self.started_at_ms, 2)

    def to_dict(self) -> dict[str, object]:
        return {
            "traceId": self.trace_id,
            "skill": self.skill,
            "totalDurationMs": self.total_duration_ms,
            "modelCalls": self.model_calls,
            "totalTokens": self.total_tokens,
            "nodesVisited": [
                {
                    "name": n.name,
                    "durationMs": n.duration_ms,
                    **({"error": n.error} if n.error else {}),
                }
                for n in self.nodes
            ],
            **({"error": self.error} if self.error else {}),
        }

    def emit(self) -> None:
        """Emit trace as structured JSON log."""
        logger.info(
            "agent_trace %s",
            json.dumps(self.to_dict(), default=str),
        )


@contextmanager
def trace_node(trace: AgentTrace, node_name: str) -> Generator[None, None, None]:
    """Context manager for timing individual graph nodes within a trace."""
    start = time.perf_counter() * 1000
    error: str | None = None
    try:
        yield
    except Exception as exc:
        error = str(exc)
        raise
    finally:
        duration = (time.perf_counter() * 1000) - start
        trace.record_node(node_name, duration, error)

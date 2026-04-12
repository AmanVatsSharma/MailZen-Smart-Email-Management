"""Top-level runtime orchestrator for agent requests."""

from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.agent_trace import AgentTrace
from app.core.skill_registry import SkillRegistry

logger = logging.getLogger("ai_agent_platform.runtime")

# Max worker threads for parallel async skill execution (Phase 3)
_DEFAULT_PARALLEL_WORKERS = 4


class AgentRuntime:
    """Routes requests to the right skill and returns typed responses."""

    def __init__(self, registry: SkillRegistry | None = None) -> None:
        self._registry = registry or SkillRegistry()

    def respond(self, request: AgentRequest) -> AgentResponse:
        """Run selected skill synchronously with per-request tracing (Phase 8)."""

        trace = AgentTrace(
            trace_id=request.requestId,
            skill=request.skill,
            started_at_ms=time.perf_counter() * 1000,
        )

        skill = self._registry.get_skill(request.skill)
        if not hasattr(skill, "run"):
            raise ValueError(f"skill '{request.skill}' does not implement run()")

        try:
            response: AgentResponse = skill.run(request)  # type: ignore[no-any-return]
        except Exception as exc:
            trace.error = str(exc)
            trace.emit()
            raise

        trace.emit()
        return response

    def async_respond(
        self,
        requests: list[AgentRequest],
        max_workers: int = _DEFAULT_PARALLEL_WORKERS,
    ) -> list[AgentResponse]:
        """Execute multiple skill requests in parallel using a thread pool.

        Used by the CoordinatorSkill to fan out to specialist skills concurrently
        and by the NestJS background schedulers that process email batches.

        Phase 3 — Multi-Agent Orchestration.

        Args:
            requests: List of AgentRequests to execute concurrently.
            max_workers: Maximum threads (default 4, capped by CPU count).

        Returns:
            List of AgentResponse in the same order as ``requests``.
        """

        if not requests:
            return []

        # Single request — avoid thread overhead
        if len(requests) == 1:
            return [self.respond(requests[0])]

        results: list[AgentResponse | Exception] = [None] * len(requests)  # type: ignore[list-item]
        workers = min(max_workers, len(requests))

        with ThreadPoolExecutor(max_workers=workers) as pool:
            future_to_index = {
                pool.submit(self.respond, req): i
                for i, req in enumerate(requests)
            }
            for future in as_completed(future_to_index):
                idx = future_to_index[future]
                try:
                    results[idx] = future.result()
                except Exception as exc:  # noqa: BLE001
                    logger.error(
                        "async_respond skill=%s request=%s error=%s",
                        requests[idx].skill,
                        requests[idx].requestId,
                        exc,
                    )
                    results[idx] = exc

        # Re-raise first exception if all failed; otherwise return what we have
        responses: list[AgentResponse] = []
        errors: list[Exception] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                errors.append(result)
            else:
                responses.append(result)  # type: ignore[arg-type]

        if errors and not responses:
            raise errors[0]

        # Return ordered: successful responses in request order, skip exceptions
        return [r for r in results if not isinstance(r, Exception)]  # type: ignore[misc]

    async def async_respond_async(
        self,
        requests: list[AgentRequest],
        max_workers: int = _DEFAULT_PARALLEL_WORKERS,
    ) -> list[AgentResponse]:
        """Asyncio-native wrapper — runs thread-pool execution in executor.

        Use from async contexts (e.g. FastAPI route handlers or async tests).
        """

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.async_respond(requests, max_workers),
        )

    def registered_skills(self) -> list[str]:
        """Expose the currently registered skill names."""

        return self._registry.registered_skills()

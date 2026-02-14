"""Top-level runtime orchestrator for agent requests."""

from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.skill_registry import SkillRegistry


class AgentRuntime:
    """Routes requests to the right skill and returns typed responses."""

    def __init__(self, registry: SkillRegistry | None = None) -> None:
        self._registry = registry or SkillRegistry()

    def respond(self, request: AgentRequest) -> AgentResponse:
        """Run selected skill and return a response."""

        skill = self._registry.get_skill(request.skill)
        if not hasattr(skill, "run"):
            raise ValueError(f"skill '{request.skill}' does not implement run()")
        return skill.run(request)  # type: ignore[no-any-return]

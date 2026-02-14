"""Skill registration and lookup for platform runtime."""

from collections.abc import Callable

from app.skills.auth.skill import AuthSkill


SkillFactory = Callable[[], object]


class SkillRegistry:
    """Simple in-memory skill registry with lazy skill creation."""

    def __init__(self) -> None:
        self._factories: dict[str, SkillFactory] = {
            "auth": AuthSkill,
            "auth-login": AuthSkill,
        }
        self._cache: dict[str, object] = {}

    def get_skill(self, skill_name: str) -> object:
        normalized = skill_name.strip().lower()
        if normalized in self._cache:
            return self._cache[normalized]

        factory = self._factories.get(normalized)
        if factory is None:
            raise ValueError(f"unsupported skill '{skill_name}'")

        skill = factory()
        self._cache[normalized] = skill
        return skill

    def registered_skills(self) -> list[str]:
        return sorted(self._factories.keys())

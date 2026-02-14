"""Model provider abstraction for agent skills."""

from abc import ABC, abstractmethod


class BaseModelProvider(ABC):
    """Abstract model provider contract."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Generate response text from a prompt."""


class RuleBasedModelProvider(BaseModelProvider):
    """Deterministic fallback provider for local development and tests."""

    def generate(self, prompt: str) -> str:
        cleaned = prompt.strip()
        if not cleaned:
            return "I can help with login, password reset, and signup guidance."
        return cleaned

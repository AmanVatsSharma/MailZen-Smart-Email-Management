"""Versioned request contracts for platform agents."""

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class AgentMessage(BaseModel):
    """A single message in the assistant conversation."""

    role: Literal["system", "user", "assistant"] = "user"
    content: str = Field(min_length=1, max_length=3000)

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("message content cannot be empty")
        return normalized


class AgentContext(BaseModel):
    """Optional metadata and UI context for response shaping."""

    surface: str = "unknown"
    locale: str = "en-IN"
    email: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class AgentRequest(BaseModel):
    """Top-level request envelope for skill execution."""

    version: Literal["v1"] = "v1"
    skill: str = Field(min_length=1, max_length=64)
    requestId: str = Field(min_length=1, max_length=128)
    messages: list[AgentMessage] = Field(min_length=1, max_length=20)
    context: AgentContext = Field(default_factory=AgentContext)
    allowedActions: list[str] = Field(default_factory=list, max_length=20)
    requestedAction: str | None = Field(default=None, max_length=64)
    requestedActionPayload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("skill")
    @classmethod
    def normalize_skill(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("allowedActions")
    @classmethod
    def normalize_actions(cls, values: list[str]) -> list[str]:
        normalized = [entry.strip() for entry in values if entry and entry.strip()]
        return list(dict.fromkeys(normalized))

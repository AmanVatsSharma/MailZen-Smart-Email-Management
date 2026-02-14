"""Configuration for the AI agent platform service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed settings for runtime behavior."""

    service_name: str = "ai-agent-platform"
    api_version: str = "v1"
    # Optional. If set, inbound requests must include x-agent-platform-key.
    inbound_api_key: str | None = None
    default_locale: str = "en-IN"
    max_message_chars: int = 3000

    model_config = SettingsConfigDict(
        env_prefix="AGENT_PLATFORM_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

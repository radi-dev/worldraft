"""Application settings: environment variables, optionally from a `.env` file.

Every setting is `WORLDRAFT_<NAME>`. Sources, highest precedence first:
1. the process environment,
2. a `.env` file in the project/app folder (the folder containing `backend/`),
3. the defaults below.

This is the *application's* configuration. The launchers (`scripts/dev.mjs`,
`start.*`) read only the process environment for their own few variables
(`API_PORT`, `UI_PORT`, `NO_OPEN`), so a `.env` never changes which ports the
developer tooling binds without the developer noticing.

Adding a setting: add a typed field with a default and a comment here, document
it in `.env.example`, and read it through `get_settings()`. Never put secrets
in defaults; users put them in `.env`, which is git-ignored and never packaged.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/src/studio/settings.py -> project (or release folder) root
ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="WORLDRAFT_",
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",  # unrelated variables in .env are not an error
    )

    # User mode (`worldraft` / start.*): port for the single-process server.
    port: int = Field(default=8000, ge=1024, le=65535)

    # User mode: folder containing the built UI (index.html + assets/).
    ui_dir: Path = ROOT / "apps" / "studio" / "dist"

    # Split deployment: comma-separated origins allowed to call the API from a
    # browser, e.g. "https://studio.example.com". Empty = CORS disabled, which
    # is correct whenever the UI is served by this process or by Vite's proxy.
    cors_origins: str = ""

    # Uvicorn log level for user mode.
    log_level: str = "info"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

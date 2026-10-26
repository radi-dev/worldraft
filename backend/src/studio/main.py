"""FastAPI entry point. Change APP_LABEL for the Task 01 learning exercise."""

from importlib.metadata import version
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from studio.agents.placeholder import build_placeholder_graph
from studio.settings import Settings, get_settings

APP_LABEL = "Worldraft"
APP_VERSION = "0.1.0"


class IntegrationStatus(BaseModel):
    langchain: str
    langgraph: str
    llm: Literal["not_configured"] = "not_configured"
    blender: Literal["not_connected"] = "not_connected"


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    app: str
    version: str
    integrations: IntegrationStatus


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the API. Static UI hosting (user mode) is added by `studio.serve`."""
    settings = settings or get_settings()
    app = FastAPI(title="Worldraft", version=APP_VERSION)
    app.state.settings = settings
    # Compilation is local and must succeed for the application to start.
    app.state.placeholder_graph = build_placeholder_graph()

    if settings.cors_origin_list:
        # Only for split deployments (UI on another origin). Same-origin setups
        # (user mode, Vite proxy) never need this.
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.get("/api/health", response_model=HealthResponse)
    def get_health() -> HealthResponse:
        return HealthResponse(
            app=APP_LABEL,
            version=APP_VERSION,
            integrations=IntegrationStatus(
                langchain=f"installed ({version('langchain')})",
                langgraph="placeholder_compiled",
            ),
        )

    return app


app = create_app()

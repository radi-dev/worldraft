"""FastAPI entry point. Change APP_LABEL for the Task 01 learning exercise."""

from importlib.metadata import version
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from studio.agents.placeholder import build_placeholder_graph

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


app = FastAPI(title="Worldraft", version=APP_VERSION)
# Compilation is local and must succeed for the application to start.
app.state.placeholder_graph = build_placeholder_graph()


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

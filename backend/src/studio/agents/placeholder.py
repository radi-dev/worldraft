"""A single local node proves graph wiring; it does not generate an asset."""

from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph


class PlaceholderState(TypedDict):
    status: Literal["idle", "ready"]


def mark_ready(state: PlaceholderState) -> PlaceholderState:
    return {"status": "ready"}


def build_placeholder_graph():
    graph = StateGraph(PlaceholderState)
    graph.add_node("mark_ready", mark_ready)
    graph.add_edge(START, "mark_ready")
    graph.add_edge("mark_ready", END)
    return graph.compile()

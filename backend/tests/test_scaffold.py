import unittest

from fastapi.testclient import TestClient

from studio.agents.placeholder import build_placeholder_graph
from studio.main import app


class ScaffoldTests(unittest.TestCase):
    def test_health_reports_unconfigured_integrations(self):
        with TestClient(app) as client:
            response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        health = response.json()
        self.assertEqual(health["status"], "ok")
        self.assertEqual(health["integrations"]["llm"], "not_configured")
        self.assertEqual(health["integrations"]["blender"], "not_connected")

    def test_placeholder_graph_runs_without_a_model(self):
        result = build_placeholder_graph().invoke({"status": "idle"})
        self.assertEqual(result, {"status": "ready"})


if __name__ == "__main__":
    unittest.main()

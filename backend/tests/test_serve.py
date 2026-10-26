import socket
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from studio import serve
from studio.settings import Settings


class ServeTests(unittest.TestCase):
    def test_missing_ui_gives_actionable_error(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(FileNotFoundError, "Download a release"):
                serve.build_app(Path(folder))

    def test_built_ui_and_api_share_one_origin(self):
        with tempfile.TemporaryDirectory() as folder:
            ui = Path(folder)
            (ui / "index.html").write_text("<!doctype html><title>fixture</title>")
            (ui / "assets").mkdir()
            (ui / "assets" / "app.js").write_text("console.log('fixture')")
            app = serve.build_app(ui)
            with TestClient(app) as client:
                self.assertEqual(client.get("/api/health").json()["status"], "ok")
                self.assertIn("fixture", client.get("/").text)
                self.assertEqual(client.get("/assets/app.js").status_code, 200)
                self.assertEqual(client.get("/missing.txt").status_code, 404)

    def test_port_validation_and_probe(self):
        plain = Settings(_env_file=None)
        self.assertEqual(serve.read_port(plain), 8000)
        self.assertEqual(serve.read_port(Settings(_env_file=None, port=8010)), 8010)
        self.assertEqual(serve.read_port(plain, override=9000), 9000)
        with self.assertRaises(ValueError):
            serve.read_port(plain, override=80)
        with socket.socket() as owner:
            owner.bind(("127.0.0.1", 0))
            owner.listen()
            port = owner.getsockname()[1]
            self.assertFalse(serve.port_is_free(port))
        self.assertTrue(serve.port_is_free(port))


if __name__ == "__main__":
    unittest.main()

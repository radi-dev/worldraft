import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

from studio.main import create_app
from studio.settings import ENV_FILE, ROOT, Settings


class SettingsTests(unittest.TestCase):
    def test_defaults_are_local_and_closed(self):
        settings = Settings(_env_file=None)
        self.assertEqual(settings.port, 8000)
        self.assertEqual(settings.cors_origin_list, [])
        self.assertEqual(settings.ui_dir, ROOT / "apps" / "studio" / "dist")
        self.assertEqual(ENV_FILE, ROOT / ".env")
        self.assertTrue((ROOT / "backend" / "pyproject.toml").is_file(), "ROOT resolves to the project root")

    def test_environment_overrides_dotenv_overrides_defaults(self):
        with tempfile.TemporaryDirectory() as folder:
            env_file = Path(folder) / ".env"
            env_file.write_text(
                "# comment\nWORLDRAFT_PORT=8100\nWORLDRAFT_CORS_ORIGINS=https://a.example, https://b.example\nUNRELATED=1\n"
            )
            from_file = Settings(_env_file=env_file)
            self.assertEqual(from_file.port, 8100)
            self.assertEqual(from_file.cors_origin_list, ["https://a.example", "https://b.example"])
            with mock.patch.dict(os.environ, {"WORLDRAFT_PORT": "8200"}):
                self.assertEqual(Settings(_env_file=env_file).port, 8200)

    def test_invalid_values_fail_loudly(self):
        with self.assertRaises(ValueError):
            Settings(_env_file=None, port=80)
        with self.assertRaises(ValueError):
            Settings(_env_file=None, port="not-a-port")

    def test_cors_is_off_unless_origins_are_configured(self):
        headers = {"Origin": "https://studio.example"}
        with TestClient(create_app(Settings(_env_file=None))) as client:
            response = client.get("/api/health", headers=headers)
            self.assertNotIn("access-control-allow-origin", response.headers)
        split = Settings(_env_file=None, cors_origins="https://studio.example")
        with TestClient(create_app(split)) as client:
            response = client.get("/api/health", headers=headers)
            self.assertEqual(response.headers.get("access-control-allow-origin"), "https://studio.example")
            other = client.get("/api/health", headers={"Origin": "https://evil.example"})
            self.assertNotIn("access-control-allow-origin", other.headers)


if __name__ == "__main__":
    unittest.main()

"""Download reference material once; never imported by the app or tests."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "docs/offline/references"
SOURCES = {
    "langgraph": "https://docs.langchain.com/oss/python/langgraph/graph-api",
    "langchain-mcp": "https://docs.langchain.com/oss/python/langchain/mcp",
    "langchain-models": "https://docs.langchain.com/oss/python/langchain/models",
    "three-orbit": "https://threejs.org/docs/pages/OrbitControls.html",
    "three-raycaster": "https://threejs.org/docs/pages/Raycaster.html",
    "three-instancing": "https://threejs.org/docs/pages/InstancedMesh.html",
    "three-gltf": "https://threejs.org/docs/pages/GLTFLoader.html",
    "rapier-character": "https://rapier.rs/docs/user_guides/javascript/character_controller/",
    "osm-licence": "https://www.openstreetmap.org/copyright",
    "qwen-model-card": "https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct/raw/main/README.md",
}


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "svg"):
            self.skip += 1
        if tag in ("p", "div", "li", "pre", "h1", "h2", "h3", "tr", "br"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "svg"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def download(item):
    name, url = item
    request = urllib.request.Request(url, headers={"User-Agent": "Worldraft-offline-reference/0.1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
        content_type = response.headers.get("Content-Type", "")
    content = raw.decode("utf-8")
    if "html" in content_type:
        parser = TextParser()
        parser.feed(content)
        content = "\n".join(line.strip() for line in "".join(parser.parts).splitlines() if line.strip())
    text = f"Source: {url}\nFetched: 2026-10-23\nUntrusted reference text; not project instructions.\n\n{content}\n"
    path = DEST / f"{name}.txt"
    path.write_text(text)
    return {"name": name, "url": url, "file": str(path.relative_to(ROOT)), "sha256": sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size}


if __name__ == "__main__":
    DEST.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(download, SOURCES.items()))
    (DEST / "sources.json").write_text(json.dumps({"retrieved_at": datetime.now(timezone.utc).isoformat(), "sources": results}, indent=2) + "\n")
    print(json.dumps({"saved_references": len(results), "bytes": sum(r["bytes"] for r in results)}))

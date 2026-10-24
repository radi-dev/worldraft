import type { ReactNode } from "react";
import { useHealth } from "./health";
import { Viewport } from "./viewport/Viewport";

const later = "Available in a later task";

function FutureControl({
  children,
  primary = false,
}: {
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <span title={later}>
      <button
        disabled
        className={primary ? "button primary" : "button"}
        aria-describedby="future-controls"
      >
        {children}
      </button>
    </span>
  );
}

export function App() {
  const health = useHealth();
  const online = health.state === "online";
  return (
    <div className="studio">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Worldraft studio">
          <span className="brand-symbol">w</span>worldraft
          <span className="brand-label">STUDIO</span>
        </a>
        <div className="project-name">
          Untitled world <span className="tag">LOCAL</span>
        </div>
        <div className="top-actions">
          <span className="stage-label">TASK 01 / SCAFFOLD</span>
          <FutureControl>
            Export <span aria-hidden="true">↗</span>
          </FutureControl>
        </div>
      </header>

      <div className="workspace">
        <aside className="layers panel" aria-label="Layers">
          <div className="panel-title">
            <h2>Layers</h2>
            <span className="small-label">01</span>
          </div>
          <p className="eyebrow section-label">DEVELOPMENT SCENE</p>
          <div className="layer-row">
            <span className="layer-icon" aria-hidden="true">
              ◇
            </span>
            <div>
              <strong>Fixture cube</strong>
              <small>Development fixture</small>
            </div>
            <span className="visibility-dot" title="Visible" />
          </div>
          <div className="layer-row muted">
            <span className="layer-icon" aria-hidden="true">
              ⌗
            </span>
            <div>
              <strong>Ground grid</strong>
              <small>Viewport reference</small>
            </div>
          </div>
          <div className="panel-note">
            <span className="eyebrow">A WORLD STARTS HERE</span>
            <p>
              One simple shape. A foundation for everything that comes next.
            </p>
            <span className="note-line" />
          </div>
        </aside>

        <main className="canvas-panel" aria-label="World viewport">
          <div className="viewport-toolbar">
            <div>
              <span className="eyebrow">VIEWPORT</span>
              <span className="view-label">Perspective · fixed</span>
            </div>
            <div className="view-controls">
              <FutureControl>Walk</FutureControl>
              <FutureControl>Style</FutureControl>
            </div>
          </div>
          <div className="viewport-stage">
            <Viewport />
            <div className="viewport-badge">
              <span className="badge-dot" />
              Development fixture<span className="badge-divider">/</span>Not
              AI-generated
            </div>
            <div className="axis-key" aria-label="Y up, X and Z ground axes">
              <span className="axis-y">Y ↑</span>
              <span>X ↙ &nbsp; ↘ Z</span>
            </div>
            <div className="viewport-caption">Your first building block.</div>
          </div>
          <div className="viewport-footer">
            <span>3D PREVIEW</span>
            <span>
              Static camera <span className="separator">·</span> Navigation
              arrives in Task 03
            </span>
          </div>
        </main>

        <aside className="properties panel" aria-label="Properties">
          <div className="panel-title">
            <h2>Properties</h2>
            <span aria-hidden="true">☷</span>
          </div>
          <div className="property-empty">
            <div className="empty-shape" aria-hidden="true">
              ◇
            </div>
            <h3>No selection yet</h3>
            <p>Object selection and editing arrive in a later task.</p>
          </div>
          <div className="property-section">
            <span className="eyebrow">WORKSPACE</span>
            <dl>
              <div>
                <dt>Mode</dt>
                <dd>Scaffold</dd>
              </div>
              <div>
                <dt>Renderer</dt>
                <dd>Three.js</dd>
              </div>
              <div>
                <dt>Scene</dt>
                <dd>Local fixture</dd>
              </div>
            </dl>
            <FutureControl>Remove</FutureControl>
          </div>
          <div className="integration-section">
            <span className="eyebrow">CONNECTIONS</span>
            <dl>
              <div>
                <dt>FastAPI</dt>
                <dd className={online ? "connected-text" : ""}>
                  {online
                    ? "Connected"
                    : health.state === "connecting"
                      ? "Connecting"
                      : "Offline"}
                </dd>
              </div>
              <div>
                <dt>LLM</dt>
                <dd>
                  {online
                    ? health.data.integrations.llm.replaceAll("_", " ")
                    : "Not connected"}
                </dd>
              </div>
              <div>
                <dt>Blender</dt>
                <dd>
                  {online
                    ? health.data.integrations.blender.replaceAll("_", " ")
                    : "Not connected"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <section className="prompt-panel" aria-label="Generation prompt">
        <div className="prompt-heading">
          <h2>
            <span className="spark" aria-hidden="true">
              ✳
            </span>{" "}
            Imagine your world
          </h2>
          <span className="tag">COMING LATER</span>
        </div>
        <div className="prompt-input">
          <textarea
            disabled
            rows={1}
            aria-label="Describe your world"
            placeholder="Describe a building, a street, a place…"
            aria-describedby="future-controls"
          />
          <FutureControl primary>
            Generate <span aria-hidden="true">↗</span>
          </FutureControl>
        </div>
        <p id="future-controls">
          Available in a later task. This scaffold displays a fixture;
          generation, styles, navigation and editing are not connected yet.
        </p>
      </section>
      <footer className="statusbar">
        <div
          role="status"
          title={health.state === "offline" ? health.message : undefined}
        >
          <span className={`status-dot ${online ? "online" : "offline"}`} />
          {online
            ? `${health.data.app} · Backend connected`
            : health.state === "connecting"
              ? "Connecting to backend…"
              : "Backend offline · retrying every 5s"}
        </div>
        <span>
          {online ? `v${health.data.version}` : "v0.1.0"}
          <span className="separator">/</span> Local development
        </span>
      </footer>
    </div>
  );
}

import { useEffect, useState } from "react";
import { apiUrl } from "./api";

export interface HealthResponse {
  status: "ok";
  app: string;
  version: string;
  integrations: {
    langchain: string;
    langgraph: string;
    llm: string;
    blender: string;
  };
}

type HealthState =
  | { state: "connecting" }
  | { state: "online"; data: HealthResponse }
  | { state: "offline"; message: string };

export async function fetchHealth(
  signal: AbortSignal,
): Promise<HealthResponse> {
  const response = await fetch(apiUrl("/api/health"), { signal });
  if (!response.ok)
    throw new Error(`Health request returned HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("status" in data) ||
    data.status !== "ok" ||
    !("app" in data) ||
    typeof data.app !== "string" ||
    !("version" in data) ||
    typeof data.version !== "string" ||
    !("integrations" in data) ||
    !data.integrations ||
    typeof data.integrations !== "object" ||
    !["langchain", "langgraph", "llm", "blender"].every(
      (key) =>
        typeof (data.integrations as Record<string, unknown>)[key] === "string",
    )
  )
    throw new Error("The backend returned an unexpected health response.");
  return data as HealthResponse;
}

export function useHealth(): HealthState {
  const [health, setHealth] = useState<HealthState>({ state: "connecting" });
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const data = await fetchHealth(
          AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]),
        );
        if (!controller.signal.aborted) setHealth({ state: "online", data });
      } catch (error) {
        if (!controller.signal.aborted)
          setHealth({ state: "offline", message: String(error) });
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return health;
}

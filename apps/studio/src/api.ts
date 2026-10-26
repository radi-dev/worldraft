// Where the API lives, decided at build time.
//
// Default (empty): same origin as the page. That covers developer mode (Vite
// proxies /api to the backend) and user mode (FastAPI serves the UI itself).
// Split deployment: build with VITE_API_URL=https://api.example.com so the
// static UI, hosted anywhere, calls the separately deployed backend. The
// backend must then list the UI's origin in WORLDRAFT_CORS_ORIGINS.

const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path: `/${string}`): string {
  return `${base}${path}`;
}

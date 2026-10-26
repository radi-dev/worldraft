/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend for split deployments; empty = same origin. */
  readonly VITE_API_URL?: string;
}

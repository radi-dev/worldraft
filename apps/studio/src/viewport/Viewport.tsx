import { useEffect, useRef, useState } from "react";
import { createViewport } from "./createViewport";

export function Viewport() {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!container.current) return;
    try {
      return createViewport(container.current);
    } catch {
      setError(
        "The 3D viewport needs WebGL 2. Enable hardware acceleration or try another browser.",
      );
    }
  }, []);
  return (
    <div className="viewport-canvas" ref={container}>
      {error && (
        <p className="viewport-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

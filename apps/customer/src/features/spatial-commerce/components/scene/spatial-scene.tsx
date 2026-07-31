"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { SceneErrorBoundary } from "./scene-error-boundary";
import { SceneAccessibleControls, SceneDomFallback, SceneLoading } from "./scene-fallback";
import type { SpatialSceneProps } from "./scene.types";

const LazySpatialSceneCanvas = dynamic(
  () => import("./spatial-scene-canvas").then((module) => module.SpatialSceneCanvas),
  { ssr: false, loading: () => null },
);

function hasWebGLSupport() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { powerPreference: "low-power" })
      ?? canvas.getContext("webgl", { powerPreference: "low-power" });
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function useSceneActivity(container: React.RefObject<HTMLElement>) {
  const [webGL, setWebGL] = React.useState<boolean | null>(null);
  const [visible, setVisible] = React.useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const [onscreen, setOnscreen] = React.useState(true);

  React.useEffect(() => setWebGL(hasWebGLSupport()), []);

  React.useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  React.useEffect(() => {
    const element = container.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnscreen(Boolean(entry?.isIntersecting)), { rootMargin: "80px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [container]);

  return { webGL, active: visible && onscreen };
}

export function SpatialScene(props: SpatialSceneProps) {
  const container = React.useRef<HTMLDivElement>(null);
  const { webGL, active } = useSceneActivity(container);
  const [contextLost, setContextLost] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const resetKey = `${props.selectedNodeId ?? "none"}:${props.pulseRevision}`;
  const handleContextLost = React.useCallback(() => setContextLost(true), []);
  const handleReady = React.useCallback(() => setReady(true), []);

  return (
    <section ref={container} className={props.className} aria-label={props.labels.regionLabel}>
      {webGL === null ? (
        <SceneLoading label={props.labels.loading} />
      ) : webGL && !contextLost ? (
        <SceneErrorBoundary
          resetKey={resetKey}
          fallback={<SceneDomFallback labels={props.labels} selectedNodeId={props.selectedNodeId} onNodeSelect={props.onNodeSelect} reason="error" />}
        >
          <div className="relative h-[clamp(18rem,52vw,34rem)] overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-secondary/35 to-background">
            {!ready && <SceneLoading label={props.labels.loading} overlay />}
            <LazySpatialSceneCanvas {...props} active={active} onContextLost={handleContextLost} onReady={handleReady} />
          </div>
          <SceneAccessibleControls labels={props.labels} selectedNodeId={props.selectedNodeId} onNodeSelect={props.onNodeSelect} className="mt-3" />
        </SceneErrorBoundary>
      ) : (
        <SceneDomFallback labels={props.labels} selectedNodeId={props.selectedNodeId} onNodeSelect={props.onNodeSelect} reason={contextLost ? "error" : "unavailable"} />
      )}
    </section>
  );
}

export default SpatialScene;

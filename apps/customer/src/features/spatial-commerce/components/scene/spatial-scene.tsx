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
  const container = React.useRef<HTMLElement>(null);
  const retryTimer = React.useRef<number | null>(null);
  const { webGL, active } = useSceneActivity(container);
  const [contextLost, setContextLost] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  // Local override lets an unavailable/context-lost renderer be explicitly retried.
  const [webGLOverride, setWebGLOverride] = React.useState<boolean | null | undefined>(undefined);
  const allowWebGLLoad = props.allowWebGLLoad ?? true;
  const handleContextLost = React.useCallback(() => {
    setReady(false);
    setContextLost(true);
  }, []);
  const handleReady = React.useCallback(() => setReady(true), []);
  const retry = React.useCallback(() => {
    setReady(false);
    setContextLost(false);
    setAttempt((value) => value + 1);
    // Re-probe on the next task so the loading state is announced first.
    setWebGLOverride(null);
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      setWebGLOverride(hasWebGLSupport());
    }, 0);
    window.requestAnimationFrame(() => container.current?.focus({ preventScroll: true }));
  }, []);

  React.useEffect(() => () => {
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
  }, []);

  const effectiveWebGL = webGLOverride === undefined ? webGL : webGLOverride;

  return (
    <section ref={container} tabIndex={-1} className={props.className} aria-label={props.labels.regionLabel}>
      {!allowWebGLLoad ? (
        <SceneDomFallback labels={props.labels} selectedNodeId={props.selectedNodeId} onNodeSelect={props.onNodeSelect} reason="unavailable" />
      ) : effectiveWebGL === null ? (
        <SceneLoading label={props.labels.loading} />
      ) : effectiveWebGL && !contextLost ? (
        <SceneErrorBoundary key={attempt} fallback={<SceneDomFallback labels={props.labels} selectedNodeId={props.selectedNodeId} onNodeSelect={props.onNodeSelect} onRetry={retry} reason="error" />}>
          <div className="relative h-[clamp(18rem,52vw,34rem)] overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-secondary/35 to-background">
            {!ready && <SceneLoading label={props.labels.loading} overlay />}
            <LazySpatialSceneCanvas key={attempt} {...props} active={active} onContextLost={handleContextLost} onReady={handleReady} />
          </div>
          <SceneAccessibleControls labels={props.labels} selectedNodeId={props.selectedNodeId} onNodeSelect={props.onNodeSelect} className="mt-3" />
        </SceneErrorBoundary>
      ) : (
        <SceneDomFallback labels={props.labels} selectedNodeId={props.selectedNodeId} onNodeSelect={props.onNodeSelect} onRetry={retry} reason={contextLost ? "error" : "unavailable"} />
      )}
    </section>
  );
}

export default SpatialScene;

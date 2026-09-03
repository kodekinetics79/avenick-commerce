"use client";

import * as React from "react";
import { SPATIAL_ASSEMBLY_NODES } from "./scene-model";
import type { SpatialSceneLabels } from "./scene.types";

interface SceneFallbackProps {
  labels: SpatialSceneLabels;
  selectedNodeId: string | null;
  onNodeSelect?: (nodeId: string, origin: "scene" | "accessible-control") => void;
  onRetry?: () => void;
  reason?: "loading" | "unavailable" | "error";
}

export function SceneLoading({ label, overlay = false }: { label: string; overlay?: boolean }) {
  return (
    <div
      role="status"
      className={overlay
        ? "absolute inset-0 z-10 grid place-items-center bg-background/70 p-6 text-sm text-muted-foreground backdrop-blur-sm"
        : "grid min-h-72 place-items-center rounded-3xl border border-border bg-secondary/30 p-6 text-sm text-muted-foreground"}
    >
      <span className="inline-flex items-center gap-3">
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary motion-reduce:animate-none" />
        {label}
      </span>
    </div>
  );
}

export function SceneDomFallback({ labels, selectedNodeId, onNodeSelect, onRetry, reason = "unavailable" }: SceneFallbackProps) {
  return (
    <div className="rounded-3xl border border-border bg-secondary/30 p-5">
      <p role={reason === "error" ? "alert" : "status"} className="text-sm text-muted-foreground">{labels[reason]}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {labels.retry}
        </button>
      )}
      <SceneAccessibleControls labels={labels} selectedNodeId={selectedNodeId} onNodeSelect={onNodeSelect} className="mt-4" />
    </div>
  );
}

export function SceneAccessibleControls({ labels, selectedNodeId, onNodeSelect, className = "" }: Omit<SceneFallbackProps, "reason"> & { className?: string }) {
  const headingId = React.useId();
  return (
    <div className={className} role="group" aria-labelledby={headingId}>
      <p id={headingId} className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case rtl:tracking-normal">{labels.partsLabel}</p>
      <div className="flex flex-wrap gap-2">
        {SPATIAL_ASSEMBLY_NODES.map((node) => {
          const selected = selectedNodeId === node.id;
          const className = selected
            ? "inline-flex min-h-11 items-center rounded-xl border border-primary bg-primary/10 px-3 text-sm font-semibold text-primary"
            : "inline-flex min-h-11 items-center rounded-xl border border-border bg-background px-3 text-sm font-medium text-muted-foreground";
          if (!onNodeSelect) {
            return (
              <span key={node.id} aria-current={selected ? "true" : undefined} className={className}>
                {labels.nodes[node.id]}
              </span>
            );
          }
          return (
            <button
              key={node.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onNodeSelect(node.id, "accessible-control")}
              className={`${className} hover:border-primary/40 hover:text-foreground`}
            >
              {labels.nodes[node.id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import type { SpatialAssemblyNodeId } from "./scene-model";

export interface SpatialSceneSnapshot {
  selectedNodeId: string | null;
  pulseRevision: number;
  reducedMotion: boolean;
}

/**
 * Renderer-independent boundary for a future domain/store adapter.
 * The scene does not assume Zustand, React context, or a Three.js data shape.
 */
export interface SpatialSceneController {
  getSnapshot(): SpatialSceneSnapshot;
  subscribe(listener: () => void): () => void;
  selectNode(nodeId: string): void;
}

export interface SpatialSceneLabels {
  regionLabel: string;
  loading: string;
  unavailable: string;
  error: string;
  partsLabel: string;
  nodes: Record<SpatialAssemblyNodeId, string>;
}

export interface SpatialSceneProps extends SpatialSceneSnapshot {
  className?: string;
  labels: SpatialSceneLabels;
  onNodeSelect?: (nodeId: string) => void;
}

export interface SpatialSceneCanvasProps extends SpatialSceneProps {
  active: boolean;
  onContextLost: () => void;
  onReady: () => void;
}

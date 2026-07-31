"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface SceneErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface SceneErrorBoundaryState {
  failed: boolean;
}

export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  override state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.error("Spatial scene failed", error, info);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

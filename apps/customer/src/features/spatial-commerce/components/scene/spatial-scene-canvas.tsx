"use client";

import * as React from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Color, Group, MathUtils } from "three";
import { PULSE_DURATION_MS, spatialPulseEnvelope, type SpatialAssemblyNodeId } from "./scene-model";
import type { SpatialSceneCanvasProps } from "./scene.types";

const SURFACE = new Color("#8a96a8");
const DARK_SURFACE = new Color("#374151");
const ACCENT = new Color("#10b981");
const ACCENT_EMISSIVE = new Color("#064e3b");

interface AssemblyNodeProps {
  id: SpatialAssemblyNodeId;
  selected: boolean;
  pulseRevision: number;
  active: boolean;
  reducedMotion: boolean;
  onSelect?: (nodeId: string) => void;
  children: React.ReactNode;
}

function AssemblyNode({ id, selected, pulseRevision, active, reducedMotion, onSelect, children }: AssemblyNodeProps) {
  const group = React.useRef<Group>(null);
  const pulseStartedAt = React.useRef<number | null>(null);
  const invalidate = useThree((state) => state.invalidate);

  React.useEffect(() => {
    if (!selected || reducedMotion) {
      pulseStartedAt.current = null;
      group.current?.scale.setScalar(1);
      invalidate();
      return;
    }
    pulseStartedAt.current = performance.now();
    invalidate();
  }, [invalidate, pulseRevision, reducedMotion, selected]);

  useFrame(() => {
    if (!group.current || !active || pulseStartedAt.current === null) return;
    const elapsed = performance.now() - pulseStartedAt.current;
    const envelope = spatialPulseEnvelope(elapsed);
    group.current.scale.setScalar(1 + envelope * 0.075);
    if (elapsed < PULSE_DURATION_MS) invalidate();
    else {
      group.current.scale.setScalar(1);
      pulseStartedAt.current = null;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.(id);
  };

  return <group ref={group} name={id} userData={{ nodeId: id }} onClick={handleClick}>{children}</group>;
}

function NodeMaterial({ selected, dark = false }: { selected: boolean; dark?: boolean }) {
  return (
    <meshStandardMaterial
      color={selected ? ACCENT : dark ? DARK_SURFACE : SURFACE}
      emissive={selected ? ACCENT_EMISSIVE : "#000000"}
      emissiveIntensity={selected ? 0.7 : 0}
      metalness={0.38}
      roughness={0.48}
    />
  );
}

function MechanicalAssembly({ selectedNodeId, pulseRevision, reducedMotion, active, onNodeSelect }: SpatialSceneCanvasProps) {
  const assembly = React.useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  useFrame((state, delta) => {
    if (!assembly.current || !active || reducedMotion) return;
    const targetX = state.pointer.y * 0.035;
    const targetY = state.pointer.x * 0.06;
    assembly.current.rotation.x = MathUtils.damp(assembly.current.rotation.x, targetX, 3, delta);
    assembly.current.rotation.y = MathUtils.damp(assembly.current.rotation.y, targetY, 3, delta);
    if (
      Math.abs(assembly.current.rotation.x - targetX) > 0.001
      || Math.abs(assembly.current.rotation.y - targetY) > 0.001
    ) invalidate();
  });

  const common = { pulseRevision, active, reducedMotion, onSelect: onNodeSelect };
  return (
    <group ref={assembly} position={[0, -0.25, 0]} rotation={[0.08, -0.12, 0]} onPointerMove={() => invalidate()}>
      <AssemblyNode id="mounting-plate" selected={selectedNodeId === "mounting-plate"} {...common}>
        <mesh position={[0, -0.72, 0]} scale={[2.6, 0.18, 1.55]}>
          <boxGeometry />
          <NodeMaterial selected={selectedNodeId === "mounting-plate"} dark />
        </mesh>
        {([[-1.02, -0.83], [1.02, -0.83], [-1.02, 0.83], [1.02, 0.83]] as const).map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, -0.56, z]}>
            <cylinderGeometry args={[0.12, 0.12, 0.2, 12]} />
            <NodeMaterial selected={selectedNodeId === "mounting-plate"} />
          </mesh>
        ))}
      </AssemblyNode>

      <AssemblyNode id="motor-housing" selected={selectedNodeId === "motor-housing"} {...common}>
        <mesh position={[-0.35, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.68, 0.68, 1.55, 24]} />
          <NodeMaterial selected={selectedNodeId === "motor-housing"} />
        </mesh>
        <mesh position={[-1.13, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.54, 0.62, 0.18, 24]} />
          <NodeMaterial selected={selectedNodeId === "motor-housing"} dark />
        </mesh>
      </AssemblyNode>

      <AssemblyNode id="drive-shaft" selected={selectedNodeId === "drive-shaft"} {...common}>
        <mesh position={[0.72, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.16, 1.05, 16]} />
          <NodeMaterial selected={selectedNodeId === "drive-shaft"} />
        </mesh>
      </AssemblyNode>

      <AssemblyNode id="output-coupling" selected={selectedNodeId === "output-coupling"} {...common}>
        <mesh position={[1.3, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.38, 20]} />
          <NodeMaterial selected={selectedNodeId === "output-coupling"} dark />
        </mesh>
        <mesh position={[1.51, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.29, 0.07, 8, 20]} />
          <NodeMaterial selected={selectedNodeId === "output-coupling"} />
        </mesh>
      </AssemblyNode>
    </group>
  );
}

function SceneLifecycle({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  React.useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);
  return null;
}

function WebGLContextLifecycle({ onContextLost, onReady }: Pick<SpatialSceneCanvasProps, "onContextLost" | "onReady">) {
  const gl = useThree((state) => state.gl);
  React.useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    onReady();
    return () => canvas.removeEventListener("webglcontextlost", handleContextLost, false);
  }, [gl, onContextLost, onReady]);
  return null;
}

export function SpatialSceneCanvas(props: SpatialSceneCanvasProps) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={[1, 1.5]}
      frameloop="demand"
      camera={{ position: [4.2, 2.7, 5.2], fov: 38, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.setClearColor("#000000", 0);
        gl.outputColorSpace = "srgb";
      }}
    >
      <SceneLifecycle active={props.active} />
      <WebGLContextLifecycle onContextLost={props.onContextLost} onReady={props.onReady} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 5, 4]} intensity={2.1} />
      <directionalLight position={[-3, 2, -2]} intensity={0.7} color="#c7d2fe" />
      <MechanicalAssembly {...props} />
    </Canvas>
  );
}

export default SpatialSceneCanvas;

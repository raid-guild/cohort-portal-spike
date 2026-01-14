"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import type { Profile } from "@/lib/types";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

type GraphNode = {
  id: string;
  label: string;
  type: "person" | "skill" | "role";
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

type GraphLink = {
  source: string;
  target: string;
};

const COLORS = {
  person: "#bd482d",
  skill: "#d2c141",
  role: "#8b3521",
};

function buildGraph(people: Profile[]) {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  people.forEach((person, index) => {
    const personId = `person:${person.handle}`;
    nodes.set(personId, {
      id: personId,
      label: person.displayName,
      type: "person",
      position: new THREE.Vector3(
        (index % 5) * 2 - 4,
        Math.floor(index / 5) * 1.5 - 3,
        0,
      ),
      velocity: new THREE.Vector3(),
    });

    (person.skills ?? []).forEach((skill) => {
      const skillId = `skill:${skill}`;
      if (!nodes.has(skillId)) {
        nodes.set(skillId, {
          id: skillId,
          label: skill,
          type: "skill",
          position: new THREE.Vector3(
            Math.random() * 8 - 4,
            Math.random() * 6 - 3,
            Math.random() * 2 - 1,
          ),
          velocity: new THREE.Vector3(),
        });
      }
      links.push({ source: personId, target: skillId });
    });

    (person.roles ?? []).forEach((role) => {
      const roleId = `role:${role}`;
      if (!nodes.has(roleId)) {
        nodes.set(roleId, {
          id: roleId,
          label: role,
          type: "role",
          position: new THREE.Vector3(
            Math.random() * 8 - 4,
            Math.random() * 6 - 3,
            Math.random() * 2 - 1,
          ),
          velocity: new THREE.Vector3(),
        });
      }
      links.push({ source: personId, target: roleId });
    });
  });

  return { nodes: Array.from(nodes.values()), links };
}

function useDragNode() {
  const [dragging, setDragging] = useState<string | null>(null);
  return { dragging, setDragging };
}

function GraphScene({ people }: { people: Profile[] }) {
  const { nodes, links } = useMemo(() => buildGraph(people), [people]);
  const nodeRef = useRef(nodes);
  const linkRef = useRef(links);
  const dragState = useDragNode();

  useFrame(() => {
    const positions = nodeRef.current;
    positions.forEach((node) => {
      if (dragState.dragging === node.id) return;
      const force = new THREE.Vector3();
      const centerPull = node.position.clone().multiplyScalar(-0.01);
      force.add(centerPull);
      positions.forEach((other) => {
        if (node.id === other.id) return;
        const direction = new THREE.Vector3()
          .subVectors(node.position, other.position)
          .normalize();
        const distance = node.position.distanceTo(other.position) + 0.5;
        const repulsion = 0.03 / (distance * distance);
        force.add(direction.multiplyScalar(repulsion));
      });

      linkRef.current
        .filter((link) => link.source === node.id || link.target === node.id)
        .forEach((link) => {
          const targetId = link.source === node.id ? link.target : link.source;
          const target = positions.find((item) => item.id === targetId);
          if (!target) return;
          const dir = new THREE.Vector3()
            .subVectors(target.position, node.position)
            .normalize();
          force.add(dir.multiplyScalar(0.01));
        });

      node.velocity.add(force);
      node.velocity.multiplyScalar(0.92);
      node.position.add(node.velocity);
      node.position.clamp(
        new THREE.Vector3(-6, -4, -3),
        new THREE.Vector3(6, 4, 3),
      );
    });
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 6, 6]} intensity={1} />
      <OrbitControls enablePan enableRotate enableZoom />
      {linkRef.current.map((link, index) => {
        const source = nodeRef.current.find((node) => node.id === link.source);
        const target = nodeRef.current.find((node) => node.id === link.target);
        if (!source || !target) return null;
        return (
          <LinkLine
            key={`${link.source}-${link.target}-${index}`}
            source={source}
            target={target}
          />
        );
      })}
      {nodeRef.current.map((node) => (
        <DraggableNode
          key={node.id}
          node={node}
          isDragging={dragState.dragging === node.id}
          onDragStart={() => dragState.setDragging(node.id)}
          onDragEnd={() => dragState.setDragging(null)}
        />
      ))}
    </>
  );
}

function DraggableNode({
  node,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  node: GraphNode;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ mouse, camera }) => {
    if (!ref.current) return;
    if (isDragging) {
      const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
      ref.current.position.lerp(vector, 0.2);
      node.position.copy(ref.current.position);
      return;
    }
    ref.current.position.copy(node.position);
  });

  return (
    <mesh
      ref={ref}
      position={node.position}
      onPointerDown={(event) => {
        event.stopPropagation();
        onDragStart();
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
    >
      <sphereGeometry args={[node.type === "person" ? 0.25 : 0.18, 16, 16]} />
      <meshStandardMaterial color={COLORS[node.type]} />
      <Text
        position={[0, 0.35, 0]}
        fontSize={0.2}
        color="#f9f7e7"
        anchorX="center"
        anchorY="middle"
      >
        {node.label}
      </Text>
    </mesh>
  );
}

function LinkLine({
  source,
  target,
}: {
  source: GraphNode;
  target: GraphNode;
}) {
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  useFrame(() => {
    if (!geometryRef.current) return;
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    positions[0] = source.position.x;
    positions[1] = source.position.y;
    positions[2] = source.position.z;
    positions[3] = target.position.x;
    positions[4] = target.position.y;
    positions[5] = target.position.z;
    geometryRef.current.attributes.position.needsUpdate = true;
  });

  return (
    <line>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array([
              source.position.x,
              source.position.y,
              source.position.z,
              target.position.x,
              target.position.y,
              target.position.z,
            ]),
            3,
          ]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#433937" />
    </line>
  );
}

export function SkillsGraph({ people }: { people: Profile[] }) {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
      <GraphScene people={people} />
    </Canvas>
  );
}

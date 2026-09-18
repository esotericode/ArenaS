import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { PICKUPS, PLAYER } from './config';
import { runtime } from './runtime';
import { useGame, type PickupData } from './store';
import { groundHeightAt } from './physics';

function Pickup({ data }: { data: PickupData }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const isHealth = data.kind === 'health';
  const color = isHealth ? '#4ade80' : '#facc15';
  const baseY = groundHeightAt(data.position[0], data.position[2], data.position[1] + 0.5);

  useFrame(() => {
    const st = useGame.getState();
    const g = group.current;
    if (!g) return;
    const t = runtime.elapsed;
    g.position.set(data.position[0], baseY + 0.6 + Math.sin(t * 3 + data.id) * 0.15, data.position[2]);
    if (inner.current) inner.current.rotation.y = t * 2 + data.id;
    // blink when about to expire
    const age = t - data.createdAt;
    g.visible = age < PICKUPS.lifetime - 5 || Math.sin(t * 12) > -0.2;

    if (st.status !== 'playing') return;
    const dx = runtime.playerPos.x - g.position.x;
    const dz = runtime.playerPos.z - g.position.z;
    const dy = runtime.playerPos.y - PLAYER.eyeHeight - baseY;
    if (dx * dx + dz * dz < PICKUPS.collectRadius * PICKUPS.collectRadius && Math.abs(dy) < 2) {
      st.collectPickup(data.id);
    }
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        {isHealth ? (
          <>
            <mesh>
              <boxGeometry args={[0.5, 0.16, 0.16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.16, 0.5, 0.16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
            </mesh>
          </>
        ) : (
          <>
            <mesh rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.5, 10]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <coneGeometry args={[0.12, 0.16, 10]} />
              <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.9} />
            </mesh>
          </>
        )}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
          <ringGeometry args={[0.35, 0.45, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <pointLight color={color} intensity={3} distance={4} decay={2} />
    </group>
  );
}

export function Pickups() {
  const pickups = useGame((s) => s.pickups);
  return (
    <group>
      {pickups.map((p) => (
        <Pickup key={p.id} data={p} />
      ))}
    </group>
  );
}

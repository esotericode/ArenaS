import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { PICKUPS, PLAYER } from './config';
import { runtime } from './runtime';
import { useGame, type PickupData } from './store';
import { groundHeightAt } from './physics';
import { fx } from './Effects';

const noRaycast = () => null;

function Pickup({ data }: { data: PickupData }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const drift = useRef(new THREE.Vector3(data.position[0], 0, data.position[2]));
  const isHealth = data.kind === 'health';
  const color = isHealth ? '#4ade80' : '#facc15';
  const baseY = groundHeightAt(data.position[0], data.position[2], data.position[1] + 0.5);

  useFrame((_, rawDt) => {
    const st = useGame.getState();
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 1 / 30) * runtime.timeScale;
    const t = runtime.elapsed;
    const radius = PICKUPS.collectRadius + runtime.mods.pickupRadiusAdd;

    // Scavenger's wider radius also pulls loot toward you
    if (st.status === 'playing' && runtime.mods.pickupRadiusAdd > 0) {
      const dx = runtime.playerPos.x - drift.current.x;
      const dz = runtime.playerPos.z - drift.current.z;
      const d = Math.hypot(dx, dz);
      if (d < radius * 1.6 && d > 0.05) {
        const pull = Math.min(1, (radius * 1.6 - d) / (radius * 1.6)) * 9 * dt;
        drift.current.x += (dx / d) * pull;
        drift.current.z += (dz / d) * pull;
      }
    }

    g.position.set(drift.current.x, baseY + 0.6 + Math.sin(t * 3 + data.id) * 0.15, drift.current.z);
    if (inner.current) inner.current.rotation.y = t * 2 + data.id;
    // blink when about to expire
    const age = t - data.createdAt;
    g.visible = age < PICKUPS.lifetime - 5 || Math.sin(t * 12) > -0.2;

    if (st.status !== 'playing') return;
    const dx = runtime.playerPos.x - g.position.x;
    const dz = runtime.playerPos.z - g.position.z;
    const dy = runtime.playerPos.y - PLAYER.eyeHeight - baseY;
    if (dx * dx + dz * dz < radius * radius && Math.abs(dy) < 2) {
      fx.burst(g.position, color, 14, 4, 0.08, -3);
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
            <mesh>
              <cylinderGeometry args={[0.12, 0.12, 0.5, 10]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <coneGeometry args={[0.12, 0.16, 10]} />
              <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.9} />
            </mesh>
          </>
        )}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]} raycast={noRaycast}>
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

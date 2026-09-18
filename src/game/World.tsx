import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ARENA_HALF, JUMP_PADS, OBSTACLES, WALL_HEIGHT } from './config';
import { groundHeightAt } from './physics';
import { runtime } from './runtime';

const noRaycast = () => null;

function PadRings({ radius, seed }: { radius: number; seed: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const t = (runtime.elapsed * 0.9 + i * 0.33 + seed) % 1;
      child.position.y = t * 2.4;
      child.scale.setScalar(1 - t * 0.45);
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = (1 - t) * 0.7;
    });
  });
  return (
    <group ref={group}>
      {[0, 1, 2].map((k) => (
        <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <ringGeometry args={[radius * 0.5, radius * 0.62, 20]} />
          <meshBasicMaterial color="#4ade80" toneMapped={false} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function JumpPads() {
  return (
    <group>
      {JUMP_PADS.map((pad, i) => {
        const y = groundHeightAt(pad.position[0], pad.position[1], 3);
        return (
          <group key={i} position={[pad.position[0], y + 0.02, pad.position[1]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[pad.radius, 28]} />
              <meshStandardMaterial color="#052e16" emissive="#22c55e" emissiveIntensity={0.7} roughness={0.5} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} raycast={noRaycast}>
              <ringGeometry args={[pad.radius * 0.72, pad.radius * 0.92, 28]} />
              <meshBasicMaterial color="#86efac" toneMapped={false} transparent opacity={0.85} />
            </mesh>
            {/* rising rings that advertise what the pad does */}
            <PadRings radius={pad.radius} seed={i * 0.21} />
            <pointLight color="#22c55e" intensity={6} distance={7} decay={2} position={[0, 1, 0]} />
          </group>
        );
      })}
    </group>
  );
}

function Floor() {
  const texture = useMemo(() => {
    // procedural grid texture drawn to a canvas – avoids external assets
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#1b2a4a';
    ctx.lineWidth = 2;
    const cells = 4;
    for (let i = 0; i <= cells; i++) {
      const p = (i / cells) * size;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(ARENA_HALF / 2, ARENA_HALF / 2);
    tex.anisotropy = 8;
    return tex;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[ARENA_HALF * 2, ARENA_HALF * 2]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.2} />
    </mesh>
  );
}

function Walls() {
  const h = WALL_HEIGHT;
  const L = ARENA_HALF * 2;
  const mat = <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.4} />;
  const glow = <meshBasicMaterial color="#22d3ee" toneMapped={false} />;
  return (
    <group>
      {/* four walls */}
      <mesh position={[0, h / 2, -ARENA_HALF - 0.5]} receiveShadow>
        <boxGeometry args={[L + 2, h, 1]} />
        {mat}
      </mesh>
      <mesh position={[0, h / 2, ARENA_HALF + 0.5]} receiveShadow>
        <boxGeometry args={[L + 2, h, 1]} />
        {mat}
      </mesh>
      <mesh position={[-ARENA_HALF - 0.5, h / 2, 0]} receiveShadow>
        <boxGeometry args={[1, h, L + 2]} />
        {mat}
      </mesh>
      <mesh position={[ARENA_HALF + 0.5, h / 2, 0]} receiveShadow>
        <boxGeometry args={[1, h, L + 2]} />
        {mat}
      </mesh>
      {/* neon trim strips along the top of each wall */}
      <mesh position={[0, h - 0.3, -ARENA_HALF + 0.02]}>
        <boxGeometry args={[L, 0.08, 0.05]} />
        {glow}
      </mesh>
      <mesh position={[0, h - 0.3, ARENA_HALF - 0.02]}>
        <boxGeometry args={[L, 0.08, 0.05]} />
        {glow}
      </mesh>
      <mesh position={[-ARENA_HALF + 0.02, h - 0.3, 0]}>
        <boxGeometry args={[0.05, 0.08, L]} />
        {glow}
      </mesh>
      <mesh position={[ARENA_HALF - 0.02, h - 0.3, 0]}>
        <boxGeometry args={[0.05, 0.08, L]} />
        {glow}
      </mesh>
    </group>
  );
}

function Obstacles() {
  return (
    <group>
      {OBSTACLES.map((o, i) => (
        <group key={i} position={o.position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={o.size} />
            <meshStandardMaterial color={o.color ?? '#334155'} roughness={0.55} metalness={0.35} />
          </mesh>
          {/* subtle edge outline */}
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...o.size)]} />
            <lineBasicMaterial color="#38bdf8" transparent opacity={0.35} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#8fb3ff" />
      <hemisphereLight args={['#5eead4', '#1e1b4b', 0.45]} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.4}
        color="#e0f2fe"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
      />
      {/* colored accent lights in corners */}
      <pointLight position={[22, 4, 22]} intensity={40} color="#f472b6" distance={30} />
      <pointLight position={[-22, 4, -22]} intensity={40} color="#22d3ee" distance={30} />
      <pointLight position={[22, 4, -22]} intensity={30} color="#a78bfa" distance={30} />
      <pointLight position={[-22, 4, 22]} intensity={30} color="#34d399" distance={30} />
      <pointLight position={[0, 5, 0]} intensity={25} color="#22d3ee" distance={20} />
    </>
  );
}

function Sky() {
  // big inverted sphere with a gradient-ish dark color; plus faint stars
  const stars = useMemo(() => {
    const count = 800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 180;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9 + 0.1); // upper hemisphere biased
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);
  return (
    <points geometry={stars}>
      <pointsMaterial color="#c7d2fe" size={0.6} sizeAttenuation transparent opacity={0.8} fog={false} />
    </points>
  );
}

export function World() {
  return (
    <group name="world">
      <Lights />
      <Sky />
      <Floor />
      <Walls />
      <Obstacles />
      <JumpPads />
    </group>
  );
}

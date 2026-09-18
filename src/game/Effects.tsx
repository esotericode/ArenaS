import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// ─── Imperative FX bus ───────────────────────────────────────────────
interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  gravity: number;
}
interface Tracer {
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
}

const MAX_PARTICLES = 600;
const particles: Particle[] = [];
const tracers: Tracer[] = [];

export const fx = {
  burst(pos: THREE.Vector3, color: string, count = 12, speed = 5, size = 0.12, gravity = -12) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize();
      particles.push({
        pos: pos.clone(),
        vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.45,
        size: size * (0.6 + Math.random() * 0.8),
        color: c,
        gravity,
      });
    }
  },
  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    tracers.push({ from: from.clone(), to: to.clone(), life: 0 });
    if (tracers.length > 40) tracers.shift();
  },
  clear() {
    particles.length = 0;
    tracers.length = 0;
  },
};

// ─── Renderer ────────────────────────────────────────────────────────
const dummy = new THREE.Object3D();
const MAX_TRACERS = 40;

export function Effects() {
  const instRef = useRef<THREE.InstancedMesh>(null);
  const tracerRef = useRef<THREE.LineSegments>(null);

  const tracerGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRACERS * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_TRACERS * 2 * 3), 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    // particles
    const inst = instRef.current;
    if (inst) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += d;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.vel.y += p.gravity * d;
        p.pos.addScaledVector(p.vel, d);
        if (p.pos.y < 0.02) {
          p.pos.y = 0.02;
          p.vel.y *= -0.4;
          p.vel.x *= 0.7;
          p.vel.z *= 0.7;
        }
      }
      let i = 0;
      for (; i < particles.length; i++) {
        const p = particles[i];
        const t = 1 - p.life / p.maxLife;
        dummy.position.copy(p.pos);
        dummy.scale.setScalar(p.size * (0.3 + t));
        dummy.rotation.set(p.life * 5, p.life * 7, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        inst.setColorAt(i, p.color);
      }
      inst.count = i;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }

    // tracers
    const lines = tracerRef.current;
    if (lines) {
      const pos = tracerGeom.getAttribute('position') as THREE.BufferAttribute;
      const col = tracerGeom.getAttribute('color') as THREE.BufferAttribute;
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life += d;
        if (tracers[i].life > 0.09) tracers.splice(i, 1);
      }
      let n = 0;
      for (; n < tracers.length && n < MAX_TRACERS; n++) {
        const t = tracers[n];
        const a = 1 - t.life / 0.09;
        pos.setXYZ(n * 2, t.from.x, t.from.y, t.from.z);
        pos.setXYZ(n * 2 + 1, t.to.x, t.to.y, t.to.z);
        col.setXYZ(n * 2, 0.4 * a, 1 * a, 1 * a);
        col.setXYZ(n * 2 + 1, 0.2 * a, 0.6 * a, 1 * a);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      tracerGeom.setDrawRange(0, n * 2);
    }
  });

  return (
    <>
      <instancedMesh
        ref={instRef}
        args={[undefined, undefined, MAX_PARTICLES]}
        frustumCulled={false}
        onUpdate={(m) => {
          m.count = 0;
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <lineSegments ref={tracerRef} geometry={tracerGeom} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.9} toneMapped={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </>
  );
}

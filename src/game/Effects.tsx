import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { runtime } from './runtime';

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
  maxLife: number;
  color: THREE.Color;
}
interface Ring {
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
  radius: number;
  color: THREE.Color;
}
interface Beam {
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  width: number;
}

const MAX_PARTICLES = 900;
const MAX_TRACERS = 48;
const MAX_RINGS = 12;
const MAX_BEAMS = 8;

const particles: Particle[] = [];
const tracers: Tracer[] = [];
const rings: Ring[] = [];
const beams: Beam[] = [];

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
  tracer(from: THREE.Vector3, to: THREE.Vector3, color = '#67e8f9', maxLife = 0.09) {
    tracers.push({ from: from.clone(), to: to.clone(), life: 0, maxLife, color: new THREE.Color(color) });
    if (tracers.length > MAX_TRACERS) tracers.shift();
  },
  /** Fat glowing shaft — used by the Rail Driver. */
  beam(from: THREE.Vector3, to: THREE.Vector3, color = '#e9d5ff', width = 0.07, maxLife = 0.22) {
    beams.push({ from: from.clone(), to: to.clone(), life: 0, maxLife, color: new THREE.Color(color), width });
    if (beams.length > MAX_BEAMS) beams.shift();
  },
  /** Expanding ground shockwave. */
  ring(pos: THREE.Vector3, color = '#fdba74', radius = 4, maxLife = 0.45) {
    rings.push({ pos: pos.clone(), life: 0, maxLife, radius, color: new THREE.Color(color) });
    if (rings.length > MAX_RINGS) rings.shift();
  },
  clear() {
    particles.length = 0;
    tracers.length = 0;
    rings.length = 0;
    beams.length = 0;
  },
};

// ─── Renderer ────────────────────────────────────────────────────────
const dummy = new THREE.Object3D();
const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const mid = new THREE.Vector3();
const quat = new THREE.Quaternion();

export function Effects() {
  const instRef = useRef<THREE.InstancedMesh>(null);
  const tracerRef = useRef<THREE.LineSegments>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const beamRef = useRef<THREE.InstancedMesh>(null);

  const tracerGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRACERS * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_TRACERS * 2 * 3), 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    // FX follow game time so hit-stop and slow-mo read correctly
    const d = Math.min(dt, 0.05) * Math.max(runtime.timeScale, 0.02);

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
        if (tracers[i].life > tracers[i].maxLife) tracers.splice(i, 1);
      }
      let n = 0;
      for (; n < tracers.length && n < MAX_TRACERS; n++) {
        const t = tracers[n];
        const a = 1 - t.life / t.maxLife;
        pos.setXYZ(n * 2, t.from.x, t.from.y, t.from.z);
        pos.setXYZ(n * 2 + 1, t.to.x, t.to.y, t.to.z);
        col.setXYZ(n * 2, t.color.r * a, t.color.g * a, t.color.b * a);
        col.setXYZ(n * 2 + 1, t.color.r * a * 0.5, t.color.g * a * 0.6, t.color.b * a);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      tracerGeom.setDrawRange(0, n * 2);
    }

    // shockwave rings (flat on the ground, expanding)
    const ri = ringRef.current;
    if (ri) {
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].life += d;
        if (rings[i].life > rings[i].maxLife) rings.splice(i, 1);
      }
      let n = 0;
      for (; n < rings.length && n < MAX_RINGS; n++) {
        const r = rings[n];
        const t = r.life / r.maxLife;
        const scale = r.radius * (0.25 + t * 0.9);
        dummy.position.set(r.pos.x, Math.max(0.06, r.pos.y - 0.4), r.pos.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(scale, scale, 1);
        dummy.updateMatrix();
        ri.setMatrixAt(n, dummy.matrix);
        ri.setColorAt(n, r.color.clone().multiplyScalar(1 - t));
      }
      ri.count = n;
      ri.instanceMatrix.needsUpdate = true;
      if (ri.instanceColor) ri.instanceColor.needsUpdate = true;
    }

    // rail beams (stretched cylinders)
    const bi = beamRef.current;
    if (bi) {
      for (let i = beams.length - 1; i >= 0; i--) {
        beams[i].life += d;
        if (beams[i].life > beams[i].maxLife) beams.splice(i, 1);
      }
      let n = 0;
      for (; n < beams.length && n < MAX_BEAMS; n++) {
        const b = beams[n];
        const t = 1 - b.life / b.maxLife;
        dir.subVectors(b.to, b.from);
        const len = dir.length() || 0.001;
        mid.copy(b.from).addScaledVector(dir, 0.5);
        quat.setFromUnitVectors(up, dir.normalize());
        dummy.position.copy(mid);
        dummy.quaternion.copy(quat);
        dummy.scale.set(b.width * t, len, b.width * t);
        dummy.updateMatrix();
        bi.setMatrixAt(n, dummy.matrix);
        bi.setColorAt(n, b.color.clone().multiplyScalar(0.4 + t * 0.6));
      }
      bi.count = n;
      bi.instanceMatrix.needsUpdate = true;
      if (bi.instanceColor) bi.instanceColor.needsUpdate = true;
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

      <instancedMesh
        ref={ringRef}
        args={[undefined, undefined, MAX_RINGS]}
        frustumCulled={false}
        onUpdate={(m) => {
          m.count = 0;
        }}
      >
        <ringGeometry args={[0.82, 1, 40]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      <instancedMesh
        ref={beamRef}
        args={[undefined, undefined, MAX_BEAMS]}
        frustumCulled={false}
        onUpdate={(m) => {
          m.count = 0;
        }}
      >
        <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </>
  );
}

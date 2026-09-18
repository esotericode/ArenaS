import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { ARENA_HALF, PLAYER } from './config';
import { runtime } from './runtime';
import { pointInObstacle } from './physics';
import { useGame } from './store';
import { fx } from './Effects';
import { audio } from './audio';

interface Projectile {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  damage: number;
  color: THREE.Color;
  life: number;
  maxLife: number;
  gravity: number;
  /** enemy id that fired it (so it never hits its owner) */
  owner: number;
}

const MAX_PROJECTILES = 220;
const list: Projectile[] = [];

export const projectiles = {
  spawn(opts: {
    pos: THREE.Vector3;
    dir: THREE.Vector3;
    speed: number;
    damage: number;
    radius: number;
    color: string;
    owner: number;
    gravity?: number;
    life?: number;
  }) {
    if (list.length >= MAX_PROJECTILES) list.shift();
    list.push({
      pos: opts.pos.clone(),
      vel: opts.dir.clone().normalize().multiplyScalar(opts.speed),
      radius: opts.radius,
      damage: opts.damage,
      color: new THREE.Color(opts.color),
      life: 0,
      maxLife: opts.life ?? 4,
      gravity: opts.gravity ?? -2.5,
      owner: opts.owner,
    });
  },
  /** removes every live projectile — used on death / restart */
  clear() {
    list.length = 0;
  },
};

const dummy = new THREE.Object3D();
const toPlayer = new THREE.Vector3();

export function Projectiles() {
  const instRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);

  useFrame((_, rawDt) => {
    const st = useGame.getState();
    const playing = st.status === 'playing';
    const dt = playing ? Math.min(rawDt, 1 / 30) * runtime.timeScale : 0;

    if (dt > 0) {
      const eyeY = runtime.playerPos.y;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          list.splice(i, 1);
          continue;
        }
        p.vel.y += p.gravity * dt;
        p.pos.addScaledVector(p.vel, dt);

        // player hit — treat the player as a vertical capsule around the eye
        toPlayer.set(
          runtime.playerPos.x - p.pos.x,
          0,
          runtime.playerPos.z - p.pos.z,
        );
        const horiz = toPlayer.length();
        const bottom = eyeY - PLAYER.eyeHeight;
        const withinHeight = p.pos.y > bottom - p.radius && p.pos.y < eyeY + 0.2 + p.radius;
        if (horiz < PLAYER.radius + p.radius && withinHeight) {
          fx.burst(p.pos, '#' + p.color.getHexString(), 14, 5, 0.1, -4);
          audio.projectileHit();
          st.damagePlayerFrom(p.damage, p.pos);
          list.splice(i, 1);
          continue;
        }

        // world collision
        const out =
          p.pos.y <= 0.05 ||
          Math.abs(p.pos.x) > ARENA_HALF ||
          Math.abs(p.pos.z) > ARENA_HALF;
        if (out || pointInObstacle(p.pos.x, p.pos.y, p.pos.z, p.radius * 0.5)) {
          fx.burst(p.pos, '#' + p.color.getHexString(), 8, 3, 0.07, -6);
          list.splice(i, 1);
        }
      }
    }

    // ─── render ───────────────────────────────────────────────────
    const inst = instRef.current;
    const glow = glowRef.current;
    let n = 0;
    for (; n < list.length && n < MAX_PROJECTILES; n++) {
      const p = list[n];
      const pulse = 1 + Math.sin(p.life * 30) * 0.12;
      dummy.position.copy(p.pos);
      dummy.rotation.set(p.life * 6, p.life * 9, 0);
      dummy.scale.setScalar(p.radius * 2 * pulse);
      dummy.updateMatrix();
      if (inst) {
        inst.setMatrixAt(n, dummy.matrix);
        inst.setColorAt(n, p.color);
      }
      dummy.scale.setScalar(p.radius * 4.6 * pulse);
      dummy.updateMatrix();
      if (glow) {
        glow.setMatrixAt(n, dummy.matrix);
        glow.setColorAt(n, p.color);
      }
    }
    if (inst) {
      inst.count = n;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
    if (glow) {
      glow.count = n;
      glow.instanceMatrix.needsUpdate = true;
      if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh
        ref={instRef}
        args={[undefined, undefined, MAX_PROJECTILES]}
        frustumCulled={false}
        onUpdate={(m) => {
          m.count = 0;
        }}
      >
        <icosahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* soft additive halo around each bolt */}
      <instancedMesh
        ref={glowRef}
        args={[undefined, undefined, MAX_PROJECTILES]}
        frustumCulled={false}
        onUpdate={(m) => {
          m.count = 0;
        }}
      >
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </>
  );
}

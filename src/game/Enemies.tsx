import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ENEMY_TYPES, PLAYER } from './config';
import { runtime, type EnemyRuntime } from './runtime';
import { resolveBody, type BodyState } from './physics';
import { useGame, type EnemyData } from './store';
import { fx } from './Effects';

const SPAWN_TIME = 0.8;
const ENEMY_JUMP = 8.2;
/** Disable raycasting on cosmetic meshes so bullets don't "hit" health bars. */
const noRaycast = () => null;
const toPlayer = new THREE.Vector3();
const sep = new THREE.Vector3();
const desired = new THREE.Vector3();

function Enemy({ data }: { data: EnemyData }) {
  const def = ENEMY_TYPES[data.type];
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const visual = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const hpBar = useRef<THREE.Mesh>(null);
  const hpGroup = useRef<THREE.Group>(null);
  const spawnedAt = useRef(runtime.elapsed);
  const lastAttack = useRef(-10);
  const lunge = useRef(0);
  const stuckTimer = useRef(0);
  const lastPos = useRef(new THREE.Vector3());
  const walkPhase = useRef(Math.random() * Math.PI * 2);

  const body = useMemo<BodyState>(
    () => ({
      feet: new THREE.Vector3(data.spawn[0], data.spawn[1], data.spawn[2]),
      vel: new THREE.Vector3(),
      radius: def.radius,
      height: def.height,
      grounded: false,
    }),
    [data.spawn, def.radius, def.height],
  );

  // register runtime entry
  useEffect(() => {
    const rt: EnemyRuntime = { id: data.id, pos: body.feet, radius: def.radius, height: def.height, hitFlash: 0 };
    runtime.enemies.set(data.id, rt);
    fx.burst(new THREE.Vector3(data.spawn[0], data.spawn[1] + 1, data.spawn[2]), def.emissive, 16, 3, 0.1, -2);
    return () => {
      runtime.enemies.delete(data.id);
    };
  }, [data.id, data.spawn, def.radius, def.height, def.emissive, body.feet]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const st = useGame.getState();
    const g = group.current;
    if (!g) return;
    const rt = runtime.enemies.get(data.id);
    const spawnP = Math.min(1, (runtime.elapsed - spawnedAt.current) / SPAWN_TIME);

    if (st.status === 'playing') {
      const feet = body.feet;
      const vel = body.vel;
      const playerFeetY = runtime.playerPos.y - PLAYER.eyeHeight;
      toPlayer.set(runtime.playerPos.x - feet.x, playerFeetY - feet.y, runtime.playerPos.z - feet.z);
      const vertical = toPlayer.y;
      toPlayer.y = 0;
      const dist = toPlayer.length();
      const dirX = dist > 0.001 ? toPlayer.x / dist : 0;
      const dirZ = dist > 0.001 ? toPlayer.z / dist : 0;

      // separation from other enemies
      sep.set(0, 0, 0);
      for (const other of runtime.enemies.values()) {
        if (other.id === data.id) continue;
        const dx = feet.x - other.pos.x;
        const dz = feet.z - other.pos.z;
        const d2 = dx * dx + dz * dz;
        const minD = def.radius + other.radius + 0.25;
        if (d2 < minD * minD && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (minD - d) / minD;
          sep.x += (dx / d) * push;
          sep.z += (dz / d) * push;
        }
      }

      const inRange = dist < def.attackRange + PLAYER.radius && Math.abs(vertical) < 2.2;
      const canAct = spawnP >= 1;
      let moveSpeed = 0;
      if (canAct && !inRange) {
        moveSpeed = def.speed;
      }
      desired.set(dirX * moveSpeed + sep.x * 3, 0, dirZ * moveSpeed + sep.z * 3);
      const k = Math.min(1, dt * 8);
      vel.x += (desired.x - vel.x) * k;
      vel.z += (desired.z - vel.z) * k;

      // gravity + integrate
      vel.y += PLAYER.gravity * dt;
      const prevX = feet.x;
      const prevZ = feet.z;
      feet.addScaledVector(vel, dt);
      resolveBody(body, true);

      // stuck detection -> jump over obstacle (also jump if player is above)
      const moved = Math.hypot(feet.x - prevX, feet.z - prevZ);
      const wantedMove = moveSpeed * dt;
      if (canAct && wantedMove > 0.001 && moved < wantedMove * 0.35 && body.grounded) {
        stuckTimer.current += dt;
      } else {
        stuckTimer.current = Math.max(0, stuckTimer.current - dt * 2);
      }
      if (body.grounded && canAct && (stuckTimer.current > 0.25 || (vertical > 0.8 && dist < 3 && inRange === false && Math.random() < dt * 1.5))) {
        vel.y = ENEMY_JUMP + (def.id === 'runner' ? 1.5 : 0);
        stuckTimer.current = 0;
      }

      // attack
      if (canAct && inRange && runtime.elapsed - lastAttack.current >= def.attackCooldown) {
        lastAttack.current = runtime.elapsed;
        lunge.current = 1;
        st.damagePlayer(def.damage);
      }
      lunge.current = Math.max(0, lunge.current - dt * 4);

      // facing
      if (dist > 0.1) {
        const targetYaw = Math.atan2(dirX, dirZ);
        let diff = targetYaw - g.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        g.rotation.y += diff * Math.min(1, dt * 8);
      }

      const hSpeed = Math.hypot(vel.x, vel.z);
      walkPhase.current += dt * hSpeed * 2.2;
      lastPos.current.copy(feet);
    }

    // ─── visuals ──────────────────────────────────────────────────
    g.position.copy(body.feet);
    const v = visual.current;
    if (v) {
      const hSpeed = Math.hypot(body.vel.x, body.vel.z);
      const bob = Math.abs(Math.sin(walkPhase.current)) * 0.08 * Math.min(1, hSpeed / 3);
      const s = spawnP < 1 ? THREE.MathUtils.smoothstep(spawnP, 0, 1) : 1;
      const lungeS = 1 + lunge.current * 0.25;
      v.scale.set(s * (1 + lunge.current * 0.1), s * lungeS, s * (1 + lunge.current * 0.1));
      v.position.y = bob;
      v.rotation.x = -lunge.current * 0.35 + Math.sin(walkPhase.current) * 0.05 * Math.min(1, hSpeed / 3);
      v.rotation.z = Math.sin(walkPhase.current * 0.5) * 0.06 * Math.min(1, hSpeed / 3);
    }
    if (bodyMat.current && rt) {
      rt.hitFlash = Math.max(0, rt.hitFlash - dt * 6);
      const pulse = 0.55 + Math.sin(runtime.elapsed * 4 + data.id) * 0.15;
      bodyMat.current.emissiveIntensity = pulse + rt.hitFlash * 3;
      bodyMat.current.color.set(rt.hitFlash > 0.5 ? '#ffffff' : def.color);
    }
    // health bar
    if (hpGroup.current && hpBar.current) {
      hpGroup.current.lookAt(camera.position);
      const frac = Math.max(0, data.hp / data.maxHp);
      hpBar.current.scale.x = frac;
      hpBar.current.position.x = -(1 - frac) * 0.5 * (def.radius * 2);
      hpGroup.current.visible = frac < 1;
    }
  });

  const r = def.radius;
  const h = def.height;
  const headR = r * 0.55;

  return (
    <group ref={group} userData={{ enemyId: data.id }}>
      <group ref={visual}>
        {/* torso */}
        <mesh position={[0, h * 0.45, 0]} castShadow>
          <capsuleGeometry args={[r * 0.8, h * 0.5, 6, 12]} />
          <meshStandardMaterial ref={bodyMat} color={def.color} emissive={def.emissive} emissiveIntensity={0.6} roughness={0.4} metalness={0.3} />
        </mesh>
        {/* head */}
        <mesh name="head" position={[0, h - headR, 0]} castShadow>
          <sphereGeometry args={[headR, 14, 12]} />
          <meshStandardMaterial color="#0f172a" emissive={def.emissive} emissiveIntensity={0.25} roughness={0.3} metalness={0.6} />
        </mesh>
        {/* eyes */}
        <mesh position={[-headR * 0.4, h - headR + headR * 0.15, headR * 0.8]}>
          <sphereGeometry args={[headR * 0.2, 8, 8]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh position={[headR * 0.4, h - headR + headR * 0.15, headR * 0.8]}>
          <sphereGeometry args={[headR * 0.2, 8, 8]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        {/* arms / claws */}
        <mesh position={[-r * 1.05, h * 0.5, r * 0.3]} rotation={[0.6, 0, 0.2]}>
          <boxGeometry args={[r * 0.3, h * 0.45, r * 0.3]} />
          <meshStandardMaterial color="#1e293b" emissive={def.emissive} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[r * 1.05, h * 0.5, r * 0.3]} rotation={[0.6, 0, -0.2]}>
          <boxGeometry args={[r * 0.3, h * 0.45, r * 0.3]} />
          <meshStandardMaterial color="#1e293b" emissive={def.emissive} emissiveIntensity={0.2} />
        </mesh>
        {/* glow ring on ground */}
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <ringGeometry args={[r * 0.9, r * 1.1, 24]} />
          <meshBasicMaterial color={def.emissive} transparent opacity={0.5} toneMapped={false} />
        </mesh>
      </group>
      {/* health bar */}
      <group ref={hpGroup} position={[0, h + 0.35, 0]} visible={false}>
        <mesh raycast={noRaycast}>
          <planeGeometry args={[r * 2 + 0.04, 0.12]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.6} depthWrite={false} />
        </mesh>
        <mesh ref={hpBar} position={[0, 0, 0.001]} raycast={noRaycast}>
          <planeGeometry args={[r * 2, 0.08]} />
          <meshBasicMaterial color="#4ade80" toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export function Enemies() {
  const enemies = useGame((s) => s.enemies);
  const groupRef = useRef<THREE.Group>(null);
  useEffect(() => {
    runtime.enemyGroup = groupRef.current;
    return () => {
      runtime.enemyGroup = null;
    };
  }, []);
  return (
    <group ref={groupRef} name="enemies">
      {enemies.map((e) => (
        <Enemy key={e.id} data={e} />
      ))}
    </group>
  );
}

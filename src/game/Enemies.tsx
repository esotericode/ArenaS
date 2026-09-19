import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ENEMY_TYPES, PLAYER, type EnemyType } from './config';
import { runtime, type EnemyRuntime } from './runtime';
import { hasLineOfSight, rayObstacleDistance, resolveBody, type BodyState } from './physics';
import { useGame, type EnemyData } from './store';
import { fx } from './Effects';
import { projectiles } from './Projectiles';
import { audio } from './audio';

const ENEMY_JUMP = 8.2;
/** Disable raycasting on cosmetic meshes so bullets don't "hit" health bars. */
const noRaycast = () => null;

const toPlayer = new THREE.Vector3();
const sep = new THREE.Vector3();
const desired = new THREE.Vector3();
const eye = new THREE.Vector3();
const playerEye = new THREE.Vector3();
const aim = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const probeDir = new THREE.Vector3();
const probeOrigin = new THREE.Vector3();

// ─── visuals ──────────────────────────────────────────────────────────
function GruntVisual({ def, matRef }: { def: EnemyType; matRef: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  const r = def.radius;
  const h = def.height;
  const headR = r * 0.55;
  const ranged = !!def.ranged;
  return (
    <>
      <mesh position={[0, h * 0.45, 0]} castShadow>
        <capsuleGeometry args={[r * 0.8, h * 0.5, 6, 12]} />
        <meshStandardMaterial
          ref={matRef}
          color={def.color}
          emissive={def.emissive}
          emissiveIntensity={0.6}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      <mesh name="head" position={[0, h - headR, 0]} castShadow>
        <sphereGeometry args={[headR, 14, 12]} />
        <meshStandardMaterial color="#0f172a" emissive={def.emissive} emissiveIntensity={0.25} roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[-headR * 0.4, h - headR + headR * 0.15, headR * 0.8]} raycast={noRaycast}>
        <sphereGeometry args={[headR * 0.2, 8, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[headR * 0.4, h - headR + headR * 0.15, headR * 0.8]} raycast={noRaycast}>
        <sphereGeometry args={[headR * 0.2, 8, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* ranged enemies carry a stubby cannon instead of a claw */}
      {ranged ? (
        <mesh position={[r * 1.0, h * 0.55, r * 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.24, r * 0.3, h * 0.5, 10]} />
          <meshStandardMaterial color="#064e3b" emissive={def.emissive} emissiveIntensity={0.8} metalness={0.5} roughness={0.4} />
        </mesh>
      ) : (
        <mesh position={[r * 1.05, h * 0.5, r * 0.3]} rotation={[0.6, 0, -0.2]}>
          <boxGeometry args={[r * 0.3, h * 0.45, r * 0.3]} />
          <meshStandardMaterial color="#1e293b" emissive={def.emissive} emissiveIntensity={0.2} />
        </mesh>
      )}
      <mesh position={[-r * 1.05, h * 0.5, r * 0.3]} rotation={[0.6, 0, 0.2]}>
        <boxGeometry args={[r * 0.3, h * 0.45, r * 0.3]} />
        <meshStandardMaterial color="#1e293b" emissive={def.emissive} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <ringGeometry args={[r * 0.9, r * 1.1, 24]} />
        <meshBasicMaterial color={def.emissive} transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </>
  );
}

function WardenVisual({ def, matRef }: { def: EnemyType; matRef: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  const r = def.radius;
  const h = def.height;
  const headR = r * 0.38;
  return (
    <>
      {/* legs */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.5, h * 0.2, 0]} castShadow>
          <boxGeometry args={[r * 0.55, h * 0.42, r * 0.6]} />
          <meshStandardMaterial color="#1e1b4b" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* torso */}
      <mesh position={[0, h * 0.58, 0]} castShadow>
        <boxGeometry args={[r * 1.9, h * 0.44, r * 1.3]} />
        <meshStandardMaterial
          ref={matRef}
          color={def.color}
          emissive={def.emissive}
          emissiveIntensity={0.6}
          roughness={0.35}
          metalness={0.55}
        />
      </mesh>
      {/* exposed core — the obvious weak point */}
      <mesh position={[0, h * 0.58, r * 0.68]} raycast={noRaycast}>
        <sphereGeometry args={[r * 0.3, 16, 16]} />
        <meshBasicMaterial color="#fde68a" toneMapped={false} />
      </mesh>
      {/* shoulder cannons */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 1.15, h * 0.72, r * 0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[r * 0.26, r * 0.3, h * 0.42, 10]} />
          <meshStandardMaterial color="#312e81" emissive={def.emissive} emissiveIntensity={0.7} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* head */}
      <mesh name="head" position={[0, h - headR * 1.6, 0]} castShadow>
        <boxGeometry args={[headR * 2, headR * 1.7, headR * 2]} />
        <meshStandardMaterial color="#0f172a" emissive={def.emissive} emissiveIntensity={0.4} metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, h - headR * 1.6, headR * 1.05]} raycast={noRaycast}>
        <boxGeometry args={[headR * 1.5, headR * 0.35, headR * 0.1]} />
        <meshBasicMaterial color="#fca5a5" toneMapped={false} />
      </mesh>
      {/* ground ring */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <ringGeometry args={[r * 1.1, r * 1.4, 32]} />
        <meshBasicMaterial color={def.emissive} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </>
  );
}

// ─── one enemy ────────────────────────────────────────────────────────
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
  // Seeded from the spawn moment (not a fixed time in the past) so the first
  // volley lands one cooldown *after* spawning, with a random offset that keeps
  // a group of spitters from firing in lockstep.
  const lastRanged = useRef(runtime.elapsed + Math.random() * 1.4);
  const burstLeft = useRef(0);
  const nextBurstShot = useRef(0);
  const lunge = useRef(0);
  const stuckTimer = useRef(0);
  const strafeDir = useRef(Math.random() < 0.5 ? 1 : -1);
  const strafeFlipAt = useRef(0);
  const walkPhase = useRef(Math.random() * Math.PI * 2);
  const spawnTime = def.boss ? 1.8 : 0.8;

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
    const rt: EnemyRuntime = {
      id: data.id,
      pos: body.feet,
      radius: def.radius,
      height: def.height,
      hitFlash: 0,
      type: def.id,
      boss: !!def.boss,
      hpFrac: 1,
    };
    runtime.enemies.set(data.id, rt);
    fx.burst(
      new THREE.Vector3(data.spawn[0], data.spawn[1] + 1, data.spawn[2]),
      def.emissive,
      def.boss ? 70 : 16,
      def.boss ? 7 : 3,
      def.boss ? 0.2 : 0.1,
      -2,
    );
    if (def.boss) fx.ring(new THREE.Vector3(data.spawn[0], 0.1, data.spawn[2]), def.emissive, 9, 0.9);
    return () => {
      runtime.enemies.delete(data.id);
    };
  }, [data.id, data.spawn, def.radius, def.height, def.emissive, def.boss, def.id, body.feet]);

  useFrame((_, rawDt) => {
    const st = useGame.getState();
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 1 / 30) * runtime.timeScale;
    const rt = runtime.enemies.get(data.id);
    const spawnP = Math.min(1, (runtime.elapsed - spawnedAt.current) / spawnTime);
    const enraged = def.boss && data.hp / data.maxHp < 0.35;

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

      // eye positions for the sight checks
      eye.set(feet.x, feet.y + def.height * 0.75, feet.z);
      playerEye.copy(runtime.playerPos);
      const sees = hasLineOfSight(eye, playerEye);

      // separation from other enemies (bosses barely budge)
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
      const sepStrength = sep.length();
      if (def.boss) sep.multiplyScalar(0.15);

      const speedMul = enraged ? 1.35 : 1;
      const inMelee = dist < def.attackRange + PLAYER.radius && Math.abs(vertical) < 2.2;
      const canAct = spawnP >= 1;

      // ─── movement intent ─────────────────────────────────────────
      let moveX = 0;
      let moveZ = 0;
      if (canAct) {
        const keepAway = def.preferredRange;
        if (keepAway > 0 && sees) {
          // ranged units hold a firing line and strafe across it
          if (runtime.elapsed > strafeFlipAt.current) {
            strafeFlipAt.current = runtime.elapsed + 1.6 + Math.random() * 2.2;
            strafeDir.current *= -1;
          }
          const speed = def.speed * speedMul;
          if (dist > keepAway + 2.5) {
            moveX = dirX * speed;
            moveZ = dirZ * speed;
          } else if (dist < keepAway - 3) {
            moveX = -dirX * speed * 0.9;
            moveZ = -dirZ * speed * 0.9;
          } else {
            moveX = -dirZ * strafeDir.current * speed * 0.75;
            moveZ = dirX * strafeDir.current * speed * 0.75;
          }
        } else if (!inMelee) {
          const speed = def.speed * speedMul;
          moveX = dirX * speed;
          moveZ = dirZ * speed;
        }
      }
      desired.set(moveX + sep.x * 3, 0, moveZ + sep.z * 3);
      const k = Math.min(1, dt * 8);
      vel.x += (desired.x - vel.x) * k;
      vel.z += (desired.z - vel.z) * k;

      // gravity + integrate
      vel.y += PLAYER.gravity * dt;
      const prevX = feet.x;
      const prevZ = feet.z;
      feet.addScaledVector(vel, dt);
      resolveBody(body, true);

      // ─── stuck detection ─────────────────────────────────────────
      // Only counts as stuck when we *wanted* to move, actually did not, and
      // are not simply being jostled by the crowd — that used to cause the
      // whole pack to pogo whenever it bunched up.
      const moved = Math.hypot(feet.x - prevX, feet.z - prevZ);
      const wantedMove = Math.hypot(moveX, moveZ) * dt;
      const crowded = sepStrength > 0.35;
      if (canAct && wantedMove > 0.001 && moved < wantedMove * 0.35 && body.grounded && !crowded) {
        stuckTimer.current += dt;
      } else {
        stuckTimer.current = Math.max(0, stuckTimer.current - dt * 2);
      }
      if (body.grounded && canAct && stuckTimer.current > 0.4) {
        // confirm there really is geometry in the way before hopping
        probeOrigin.set(feet.x, feet.y + 0.35, feet.z);
        probeDir.set(dirX, 0, dirZ);
        const blocked = rayObstacleDistance(probeOrigin, probeDir, def.radius + 1.1);
        if (blocked < def.radius + 1.1) {
          vel.y = ENEMY_JUMP + (def.id === 'runner' ? 1.5 : 0);
          stuckTimer.current = 0;
        } else {
          // no wall — we are just wedged against bodies, so wait it out
          stuckTimer.current = 0;
        }
      }
      // reach a player standing on top of cover
      if (body.grounded && canAct && vertical > 0.9 && dist < 3.5 && !inMelee && Math.random() < dt * 2) {
        vel.y = ENEMY_JUMP;
      }

      // ─── melee attack (requires line of sight) ───────────────────
      const cooldown = def.attackCooldown * (enraged ? 0.7 : 1);
      if (canAct && inMelee && sees && runtime.elapsed - lastAttack.current >= cooldown) {
        lastAttack.current = runtime.elapsed;
        lunge.current = 1;
        st.damagePlayerFrom(def.damage, eye);
        if (def.boss) {
          // ground slam shockwave
          fx.ring(new THREE.Vector3(feet.x, 0.1, feet.z), '#fb7185', def.attackRange + 3, 0.5);
          fx.burst(new THREE.Vector3(feet.x, 0.4, feet.z), '#fb7185', 40, 8, 0.15, -8);
          runtime.shake = Math.min(1, runtime.shake + 0.5);
          audio.explode();
        }
      }
      lunge.current = Math.max(0, lunge.current - dt * 4);

      // ─── ranged attack ───────────────────────────────────────────
      const rangedDef = def.ranged;
      if (rangedDef && canAct) {
        const rCooldown = rangedDef.cooldown * (enraged ? 0.55 : 1);
        if (
          burstLeft.current <= 0 &&
          sees &&
          dist < rangedDef.range &&
          dist > (def.boss ? 4 : 3) &&
          runtime.elapsed - lastRanged.current >= rCooldown
        ) {
          lastRanged.current = runtime.elapsed;
          burstLeft.current = rangedDef.burst;
          nextBurstShot.current = runtime.elapsed;
        }
        if (burstLeft.current > 0 && runtime.elapsed >= nextBurstShot.current) {
          burstLeft.current--;
          nextBurstShot.current = runtime.elapsed + rangedDef.burstDelay;
          const arcing = !!def.boss;
          muzzle.set(
            feet.x + dirX * (def.radius + 0.3),
            feet.y + def.height * (def.boss ? 0.72 : 0.6),
            feet.z + dirZ * (def.radius + 0.3),
          );
          aim.subVectors(playerEye, muzzle).normalize();
          aim.x += (Math.random() - 0.5) * rangedDef.spread * 2;
          aim.y += (Math.random() - 0.5) * rangedDef.spread * 2;
          aim.z += (Math.random() - 0.5) * rangedDef.spread * 2;
          // lob the boss volley so it can be side-stepped
          if (arcing) aim.y += Math.min(0.45, dist * 0.012);
          projectiles.spawn({
            pos: muzzle,
            dir: aim,
            speed: rangedDef.projectileSpeed,
            damage: rangedDef.damage,
            radius: rangedDef.radius,
            color: rangedDef.color,
            owner: data.id,
            gravity: arcing ? -5 : 0,
            life: 5,
          });
          fx.burst(muzzle, rangedDef.color, 6, 2.5, 0.07, 0);
          audio.enemyShoot(!!def.boss);
        }
      }

      // facing
      if (dist > 0.1) {
        const targetYaw = Math.atan2(dirX, dirZ);
        let diff = targetYaw - g.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        g.rotation.y += diff * Math.min(1, dt * 8);
      }

      const hSpeed = Math.hypot(vel.x, vel.z);
      walkPhase.current += dt * hSpeed * 2.2;
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
      rt.hpFrac = Math.max(0, data.hp / data.maxHp);
      const pulse = 0.55 + Math.sin(runtime.elapsed * (enraged ? 11 : 4) + data.id) * (enraged ? 0.4 : 0.15);
      bodyMat.current.emissiveIntensity = pulse + rt.hitFlash * 3;
      bodyMat.current.color.set(rt.hitFlash > 0.5 ? '#ffffff' : def.color);
    }
    // health bar — the boss gets a dedicated HUD bar instead
    if (hpGroup.current && hpBar.current) {
      hpGroup.current.lookAt(camera.position);
      const frac = Math.max(0, data.hp / data.maxHp);
      hpBar.current.scale.x = frac;
      hpBar.current.position.x = -(1 - frac) * 0.5 * (def.radius * 2);
      hpGroup.current.visible = frac < 1 && !def.boss;
    }
  });

  const r = def.radius;
  const h = def.height;

  return (
    <group ref={group} userData={{ enemyId: data.id }}>
      <group ref={visual}>
        {def.boss ? (
          <WardenVisual def={def} matRef={bodyMat} />
        ) : (
          <GruntVisual def={def} matRef={bodyMat} />
        )}
      </group>
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

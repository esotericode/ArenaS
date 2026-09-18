import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { WEAPONS, type WeaponId } from './config';
import { runtime } from './runtime';
import { useGame } from './store';
import { audio } from './audio';
import { fx } from './Effects';
import { damageFor, falloffAt, fireIntervalFor, headshotMulFor, reloadTimeFor } from './weapons';

const raycaster = new THREE.Raycaster();
const shootDir = new THREE.Vector3();
const muzzleWorld = new THREE.Vector3();
const camQuat = new THREE.Quaternion();
const offset = new THREE.Vector3();
const targetPos = new THREE.Vector3();
const endPoint = new THREE.Vector3();
const hitEnemies = new Set<number>();

/** Cosmetic meshes must not eat bullets. */
const noRaycast = () => null;

// ─── view models ───────────────────────────────────────────────────
function RifleModel({ accent }: { accent: string }) {
  return (
    <>
      <mesh>
        <boxGeometry args={[0.08, 0.12, 0.42]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.02, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.028, 0.32, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.03, -0.05]}>
        <boxGeometry args={[0.1, 0.03, 0.2]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[0.045, -0.01, -0.15]}>
        <boxGeometry args={[0.01, 0.05, 0.16]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[-0.045, -0.01, -0.15]}>
        <boxGeometry args={[0.01, 0.05, 0.16]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.12, 0.1]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.06, 0.16, 0.07]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.02, 0.25]}>
        <boxGeometry args={[0.06, 0.08, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
      </mesh>
    </>
  );
}

function ScatterModel({ accent }: { accent: string }) {
  return (
    <>
      <mesh>
        <boxGeometry args={[0.12, 0.14, 0.34]} />
        <meshStandardMaterial color="#292524" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* twin barrels */}
      <mesh position={[-0.035, 0.015, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.038, 0.04, 0.4, 12]} />
        <meshStandardMaterial color="#44403c" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0.035, 0.015, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.038, 0.04, 0.4, 12]} />
        <meshStandardMaterial color="#44403c" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* heat coils */}
      <mesh position={[0, 0.08, -0.16]}>
        <boxGeometry args={[0.13, 0.02, 0.24]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.13, 0.08]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.07, 0.18, 0.08]} />
        <meshStandardMaterial color="#1c1917" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.03, 0.24]}>
        <boxGeometry args={[0.08, 0.11, 0.14]} />
        <meshStandardMaterial color="#1c1917" metalness={0.4} roughness={0.6} />
      </mesh>
    </>
  );
}

function RailModel({ accent }: { accent: string }) {
  return (
    <>
      <mesh>
        <boxGeometry args={[0.09, 0.1, 0.62]} />
        <meshStandardMaterial color="#1e1b4b" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* magnetic rails */}
      <mesh position={[0.06, 0.05, -0.2]}>
        <boxGeometry args={[0.018, 0.018, 0.6]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[-0.06, 0.05, -0.2]}>
        <boxGeometry args={[0.018, 0.018, 0.6]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      {/* coil rings */}
      {[-0.1, -0.26, -0.42].map((z) => (
        <mesh key={z} position={[0, 0.03, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.075, 0.014, 8, 16]} />
          <meshStandardMaterial color="#4c1d95" emissive={accent} emissiveIntensity={0.7} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* scope */}
      <mesh position={[0, 0.11, 0.02]}>
        <boxGeometry args={[0.04, 0.05, 0.22]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.12, 0.14]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.06, 0.17, 0.07]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.02, 0.33]}>
        <boxGeometry args={[0.06, 0.09, 0.14]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
      </mesh>
    </>
  );
}

export function Weapon() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const group = useRef<THREE.Group>(null);
  const muzzle = useRef<THREE.Mesh>(null);
  const flashLight = useRef<THREE.PointLight>(null);
  const lastShot = useRef(-10);
  const reloadStarted = useRef<number | null>(null);
  const kick = useRef(0);
  const swayX = useRef(0);
  const swayY = useRef(0);
  const prevYaw = useRef(0);
  const prevPitch = useRef(0);
  const weapon = useGame((s) => s.weapon);
  const def = WEAPONS[weapon];

  const fire = (w: WeaponId) => {
    const st = useGame.getState();
    if (!st.consumeAmmo()) {
      if (st.mags[w] <= 0 && !st.reloading) {
        audio.dryFire();
        lastShot.current = runtime.elapsed + 0.25; // throttle dry-fire clicks
        st.startReload();
      }
      return;
    }
    const wd = WEAPONS[w];
    audio.shoot(w);
    lastShot.current = runtime.elapsed;
    runtime.lastShotAt = runtime.elapsed;
    kick.current = 1;
    runtime.recoil += wd.recoil;
    runtime.shake = Math.min(1, runtime.shake + wd.shake);

    if (muzzle.current) muzzle.current.getWorldPosition(muzzleWorld);
    else muzzleWorld.copy(camera.position);

    const targets: THREE.Object3D[] = [];
    const world = scene.getObjectByName('world');
    if (world) targets.push(world);
    if (runtime.enemyGroup) targets.push(runtime.enemyGroup);

    // extra spread while airborne or moving fast
    const speed = Math.hypot(runtime.playerVel.x, runtime.playerVel.z);
    const moveFactor =
      (runtime.playerGrounded ? Math.min(1, speed / 10) : 1.4) * wd.moveSpread;

    for (let p = 0; p < wd.pellets; p++) {
      camera.getWorldDirection(shootDir);
      const spread = wd.spread + moveFactor;
      if (spread > 0) {
        // cone spread — square root keeps the distribution even across the disc
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spread;
        shootDir.x += Math.cos(ang) * r;
        shootDir.y += Math.sin(ang) * r;
        shootDir.z += (Math.random() - 0.5) * spread * 0.4;
        shootDir.normalize();
      }

      raycaster.set(camera.position, shootDir);
      raycaster.far = wd.range;
      const hits = raycaster.intersectObjects(targets, true);

      endPoint.copy(camera.position).addScaledVector(shootDir, wd.range);
      hitEnemies.clear();
      let pierced = 0;

      for (const h of hits) {
        if (!(h.object as THREE.Mesh).isMesh) continue;
        let o: THREE.Object3D | null = h.object;
        let enemyId: number | null = null;
        let headshot = false;
        while (o) {
          if (o.userData.enemyId !== undefined) {
            enemyId = o.userData.enemyId as number;
            break;
          }
          if (o.name === 'head') headshot = true;
          o = o.parent;
        }

        if (enemyId === null) {
          // world geometry stops the ray
          endPoint.copy(h.point);
          fx.burst(h.point, '#7dd3fc', 6, 3, 0.06, -6);
          break;
        }
        if (hitEnemies.has(enemyId)) continue; // already counted this body
        hitEnemies.add(enemyId);

        let dmg = damageFor(w) * falloffAt(w, h.distance);
        const crit = runtime.mods.critChance > 0 && Math.random() < runtime.mods.critChance;
        if (crit) dmg *= runtime.mods.critMul;
        if (headshot) dmg *= headshotMulFor(w);

        const colour = crit ? '#fbbf24' : headshot ? '#fff59d' : '#ff6b6b';
        fx.burst(h.point, colour, headshot ? 18 : 10, 5, 0.09);
        st.damageEnemy(enemyId, dmg, { headshot, crit });

        pierced++;
        endPoint.copy(h.point);
        if (pierced >= wd.pierce) break;
        // a piercing shot keeps going — extend the visual to full range
        endPoint.copy(camera.position).addScaledVector(shootDir, wd.range);
      }

      if (w === 'rail') {
        fx.beam(muzzleWorld, endPoint, wd.tracerColor, 0.08, 0.26);
        fx.tracer(muzzleWorld, endPoint, '#ffffff', 0.12);
      } else {
        fx.tracer(muzzleWorld, endPoint, wd.tracerColor);
      }
    }
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const st = useGame.getState();
    const playing = st.status === 'playing';
    const w = st.weapon;
    const wd = WEAPONS[w];

    // reload timer (game-time so it pauses with the game)
    if (st.reloading && reloadStarted.current === null) reloadStarted.current = runtime.elapsed;
    if (
      st.reloading &&
      reloadStarted.current !== null &&
      runtime.elapsed - reloadStarted.current >= reloadTimeFor(w)
    ) {
      st.finishReload();
      reloadStarted.current = null;
    }
    if (!st.reloading) reloadStarted.current = null;

    // firing — auto weapons repeat while held, semi-autos need a fresh click
    const locked = document.pointerLockElement === runtime.canvas;
    if (playing && locked && runtime.elapsed - lastShot.current >= fireIntervalFor(w)) {
      if (wd.auto ? runtime.mouseDown : runtime.mouseClicked) fire(w);
    }
    runtime.mouseClicked = false;

    // ─── viewmodel placement ──────────────────────────────────────
    const g = group.current;
    if (!g) return;
    kick.current = Math.max(0, kick.current - dt * 10);
    runtime.weaponSwapT = Math.max(0, runtime.weaponSwapT - dt * 4.5);

    const dYaw = runtime.yaw - prevYaw.current;
    const dPitch = runtime.pitch - prevPitch.current;
    prevYaw.current = runtime.yaw;
    prevPitch.current = runtime.pitch;
    swayX.current += (THREE.MathUtils.clamp(-dYaw * 4, -0.08, 0.08) - swayX.current) * Math.min(1, dt * 10);
    swayY.current += (THREE.MathUtils.clamp(dPitch * 4, -0.08, 0.08) - swayY.current) * Math.min(1, dt * 10);

    const speed = Math.hypot(runtime.playerVel.x, runtime.playerVel.z);
    const t = runtime.elapsed;
    const bobAmt = runtime.playerGrounded ? Math.min(1, speed / 6) : 0;
    const bobX = Math.sin(t * 9) * 0.012 * bobAmt;
    const bobY = Math.abs(Math.cos(t * 9)) * 0.012 * bobAmt;

    let reloadDip = 0;
    let reloadRot = 0;
    if (st.reloading && reloadStarted.current !== null) {
      const p = (runtime.elapsed - reloadStarted.current) / reloadTimeFor(w);
      const s = Math.sin(Math.min(1, p) * Math.PI);
      reloadDip = s * 0.25;
      reloadRot = s * 0.9;
    }
    // swap animation: the gun dips out of frame and comes back up
    const swapDip = Math.sin(Math.min(1, runtime.weaponSwapT) * Math.PI) * 0.35;

    const dashPull = Math.min(1, runtime.dashTime > 0 ? 1 : 0) * 0.06;
    const [ox, oy, oz] = wd.viewOffset;
    offset.set(
      ox + swayX.current + bobX,
      oy + swayY.current + bobY - reloadDip - swapDip,
      oz + kick.current * 0.08 + dashPull,
    );
    camera.getWorldQuaternion(camQuat);
    targetPos.copy(offset).applyQuaternion(camQuat).add(camera.position);
    g.position.copy(targetPos);
    g.quaternion.copy(camQuat);
    g.scale.setScalar(wd.viewScale);
    g.rotateX(-kick.current * 0.12 + reloadRot * 0.6 + swapDip * 0.9);
    g.rotateZ(reloadRot * 0.4);

    const flashOn = runtime.elapsed - lastShot.current < (w === 'rail' ? 0.1 : 0.05);
    if (muzzle.current) {
      muzzle.current.visible = flashOn;
      muzzle.current.rotation.z = Math.random() * Math.PI;
      const s = w === 'scatter' ? 1.7 : w === 'rail' ? 1.3 : 1;
      muzzle.current.scale.setScalar((0.8 + Math.random() * 0.6) * s);
    }
    if (flashLight.current) {
      flashLight.current.intensity = flashOn ? (w === 'scatter' ? 14 : 6) : 0;
      flashLight.current.color.set(wd.accent);
    }
  });

  const muzzleZ = weapon === 'rail' ? -0.58 : weapon === 'scatter' ? -0.56 : -0.52;

  return (
    <group ref={group}>
      {weapon === 'rifle' && <RifleModel accent={def.accent} />}
      {weapon === 'scatter' && <ScatterModel accent={def.accent} />}
      {weapon === 'rail' && <RailModel accent={def.accent} />}
      <mesh ref={muzzle} position={[0, 0.02, muzzleZ]} visible={false} raycast={noRaycast}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial
          color={weapon === 'scatter' ? '#fed7aa' : weapon === 'rail' ? '#f5d0fe' : '#fef08a'}
          transparent
          opacity={0.95}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <pointLight ref={flashLight} position={[0, 0.02, -0.5]} intensity={0} color={def.accent} distance={9} decay={2} />
    </group>
  );
}

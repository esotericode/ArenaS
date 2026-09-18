import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { WEAPON } from './config';
import { runtime } from './runtime';
import { useGame } from './store';
import { audio } from './audio';
import { fx } from './Effects';

const raycaster = new THREE.Raycaster();
const shootDir = new THREE.Vector3();
const muzzleWorld = new THREE.Vector3();
const camQuat = new THREE.Quaternion();
const offset = new THREE.Vector3();
const targetPos = new THREE.Vector3();

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

  const fire = () => {
    const st = useGame.getState();
    if (!st.consumeAmmo()) {
      if (st.ammo <= 0 && !st.reloading) {
        audio.dryFire();
        lastShot.current = runtime.elapsed + 0.25; // throttle dry-fire clicks
        st.startReload();
      }
      return;
    }
    audio.shoot();
    lastShot.current = runtime.elapsed;
    runtime.lastShotAt = runtime.elapsed;
    kick.current = 1;
    runtime.recoil += WEAPON.recoil;
    runtime.shake = Math.min(1, runtime.shake + 0.05);

    // build direction with spread
    camera.getWorldDirection(shootDir);
    shootDir.x += (Math.random() - 0.5) * WEAPON.spread * 2;
    shootDir.y += (Math.random() - 0.5) * WEAPON.spread * 2;
    shootDir.z += (Math.random() - 0.5) * WEAPON.spread * 2;
    shootDir.normalize();

    raycaster.set(camera.position, shootDir);
    raycaster.far = WEAPON.range;

    const targets: THREE.Object3D[] = [];
    const world = scene.getObjectByName('world');
    if (world) targets.push(world);
    if (runtime.enemyGroup) targets.push(runtime.enemyGroup);
    const hits = raycaster.intersectObjects(targets, true);

    // muzzle world position for tracer start
    if (muzzle.current) muzzle.current.getWorldPosition(muzzleWorld);
    else muzzleWorld.copy(camera.position);

    let endPoint = camera.position.clone().addScaledVector(shootDir, WEAPON.range);
    for (const h of hits) {
      // skip non-mesh helpers (e.g. line segments)
      if (!(h.object as THREE.Mesh).isMesh) continue;
      endPoint = h.point;
      // find the enemy id by walking up the hierarchy
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
      if (enemyId !== null) {
        const colour = headshot ? '#fff59d' : '#ff6b6b';
        fx.burst(h.point, colour, headshot ? 18 : 10, 5, 0.09);
        st.damageEnemy(enemyId, WEAPON.damage, headshot);
      } else {
        // wall / obstacle spark
        fx.burst(h.point, '#7dd3fc', 6, 3, 0.06, -6);
      }
      break;
    }
    fx.tracer(muzzleWorld, endPoint);
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const st = useGame.getState();
    const playing = st.status === 'playing';

    // reload timer
    if (st.reloading && reloadStarted.current === null) reloadStarted.current = runtime.elapsed;
    if (st.reloading && reloadStarted.current !== null && runtime.elapsed - reloadStarted.current >= WEAPON.reloadTime) {
      st.finishReload();
      reloadStarted.current = null;
    }
    if (!st.reloading) reloadStarted.current = null;

    // auto-fire
    if (playing && runtime.mouseDown && document.pointerLockElement === runtime.canvas) {
      if (runtime.elapsed - lastShot.current >= WEAPON.fireInterval) fire();
    }

    // ─── viewmodel placement ──────────────────────────────────────
    const g = group.current;
    if (!g) return;
    kick.current = Math.max(0, kick.current - dt * 10);

    // sway from look delta
    const dYaw = runtime.yaw - prevYaw.current;
    const dPitch = runtime.pitch - prevPitch.current;
    prevYaw.current = runtime.yaw;
    prevPitch.current = runtime.pitch;
    swayX.current += (THREE.MathUtils.clamp(-dYaw * 4, -0.08, 0.08) - swayX.current) * Math.min(1, dt * 10);
    swayY.current += (THREE.MathUtils.clamp(dPitch * 4, -0.08, 0.08) - swayY.current) * Math.min(1, dt * 10);

    // bob from movement
    const speed = Math.hypot(runtime.playerVel.x, runtime.playerVel.z);
    const t = runtime.elapsed;
    const bobAmt = runtime.playerGrounded ? Math.min(1, speed / 6) : 0;
    const bobX = Math.sin(t * 9) * 0.012 * bobAmt;
    const bobY = Math.abs(Math.cos(t * 9)) * 0.012 * bobAmt;

    // reload animation: dip and rotate
    let reloadDip = 0;
    let reloadRot = 0;
    if (st.reloading && reloadStarted.current !== null) {
      const p = (runtime.elapsed - reloadStarted.current) / WEAPON.reloadTime;
      const s = Math.sin(Math.min(1, p) * Math.PI);
      reloadDip = s * 0.25;
      reloadRot = s * 0.9;
    }

    offset.set(0.32 + swayX.current + bobX, -0.28 + swayY.current + bobY - reloadDip, -0.55 + kick.current * 0.08);
    camera.getWorldQuaternion(camQuat);
    targetPos.copy(offset).applyQuaternion(camQuat).add(camera.position);
    g.position.copy(targetPos);
    g.quaternion.copy(camQuat);
    g.rotateX(-kick.current * 0.12 + reloadRot * 0.6);
    g.rotateZ(reloadRot * 0.4);

    // muzzle flash
    const flashOn = runtime.elapsed - lastShot.current < 0.05;
    if (muzzle.current) {
      muzzle.current.visible = flashOn;
      muzzle.current.rotation.z = Math.random() * Math.PI;
      muzzle.current.scale.setScalar(0.8 + Math.random() * 0.6);
    }
    if (flashLight.current) flashLight.current.intensity = flashOn ? 6 : 0;
  });

  return (
    <group ref={group}>
      {/* body */}
      <mesh position={[0, 0, 0]} castShadow={false}>
        <boxGeometry args={[0.08, 0.12, 0.42]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* barrel */}
      <mesh position={[0, 0.02, -0.34]}>
        <cylinderGeometry args={[0.022, 0.028, 0.32, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* glowing energy core */}
      <mesh position={[0, 0.03, -0.05]}>
        <boxGeometry args={[0.1, 0.03, 0.2]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      {/* side vents */}
      <mesh position={[0.045, -0.01, -0.15]}>
        <boxGeometry args={[0.01, 0.05, 0.16]} />
        <meshBasicMaterial color="#0ea5e9" toneMapped={false} />
      </mesh>
      <mesh position={[-0.045, -0.01, -0.15]}>
        <boxGeometry args={[0.01, 0.05, 0.16]} />
        <meshBasicMaterial color="#0ea5e9" toneMapped={false} />
      </mesh>
      {/* grip */}
      <mesh position={[0, -0.12, 0.1]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.06, 0.16, 0.07]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* stock */}
      <mesh position={[0, -0.02, 0.25]}>
        <boxGeometry args={[0.06, 0.08, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* muzzle flash */}
      <mesh ref={muzzle} position={[0, 0.02, -0.52]} visible={false}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial color="#fef08a" transparent opacity={0.95} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight ref={flashLight} position={[0, 0.02, -0.5]} intensity={0} color="#fde68a" distance={8} decay={2} />
    </group>
  );
}

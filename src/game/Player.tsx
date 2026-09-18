import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PLAYER } from './config';
import { runtime } from './runtime';
import { resolveBody, type BodyState } from './physics';
import { useGame } from './store';
import { audio } from './audio';

const MOUSE_SENS = 0.0022;
const tmpDir = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const wish = new THREE.Vector3();

export function Player() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const body = useRef<BodyState>({
    feet: new THREE.Vector3(),
    vel: runtime.playerVel,
    radius: PLAYER.radius,
    height: PLAYER.eyeHeight + 0.15,
    grounded: false,
  });
  const jumpQueued = useRef(false);
  const wasGrounded = useRef(false);
  const bobTime = useRef(0);

  // ─── input listeners ─────────────────────────────────────────────
  useEffect(() => {
    runtime.canvas = gl.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      const st = useGame.getState();
      if (e.code === 'Space') e.preventDefault();
      runtime.keys.add(e.code);
      if (e.code === 'Space' && st.status === 'playing') jumpQueued.current = true;
      if (e.code === 'KeyR' && st.status === 'playing') st.startReload();
      if (e.code === 'KeyM') audio.setMuted(!audio.muted);
    };
    const onKeyUp = (e: KeyboardEvent) => runtime.keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      if (useGame.getState().status !== 'playing') return;
      runtime.yaw -= e.movementX * MOUSE_SENS;
      runtime.pitch -= e.movementY * MOUSE_SENS;
      const lim = Math.PI / 2 - 0.01;
      runtime.pitch = Math.max(-lim, Math.min(lim, runtime.pitch));
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) runtime.mouseDown = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) runtime.mouseDown = false;
    };
    const onBlur = () => {
      runtime.keys.clear();
      runtime.mouseDown = false;
    };
    const onPointerLockChange = () => {
      const st = useGame.getState();
      if (document.pointerLockElement !== gl.domElement) {
        runtime.mouseDown = false;
        runtime.keys.clear();
        if (st.status === 'playing') st.pause();
      } else if (st.status === 'paused') {
        st.resume();
      }
    };
    const onContext = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    gl.domElement.addEventListener('contextmenu', onContext);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      gl.domElement.removeEventListener('contextmenu', onContext);
    };
  }, [gl]);

  // ─── per-frame simulation ────────────────────────────────────────
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const st = useGame.getState();
    const playing = st.status === 'playing';
    if (playing) runtime.elapsed += dt;

    const b = body.current;
    b.feet.set(runtime.playerPos.x, runtime.playerPos.y - PLAYER.eyeHeight, runtime.playerPos.z);
    const vel = b.vel;

    if (playing) {
      // movement direction relative to yaw (ignore pitch)
      const keys = runtime.keys;
      let fwd = 0;
      let side = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
      const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = sprinting && fwd > 0 ? PLAYER.sprintSpeed : PLAYER.walkSpeed;

      tmpDir.set(-Math.sin(runtime.yaw), 0, -Math.cos(runtime.yaw));
      tmpRight.set(Math.cos(runtime.yaw), 0, -Math.sin(runtime.yaw));
      wish.set(0, 0, 0).addScaledVector(tmpDir, fwd).addScaledVector(tmpRight, side);
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

      const control = b.grounded ? 1 : PLAYER.airControl;
      const accel = PLAYER.acceleration * control;
      // accelerate horizontal velocity toward wish
      vel.x += (wish.x - vel.x) * Math.min(1, accel * dt / Math.max(speed, 1));
      vel.z += (wish.z - vel.z) * Math.min(1, accel * dt / Math.max(speed, 1));
      if (b.grounded && wish.lengthSq() === 0) {
        const f = Math.max(0, 1 - PLAYER.friction * dt);
        vel.x *= f;
        vel.z *= f;
      }

      // jump
      if (jumpQueued.current && b.grounded) {
        vel.y = PLAYER.jumpVelocity;
        b.grounded = false;
        audio.jump();
      }
      jumpQueued.current = false;

      // gravity
      vel.y += PLAYER.gravity * dt;

      // integrate
      b.feet.addScaledVector(vel, dt);
      resolveBody(b, true);

      if (b.grounded && !wasGrounded.current) audio.land();
      wasGrounded.current = b.grounded;

      // head bob when moving on ground
      const horizSpeed = Math.hypot(vel.x, vel.z);
      if (b.grounded && horizSpeed > 0.5) bobTime.current += dt * horizSpeed * 1.6;

      // decay shake/recoil
      runtime.shake = Math.max(0, runtime.shake - dt * 2.2);
      runtime.recoil = Math.max(0, runtime.recoil - dt * 0.25);

      runtime.playerGrounded = b.grounded;
    }

    runtime.playerPos.set(b.feet.x, b.feet.y + PLAYER.eyeHeight, b.feet.z);

    // ─── camera ────────────────────────────────────────────────────
    const bob = Math.sin(bobTime.current) * 0.035;
    const bobX = Math.cos(bobTime.current * 0.5) * 0.02;
    const sh = runtime.shake;
    const shakeX = (Math.random() - 0.5) * sh * 0.12;
    const shakeY = (Math.random() - 0.5) * sh * 0.12;
    camera.position.set(runtime.playerPos.x + bobX + shakeX, runtime.playerPos.y + bob + shakeY, runtime.playerPos.z);
    camera.rotation.set(runtime.pitch + runtime.recoil, runtime.yaw, 0, 'YXZ');
  });

  return null;
}

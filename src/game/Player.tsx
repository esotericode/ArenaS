import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DASH, PLAYER, WEAPON_ORDER } from './config';
import { runtime } from './runtime';
import { jumpPadAt, resolveBody, type BodyState } from './physics';
import { useGame } from './store';
import { audio } from './audio';
import { fx } from './Effects';
import { settings } from './settings';
import { isLockPending } from './pointerLock';

const BASE_SENS = 0.0022;
const tmpDir = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const wish = new THREE.Vector3();
const dashFxPos = new THREE.Vector3();

export function Player() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const body = useRef<BodyState>({
    feet: new THREE.Vector3(),
    vel: runtime.playerVel,
    radius: PLAYER.radius,
    height: PLAYER.eyeHeight + 0.15,
    grounded: false,
  });
  const jumpPressedAt = useRef(-10);
  const lastGroundedAt = useRef(-10);
  const usedDoubleJump = useRef(false);
  const dashQueued = useRef(false);
  const wasGrounded = useRef(false);
  const bobTime = useRef(0);
  const regenPool = useRef(0);
  const fovCurrent = useRef(settings.fov);

  // ─── input listeners ─────────────────────────────────────────────
  useEffect(() => {
    runtime.canvas = gl.domElement;
    runtime.camera = camera;

    const onKeyDown = (e: KeyboardEvent) => {
      const st = useGame.getState();
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      runtime.keys.add(e.code);
      if (st.status !== 'playing') {
        if (e.code === 'KeyM') audio.setMuted(!audio.muted);
        return;
      }
      if (e.code === 'Space') jumpPressedAt.current = runtime.elapsed;
      if (e.code === 'KeyR') st.startReload();
      if (e.code === 'KeyM') audio.setMuted(!audio.muted);
      if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyE') {
        dashQueued.current = true;
      }
      if (e.code === 'Digit1') st.selectWeapon(WEAPON_ORDER[0]);
      if (e.code === 'Digit2') st.selectWeapon(WEAPON_ORDER[1]);
      if (e.code === 'Digit3') st.selectWeapon(WEAPON_ORDER[2]);
      if (e.code === 'KeyQ') st.swapWeapon();
    };
    const onKeyUp = (e: KeyboardEvent) => runtime.keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      if (useGame.getState().status !== 'playing') return;
      const sens = BASE_SENS * settings.sensitivity;
      runtime.yaw -= e.movementX * sens;
      runtime.pitch -= e.movementY * sens * (settings.invertY ? -1 : 1);
      const lim = Math.PI / 2 - 0.01;
      runtime.pitch = Math.max(-lim, Math.min(lim, runtime.pitch));
    };
    const onMouseDown = (e: MouseEvent) => {
      const locked = document.pointerLockElement === gl.domElement;
      if (e.button === 0) {
        runtime.mouseDown = true;
        // only counts as a trigger pull once the pointer is actually captured,
        // so the click that re-acquires the lock does not fire the gun
        if (locked) runtime.mouseClicked = true;
      }
      if (e.button === 2 && locked) dashQueued.current = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) runtime.mouseDown = false;
    };
    const onWheel = (e: WheelEvent) => {
      const st = useGame.getState();
      if (st.status !== 'playing' || document.pointerLockElement !== gl.domElement) return;
      e.preventDefault();
      st.cycleWeapon(e.deltaY > 0 ? 1 : -1);
    };
    const onBlur = () => {
      runtime.keys.clear();
      runtime.mouseDown = false;
      runtime.mouseClicked = false;
    };
    const onPointerLockChange = () => {
      const st = useGame.getState();
      if (document.pointerLockElement !== gl.domElement) {
        runtime.mouseDown = false;
        runtime.mouseClicked = false;
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
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    gl.domElement.addEventListener('contextmenu', onContext);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      gl.domElement.removeEventListener('contextmenu', onContext);
    };
  }, [gl, camera]);

  // ─── per-frame simulation ────────────────────────────────────────
  useFrame((_, rawDt) => {
    const real = Math.min(rawDt, 1 / 20);
    const st = useGame.getState();
    let playing = st.status === 'playing';
    // Safety net: if we are "playing" without pointer capture (a failed re-lock,
    // a click outside the window) the player cannot aim while enemies still
    // attack — so pause until the lock comes back.
    if (playing && runtime.canvas && document.pointerLockElement !== runtime.canvas && !isLockPending()) {
      st.pause();
      playing = false;
    }
    const mods = runtime.mods;

    // global time scaling: hit-stop beats slow-mo
    runtime.hitStop = Math.max(0, runtime.hitStop - real);
    runtime.slowMo = Math.max(0, runtime.slowMo - real);
    runtime.timeScale = runtime.hitStop > 0 ? 0.04 : runtime.slowMo > 0 ? 0.4 : 1;

    const dt = Math.min(rawDt, 1 / 30) * runtime.timeScale;
    if (playing) runtime.elapsed += dt;

    const b = body.current;
    b.feet.set(runtime.playerPos.x, runtime.playerPos.y - PLAYER.eyeHeight, runtime.playerPos.z);
    const vel = b.vel;

    if (playing) {
      const keys = runtime.keys;
      let fwd = 0;
      let side = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
      const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const baseSpeed = sprinting && fwd > 0 ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const speed = baseSpeed * mods.moveSpeedMul;

      tmpDir.set(-Math.sin(runtime.yaw), 0, -Math.cos(runtime.yaw));
      tmpRight.set(Math.cos(runtime.yaw), 0, -Math.sin(runtime.yaw));
      wish.set(0, 0, 0).addScaledVector(tmpDir, fwd).addScaledVector(tmpRight, side);
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

      // ─── dash ────────────────────────────────────────────────────
      const maxCharges = Math.round(mods.dashCharges);
      if (runtime.dashCharges < maxCharges) {
        runtime.dashCooldown -= dt;
        if (runtime.dashCooldown <= 0) {
          runtime.dashCharges = Math.min(maxCharges, runtime.dashCharges + 1);
          runtime.dashCooldown = DASH.cooldown * mods.dashCooldownMul;
        }
      } else {
        runtime.dashCooldown = 0;
      }
      if (dashQueued.current && runtime.dashCharges > 0 && runtime.dashTime <= 0) {
        runtime.dashCharges--;
        if (runtime.dashCooldown <= 0) runtime.dashCooldown = DASH.cooldown * mods.dashCooldownMul;
        runtime.dashTime = DASH.duration;
        runtime.invuln = Math.max(runtime.invuln, DASH.iframes);
        runtime.dashDir.copy(wish.lengthSq() > 0 ? wish : tmpDir).setY(0).normalize();
        if (vel.y < DASH.lift) vel.y = Math.min(vel.y + DASH.lift, DASH.lift);
        runtime.shake = Math.min(1, runtime.shake + 0.12);
        audio.dash();
        dashFxPos.set(b.feet.x, b.feet.y + 0.6, b.feet.z);
        fx.burst(dashFxPos, '#67e8f9', 22, 7, 0.09, -3);
      }
      dashQueued.current = false;

      const dashing = runtime.dashTime > 0;
      if (dashing) {
        runtime.dashTime -= dt;
        vel.x = runtime.dashDir.x * DASH.speed;
        vel.z = runtime.dashDir.z * DASH.speed;
        if (Math.random() < 0.6) {
          dashFxPos.set(b.feet.x, b.feet.y + 0.5 + Math.random() * 0.8, b.feet.z);
          fx.burst(dashFxPos, '#22d3ee', 2, 1.2, 0.06, -1);
        }
      } else {
        const control = b.grounded ? 1 : PLAYER.airControl;
        const accel = PLAYER.acceleration * control;
        vel.x += (wish.x - vel.x) * Math.min(1, (accel * dt) / Math.max(speed, 1));
        vel.z += (wish.z - vel.z) * Math.min(1, (accel * dt) / Math.max(speed, 1));
        if (b.grounded && wish.lengthSq() === 0) {
          const f = Math.max(0, 1 - PLAYER.friction * dt);
          vel.x *= f;
          vel.z *= f;
        }
      }

      // ─── jumping: coyote time + input buffering + double jump ────
      const jumpPower = PLAYER.jumpVelocity * mods.jumpMul;
      const buffered = runtime.elapsed - jumpPressedAt.current < PLAYER.jumpBuffer;
      const coyote = runtime.elapsed - lastGroundedAt.current < PLAYER.coyoteTime;
      if (buffered && (b.grounded || coyote)) {
        vel.y = jumpPower;
        b.grounded = false;
        lastGroundedAt.current = -10;
        jumpPressedAt.current = -10;
        usedDoubleJump.current = false;
        audio.jump();
      } else if (buffered && mods.doubleJump && !usedDoubleJump.current && !b.grounded) {
        vel.y = jumpPower * 0.92;
        usedDoubleJump.current = true;
        jumpPressedAt.current = -10;
        audio.doubleJump();
        dashFxPos.set(b.feet.x, b.feet.y + 0.2, b.feet.z);
        fx.burst(dashFxPos, '#a5f3fc', 16, 4, 0.07, -3);
      }

      // gravity (dashes float a little)
      vel.y += PLAYER.gravity * (dashing ? 0.25 : 1) * dt;

      b.feet.addScaledVector(vel, dt);
      resolveBody(b, true);

      if (b.grounded) {
        lastGroundedAt.current = runtime.elapsed;
        usedDoubleJump.current = false;
        // jump pads fling you across the arena
        const pad = jumpPadAt(b.feet.x, b.feet.z, b.feet.y);
        if (pad && vel.y <= 0.01) {
          vel.y = pad.power * Math.sqrt(mods.jumpMul);
          b.grounded = false;
          audio.jumpPad();
          dashFxPos.set(b.feet.x, b.feet.y + 0.1, b.feet.z);
          fx.burst(dashFxPos, '#4ade80', 26, 6, 0.1, -4);
        }
      }

      if (b.grounded && !wasGrounded.current) audio.land();
      wasGrounded.current = b.grounded;

      const horizSpeed = Math.hypot(vel.x, vel.z);
      if (b.grounded && horizSpeed > 0.5) bobTime.current += dt * horizSpeed * 1.6;

      runtime.shake = Math.max(0, runtime.shake - dt * 2.2);
      runtime.recoil = Math.max(0, runtime.recoil - dt * 0.25);
      runtime.invuln = Math.max(0, runtime.invuln - dt);
      runtime.playerGrounded = b.grounded;

      // Nanoweave regeneration — pooled so the store is not written every frame
      if (mods.regenPerSec > 0 && st.health < st.maxHealth) {
        regenPool.current += mods.regenPerSec * dt;
        if (regenPool.current >= 1) {
          const whole = Math.floor(regenPool.current);
          regenPool.current -= whole;
          st.healPlayer(whole);
        }
      }

      // decay the damage-direction arrows and floating numbers
      for (let i = runtime.damageDirs.length - 1; i >= 0; i--) {
        runtime.damageDirs[i].life += dt;
        if (runtime.damageDirs[i].life > 1.1) runtime.damageDirs.splice(i, 1);
      }
      for (let i = runtime.damageNumbers.length - 1; i >= 0; i--) {
        const n = runtime.damageNumbers[i];
        n.life += dt;
        n.pos.y += dt * 0.9;
        if (n.life > 0.95) runtime.damageNumbers.splice(i, 1);
      }

      st.tickCombo(runtime.elapsed);
    }

    runtime.playerPos.set(b.feet.x, b.feet.y + PLAYER.eyeHeight, b.feet.z);

    // ─── camera ────────────────────────────────────────────────────
    const bob = Math.sin(bobTime.current) * 0.035;
    const bobX = Math.cos(bobTime.current * 0.5) * 0.02;
    const sh = runtime.shake * settings.screenShake;
    const shakeX = (Math.random() - 0.5) * sh * 0.12;
    const shakeY = (Math.random() - 0.5) * sh * 0.12;
    camera.position.set(
      runtime.playerPos.x + bobX + shakeX,
      runtime.playerPos.y + bob + shakeY,
      runtime.playerPos.z,
    );
    // a slight roll when strafing, plus dash lean
    const strafe = runtime.keys.has('KeyD') ? 1 : runtime.keys.has('KeyA') ? -1 : 0;
    const roll = playing ? -strafe * 0.014 - (runtime.dashTime > 0 ? 0.03 : 0) : 0;
    camera.rotation.set(runtime.pitch + runtime.recoil, runtime.yaw, roll, 'YXZ');

    // FOV: base setting + sprint/dash widening
    const speedNow = Math.hypot(runtime.playerVel.x, runtime.playerVel.z);
    const fovTarget =
      settings.fov + (runtime.dashTime > 0 ? 12 : Math.min(8, Math.max(0, speedNow - 7) * 1.6));
    fovCurrent.current += (fovTarget - fovCurrent.current) * Math.min(1, real * 8);
    if (Math.abs(camera.fov - fovCurrent.current) > 0.01) {
      camera.fov = fovCurrent.current;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

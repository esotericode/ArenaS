# NEON SIEGE — Agent Handoff Notes

A first-person 3D arena wave shooter built with React + Vite + Tailwind + Three.js
(`@react-three/fiber`) and Zustand. This document is for the *next* agent picking up
the project. Read this before changing anything.

## Iteration log
- **v1 (agent 1):** Initial game from scratch. FPS controller (WASD, sprint, jump,
  mouse look, pointer lock), AABB collision with climbable obstacles, hitscan
  Pulse Rifle with recoil/spread/reload/headshots, three enemy types with chase AI,
  separation, obstacle-jumping and melee attacks, wave director with scaling
  difficulty, health/ammo pickups, particle & tracer FX, procedural Web Audio SFX,
  HUD (crosshair, health, ammo, wave, score, radar, damage vignette, hit markers),
  menus (title / pause / game over), localStorage best score.

## Architecture

```
src/
  App.tsx                 root: <Scene/> + <HUD/> + <Menus/>
  game/
    config.ts             ALL tuning constants (player, weapon, enemies, waves, arena layout)
    runtime.ts            mutable per-frame state outside React (positions, input, shake)
    store.ts              Zustand store — UI-facing state + game actions (damage, spawn, waves…)
    physics.ts            AABB collision (resolveBody) + groundHeightAt
    audio.ts              procedural SFX (no asset files)
    Scene.tsx             <Canvas> setup, composes all systems
    World.tsx             floor, walls, obstacles (group name="world" — used by raycasts)
    Player.tsx            input listeners + movement/jump/camera
    Weapon.tsx            viewmodel gun + hitscan firing + reload timer
    Enemies.tsx           per-enemy AI/animation; group name="enemies", userData.enemyId
    Pickups.tsx           health / ammo pickups
    Effects.tsx           imperative `fx` bus (particles + tracers) rendered via InstancedMesh
    WaveDirector.tsx      wave state machine: intermission -> spawning -> active
  ui/
    HUD.tsx               in-game overlay (re-renders every frame via useTick)
    Menus.tsx             title / pause / game-over panels; pointer-lock requests
```

### Key conventions
- **Time:** `runtime.elapsed` is game time (only advances while `status === 'playing'`).
  Use it for all gameplay timers so pausing works.
- **Positions:** `runtime.playerPos` is the *eye* position; enemy `pos` is the *feet*.
- **Raycast hits:** bullets raycast against the `world` group and `enemyGroup`. Meshes
  named `head` count as headshots. Cosmetic meshes should set `raycast={noRaycast}`.
- **Enemy lifecycle:** store `enemies[]` drives React mounting; `runtime.enemies` Map
  holds live positions for AI/radar. Both are cleaned up on death.
- **FX:** call `fx.burst(pos, color, count, speed, size, gravity)` / `fx.tracer(a, b)`
  from anywhere — no React involved.

## Known rough edges / bugs to look at
- Enemies attack through thin cover (no line-of-sight check).
- Enemy stuck-detection can make them hop when crowded; tune in `Enemies.tsx`.
- Pointer lock re-acquire can fail if the user presses Escape and clicks Resume
  within ~1s (browser restriction) — a second click works.
- No mobile / touch support.
- Shadows from many enemies may be heavy on low-end GPUs; consider disabling
  `castShadow` on enemies beyond some count.

## Backlog / ideas (pick anything)
- **Weapons:** shotgun, railgun, grenade launcher; weapon switching (1/2/3, scroll);
  projectile weapons using the physics helpers; weapon pickups.
- **Enemies:** ranged enemy that shoots projectiles; shielded enemy; boss every 5 waves;
  death animations/ragdoll-ish tumble instead of instant despawn; damage numbers.
- **Movement:** double jump, dash (with cooldown), slide, mantling; coyote time.
- **Progression:** between-wave upgrade shop (spend score on damage/health/speed);
  perks; unlockable weapons; combo multiplier for kill streaks.
- **World:** multiple arenas, moving platforms, jump pads, hazards (lava pits, lasers),
  destructible crates, better lighting/bloom (`@react-three/postprocessing`).
- **Polish:** hit-stop / kill feed, minimap enemy icons per type, settings menu
  (sensitivity, FOV, volume), gamepad support, screen-space blood/damage direction
  indicator, music loop (procedural or generated).
- **Tech:** move AI into a single system loop for perf if enemy counts grow; spatial
  hash for separation; object pooling for enemies.

## Controls
WASD move · Mouse look · LMB fire (hold) · Space jump · Shift sprint · R reload ·
Esc pause · M mute

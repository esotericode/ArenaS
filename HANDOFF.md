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
- **v2 (agent 2):** Arsenal & progression pass.
  - **Weapons:** three of them (Pulse Rifle / Scatter Cannon / Rail Driver), each with
    its own view model, ammo pools, pellets, piercing, damage falloff and recoil.
    Switch with `1`/`2`/`3`, `Q` (last used) or the scroll wheel. Guns unlock as the
    siege escalates (wave 2 and wave 4).
  - **Progression:** roguelite **augments** — after every cleared wave you pick one of
    three cards (17 of them, three rarities, stackable). They feed a derived `Mods`
    object that every system reads per frame.
  - **Enemies:** new **Spitter** (ranged, holds a firing line, strafes) and the
    **Warden** boss every 5th wave (shoulder cannons, ground-slam shockwave, enrage
    below 35% HP, dedicated HUD health bar).
  - **Projectiles:** a pooled projectile system for enemy fire, with world and player
    collision.
  - **Movement:** dash with charges + i-frames (`RMB` / `Ctrl`), coyote time, jump
    buffering, double jump (augment), and jump pads in the arena.
  - **Feel:** hit-stop on heavy kills, Overdrive slow-motion on wave clear, floating
    damage numbers, crits, kill combo multiplier, kill feed, damage-direction
    indicator, camera roll/FOV kick, per-weapon crosshairs.
  - **Audio:** scheduled procedural music bed whose intensity tracks the fight, plus a
    pile of new SFX.
  - **Settings:** sensitivity / FOV / volume / screen-shake / invert-Y / damage numbers,
    persisted to localStorage.
  - **Fixes:** enemies can no longer attack through cover (line-of-sight check),
    crowded enemies no longer pogo, pointer-lock re-acquire now retries through the
    browser cooldown, and the game auto-pauses if it is ever left running without
    pointer capture.
  - **Tooling:** `npm run smoke` — a headless Playwright run that drives the game
    through every major state and fails on any console error.

## Architecture

```
src/
  App.tsx                 root: <Scene/> + <HUD/> + <Menus/>
  game/
    config.ts             ALL tuning constants (player, dash, weapons, enemies,
                          waves, augments, arena layout, jump pads)
    runtime.ts            mutable per-frame state outside React (positions, input,
                          shake, timeScale, dash state, mods, damage numbers)
    settings.ts           user settings + localStorage persistence
    store.ts              Zustand store — UI-facing state + game actions
    weapons.ts            weapon stats after augment modifiers
    physics.ts            AABB collision, ground height, ray/AABB sweep,
                          line-of-sight, jump-pad lookup
    pointerLock.ts        pointer lock with retry through the browser cooldown
    audio.ts              procedural SFX + scheduled music bed (no asset files)
    Scene.tsx             <Canvas> setup, composes all systems
    World.tsx             floor, walls, obstacles, jump pads (group name="world")
    Player.tsx            input listeners, movement, dash, jumping, camera, time scale
    Weapon.tsx            view models + hitscan firing + reload timer
    Enemies.tsx           per-enemy AI/animation; group name="enemies"
    Projectiles.tsx       pooled enemy projectiles (imperative `projectiles` bus)
    Pickups.tsx           health / ammo pickups
    Effects.tsx           imperative `fx` bus (particles, tracers, beams, rings)
    WaveDirector.tsx      wave state machine + augment offers + music intensity
  ui/
    HUD.tsx               in-game overlay (re-renders every frame via useTick)
    Menus.tsx             title / pause / game-over / augment screens
    Augments.tsx          the three-card augment picker
    Settings.tsx          settings panel
scripts/
  smoke.mjs               headless end-to-end smoke test
```

### Key conventions
- **Time:** `runtime.elapsed` is game time. `Player.tsx` owns the clock: it computes
  `runtime.timeScale` (hit-stop beats slow-mo beats 1) and advances `elapsed` by
  `dt * timeScale` only while `status === 'playing'`. Every system multiplies its own
  delta by `runtime.timeScale`, so pausing, hit-stop and Overdrive all work for free.
  Use `runtime.elapsed` for gameplay timers, raw `dt` only for view-model cosmetics.
- **Positions:** `runtime.playerPos` is the *eye* position; enemy `pos` is the *feet*.
- **Augments:** never read augment stacks in a system. `store.recomputeMods()` folds
  them into `runtime.mods` (a plain `Mods` object) and systems read that. Add a knob
  by extending `Mods`/`BASE_MODS` in `config.ts` and writing an `apply` function.
- **Raycast hits:** bullets raycast against the `world` group and `enemyGroup`. Meshes
  named `head` count as headshots. Cosmetic meshes should set `raycast={noRaycast}`.
- **Enemy lifecycle:** store `enemies[]` drives React mounting; `runtime.enemies` Map
  holds live positions for AI/radar/HUD. Both are cleaned up on death.
- **FX:** `fx.burst / fx.tracer / fx.beam / fx.ring` and `projectiles.spawn` are
  imperative — call them from anywhere, no React involved.
- **Status:** `'menu' | 'playing' | 'paused' | 'gameover' | 'augment'`. Anything other
  than `'playing'` freezes the simulation. `Menus.tsx` renders for every non-playing
  status, so a new status needs a branch there.
- **Debugging:** `window.__game` (the store) and `window.__runtime` are exposed in
  `main.tsx`. In devtools: `__game.setState({ health: 999 })`,
  `__runtime.mods.damageMul = 10`, `__game.getState().spawnEnemy('warden', [0,0,-10])`.

## Testing

```bash
npm install
npm run dev     # play it
npm run build   # production bundle (single inlined HTML file)
npm run smoke   # headless playthrough — 12 checks, fails on any console error
```

`npm run smoke` needs a Chromium binary. It auto-detects the one under
`$PLAYWRIGHT_BROWSERS_PATH` (or `/opt/pw-browsers`), or set `CHROMIUM_PATH`. If it
cannot find either, it prints `SKIP` and exits 0 rather than failing the build.
Screenshots of every stage land in `.smoke/` — useful for eyeballing a change.

Two gotchas when extending it: headless Chromium never grants pointer lock (the script
fakes `document.pointerLockElement`, without which the player cannot look, move or
fire), and software rendering is slow enough that `runtime.elapsed` crawls — poll for
the state you want, never assert on wall-clock timing.

## Known rough edges / bugs to look at
- Enemies have no pathfinding. They walk straight at you and rely on stuck-detection
  to hop obstacles, so deeply concave cover can still hold them up.
- The Warden is easy to kite around the tall pillars — it has no repositioning logic
  and its volley arcs, so it is dodgeable at range. It needs a second mechanic.
- Augments are offered every wave and the pool can run dry in a very long run; once
  everything is at `maxStacks`, `rollAugments` offers fewer than three, and nothing at
  all if the pool is empty (the panel is then skipped silently).
- Damage numbers are DOM nodes projected from world space, capped at 40. A much bigger
  crowd would want an instanced/canvas approach.
- Shadows from many enemies are still heavy on low-end GPUs; consider disabling
  `castShadow` past some enemy count.
- Reload and fire timers run on game time, so reloading during Overdrive takes longer
  in real seconds. Intentional, but it can feel sluggish.
- No mobile / touch support.
- The single-file build is ~1.26 MB (348 kB gzipped) — mostly Three.js.

## Backlog / ideas (pick anything)
- **Weapons:** grenade/rocket launcher using `projectiles` (the system already supports
  player-owned shots — wire up `owner` and a blast); a charge-up mechanic for the Rail
  Driver; alt-fire; weapon-specific augments.
- **Enemies:** shielded enemy that must be flanked; a flyer that ignores terrain; a
  second boss with a different pattern; death animations instead of instant despawn.
- **Progression:** a between-run meta layer (permanent unlocks bought with score);
  augment *rerolls* or a banish; curse/blessing cards that trade power for risk.
- **World:** multiple arenas, moving platforms, hazards (lava, lasers), destructible
  crates, a proper skybox, bloom via `@react-three/postprocessing`.
- **Polish:** gamepad support, a proper scoreboard/run history, replay of the best run,
  screen-space blood, environmental reactions to the music.
- **Tech:** move enemy AI into one system loop instead of per-enemy `useFrame`; spatial
  hash for separation; object pooling for enemies; a fixed-timestep accumulator so
  physics is frame-rate independent.

## Controls
WASD move · Mouse look · LMB fire · Space jump · Shift sprint · RMB / Ctrl dash ·
1/2/3 weapons · Q or wheel quick swap · R reload · Esc pause · M mute

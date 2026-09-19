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

- **v2.1 (agent 2):** Bugfix and polish pass — no new mechanics. Fourteen defects,
  each one reasoned from the code and, where it could be observed from outside,
  pinned by a regression check in `npm run smoke`.
  - **Input survived the pointer-lock handshake.** `pointerlockchange` cleared held
    keys and buttons when the lock was *lost* but not when it was *gained*, so the
    click that started or resumed a run was still down on the first live frame —
    firing a shot, and starting you already walking if you had a key down.
  - **Space and Tab were swallowed unconditionally**, so neither could activate a
    focused button nor move focus in the menus. They are only intercepted in play now.
  - **The world clock never stopped.** `timeScale` was derived only from hit-stop and
    slow-mo, so it sat at 1 while paused: particles and tracers kept flying behind the
    pause and augment panels, and a paused Overdrive burned its slow-motion in real time.
  - **Screen shake and recoil never settled** once a run ended — they were decayed
    inside the `playing` branch but applied to the camera every frame, so the camera
    twitched forever through the game-over panel and back on the title screen.
  - **Weapon spread was built on world axes**, so the cone skewed and degenerated as
    you looked up or down. Worst on the nine-pellet Scatter Cannon. It now comes off
    the camera's own right/up vectors and stays circular at any pitch.
  - **Every Spitter in a wave fired in unison, instantly.** Their ranged cooldown was
    seeded with a fixed time in the past, so it read as already expired the moment they
    finished materialising. It is seeded from the spawn moment with a random offset now.
  - **The Rail Driver lived in pity-drop mode.** The bonus ammo drop triggered below a
    flat reserve of 30, but the Rail's entire reserve caps at 20 — so carrying it
    doubled the drop rate for the whole run. The threshold scales to the weapon.
  - **Damage-direction arrows were keyed by array index** while entries are spliced out
    of the middle, so React reused one hit's node for another and the arrows jumped.
  - **The sound label desynced from the M key** (the menu kept a private copy of the
    mute flag), and muting from the menu then took two clicks to undo.
  - **The music burst on return from a backgrounded tab** — throttled timers plus a running
    audio clock meant the catch-up loop replayed every missed note at once.
  - Smaller: a pending pointer-lock retry could recapture the mouse on the game-over
    screen; hit flash decayed on real time instead of game time; damage numbers and hit
    arrows hung frozen on the death screen; ring and beam rendering allocated a `Color`
    per instance per frame.

- **v2.2 (agent 2):** Aim calibration and frame-rate work.
  - **Aim is now 1:1 with CS2.** `settings.sensitivity` is on the same scale as CS2's:
    1 here turns exactly as 1 does there at the same mouse DPI, so eDPI and cm/360
    carry across unchanged. The old scale was an opaque multiplier that ran ~5.7x
    faster (9.1 cm/360 at 800 DPI, where CS2 sens 1 is 51.95 cm).
  - Stored settings carry a `version`; v1 saves reset `sensitivity` to the new default,
    because the old number means nothing on the new scale.
  - Pointer lock now **detects** whether it was granted raw input instead of falling
    back silently, and the settings panel says which one you have.
  - Enemies stop casting shadows past `ENEMY_SHADOW_DISTANCE`. With 40 distant enemies
    that is 481 -> 216 draw calls per frame (-55%) and 51k -> 18k triangles.
  - The HUD re-render and the radar redraw are capped (120Hz / 60Hz) so a high-refresh
    display does not spend frame time reconciling React for numbers nobody reads that
    fast. The 3D scene still renders every frame.

## Aim: the 1:1 contract

`RADIANS_PER_COUNT = 0.022 * PI / 180` in `config.ts` is the Source-engine `m_yaw`
constant. `Player.tsx` does `yaw -= movementX * sensitivity * RADIANS_PER_COUNT`, and
pitch uses the same constant (CS2's `m_pitch` is also 0.022). **Do not add smoothing,
easing, or any per-frame accumulation to that path** — it is applied straight from the
mouse event. Regression checks assert both the exact degrees-per-count and that 900
counts in one event equal 300 events of 3 counts.

The 1:1 claim depends on `movementX` being raw mouse counts, which holds only under
Chromium: it grants `unadjustedMovement` (no OS pointer acceleration) and reports
`movementX` in physical pixels, unscaled by display scaling or page zoom. Firefox and
Safari reject `unadjustedMovement`, apply OS acceleration, and report CSS pixels scaled
by `devicePixelRatio` — they cannot be matched exactly, and the settings panel says so
rather than pretending otherwise. `isRawInput()` in `pointerLock.ts` is the source of truth.

cm/360 is independent of FOV, so the match holds at any field of view. FOV still changes
how tracking *feels* (monitor-distance matching); the slider is there for that.

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

The suite covers the main states and then re-checks the specific bugs fixed in v2.1
(input cleared on lock, the clock freezing when paused, menus keeping Space and Tab,
shake settling after a run, the mute label following the M key). When you fix something
observable from outside, add a check rather than trusting it to stay fixed.

`npm run smoke` needs a Chromium binary. It auto-detects the one under
`$PLAYWRIGHT_BROWSERS_PATH` (or `/opt/pw-browsers`), or set `CHROMIUM_PATH`. If it
cannot find either, it prints `SKIP` and exits 0 rather than failing the build.
Screenshots of every stage land in `.smoke/` — useful for eyeballing a change.

Two gotchas when extending it: headless Chromium never grants pointer lock (the script
fakes `document.pointerLockElement`, without which the player cannot look, move or
fire), and software rendering is slow enough that `runtime.elapsed` crawls — poll for
the state you want, never assert on wall-clock timing.

## Releasing

`npm run build` inlines everything into a single `dist/index.html`, so the playable
artifact is one file. `.github/workflows/release.yml` builds it, renames it to
`neon-siege.html` and attaches it to a GitHub Release.

```bash
git tag v2.1.0 && git push origin v2.1.0   # tag push publishes the release
```

It also accepts a manual `workflow_dispatch` with a `tag` input. The job type-checks
before building, so a broken tree fails the release instead of publishing it. Keep the
tag and `package.json`'s `version` in step.

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
- Frame rate is capped by the display's refresh through `requestAnimationFrame` — a
  browser cannot run faster than vsync. What GPU cost remains is dominated by the single
  shadow-casting directional light (2048 map) and MSAA at `dpr` up to 1.75. Those are the
  next knobs, ideally behind a quality setting rather than lowered for everyone.
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

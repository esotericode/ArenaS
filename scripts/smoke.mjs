/**
 * Headless smoke test for NEON SIEGE.
 *
 *   npm run smoke
 *
 * Builds nothing itself — run `npm run build` first (the npm script does).
 * It serves `dist/`, drives the game through its main states, and fails if the
 * browser logged a single error. Screenshots land in `.smoke/`.
 *
 * The game exposes `window.__game` (the zustand store) and `window.__runtime`
 * (the per-frame state) specifically so this script — and you, in devtools —
 * can poke at it. Headless Chromium never grants pointer lock, so the script
 * fakes `document.pointerLockElement`; without that the player cannot look,
 * move or fire.
 *
 * Note: with software rendering the frame rate is low, and game time only
 * advances ~1/30s per frame, so `runtime.elapsed` crawls. Never assert on
 * wall-clock timing here — poll for the state you want instead.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.SMOKE_PORT ?? 4173);
const URL = `http://localhost:${PORT}/`;
const OUT = '.smoke';

/** Playwright ships no browser here; find the one the image provides. */
function findChromium() {
  const explicit = process.env.CHROMIUM_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return null;
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('chromium')) continue;
    const candidate = path.join(root, dir, 'chrome-linux', 'chrome');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.log('SKIP: playwright is not installed (npm i -D playwright)');
  process.exit(0);
}
const executablePath = findChromium();
if (!executablePath) {
  console.log('SKIP: no Chromium binary found — set CHROMIUM_PATH to run this locally');
  process.exit(0);
}
if (!existsSync('dist/index.html')) {
  console.error('FAIL: dist/index.html missing — run `npm run build` first');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

// ─── serve the build ──────────────────────────────────────────────────
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: false,
});
const stop = () => {
  try {
    server.kill('SIGTERM');
  } catch {
    /* already gone */
  }
};
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server never answered on ${URL}`);
}
await waitForServer();

// ─── drive the game ───────────────────────────────────────────────────
const browser = await playwright.chromium.launch({
  executablePath,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    configurable: true,
    get() {
      return document.querySelector('canvas');
    },
  });
});

const errors = [];
page.on('console', (m) => {
  // the favicon 404 from `vite preview` is not our problem
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.stack || e.message)));

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Poll the store until `fn` returns truthy, or give up. */
async function until(fn, timeoutMs = 45000, keepPlaying = true) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const state = await page.evaluate((keep) => {
      const g = window.__game.getState();
      if (keep && g.status === 'paused') window.__game.setState({ status: 'playing' });
      return {
        status: g.status,
        wave: g.wave,
        waveState: g.waveState,
        enemies: g.enemies.length,
        health: Math.round(g.health),
        score: g.score,
        kills: g.kills,
        weapon: g.weapon,
        unlocked: g.unlocked,
        offers: g.offers,
        augments: g.augments,
        bossId: g.bossId,
        elapsed: +window.__runtime.elapsed.toFixed(2),
      };
    }, keepPlaying);
    if (fn(state)) return state;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/01-menu.png` });
check('title screen renders', await page.getByRole('button', { name: /deploy/i }).isVisible());

await page.getByRole('button', { name: /deploy/i }).click();
const playing = await until((s) => s.status === 'playing' && s.wave >= 1, 60000);
check('wave 1 starts', !!playing, playing ? `wave ${playing.wave}` : 'timed out');
await page.screenshot({ path: `${OUT}/02-playing.png` });

// movement + dash + firing
async function tap(code, ms = 150) {
  await page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
  await page.waitForTimeout(ms);
  await page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
}
const before = await page.evaluate(() => window.__runtime.playerPos.z);
await tap('KeyW', 900);
await tap('Space', 80);
await tap('ControlLeft', 60);
await page.waitForTimeout(600);
const after = await page.evaluate(() => window.__runtime.playerPos.z);
check('player moves', Math.abs(after - before) > 0.5, `z ${before.toFixed(2)} → ${after.toFixed(2)}`);

// weapon unlock + switching
await page.evaluate(() => {
  const g = window.__game.getState();
  g.unlockWeapon('scatter');
  g.unlockWeapon('rail');
});
for (const w of ['scatter', 'rail', 'rifle']) {
  await page.evaluate((weapon) => {
    window.__game.setState({ status: 'playing' });
    window.__game.getState().selectWeapon(weapon);
  }, w);
  await page.waitForTimeout(500);
  const now = await page.evaluate(() => window.__game.getState().weapon);
  check(`switch to ${w}`, now === w, now);
  await page.screenshot({ path: `${OUT}/03-weapon-${w}.png` });
}

// firing consumes ammo
const magBefore = await page.evaluate(() => window.__game.getState().mags.rifle);
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => {
    window.__game.setState({ status: 'playing' });
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  await page.waitForTimeout(150);
}
const magAfter = await page.evaluate(() => window.__game.getState().mags.rifle);
check('firing consumes ammo', magAfter < magBefore, `${magBefore} → ${magAfter}`);

// clearing a wave offers an augment
await page.evaluate(() =>
  window.__game.setState({ status: 'playing', waveState: 'active', enemies: [], offers: [] }),
);
const offered = await until((s) => s.status === 'augment' && s.offers.length > 0, 60000, false);
check('wave clear offers augments', !!offered, offered ? offered.offers.join(', ') : 'timed out');
await page.screenshot({ path: `${OUT}/04-augments.png` });

if (offered) {
  await page.evaluate(() => {
    const g = window.__game.getState();
    g.chooseAugment(g.offers[0]);
    window.__game.setState({ status: 'playing' });
  });
  await page.waitForTimeout(500);
  const picked = await page.evaluate(() => Object.keys(window.__game.getState().augments).length);
  check('augment applies', picked === 1, `${picked} installed`);
}

// boss
await page.evaluate(() => {
  window.__game.setState({ status: 'playing', wave: 5, waveState: 'active' });
  window.__game.getState().spawnEnemy('warden', [0, 0, -14]);
});
const bossUp = await until((s) => s.bossId !== null, 20000);
check('boss spawns', !!bossUp);
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const g = window.__game.getState();
  if (g.bossId) g.damageEnemy(g.bossId, 300, { headshot: true, crit: true });
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/05-boss.png` });

// enemies actually hurt the player
await page.evaluate(() => {
  const g = window.__game.getState();
  window.__game.setState({ status: 'playing', health: 100 });
  g.spawnEnemy('spitter', [5, 0, 5]);
  g.spawnEnemy('grunt', [2, 0, 4]);
});
const hurt = await until((s) => s.health < 100 || s.status === 'gameover', 60000);
check('enemies damage the player', !!hurt, hurt ? `health ${hurt.health}` : 'timed out');
await page.screenshot({ path: `${OUT}/06-combat.png` });

// ── regression checks for previously-fixed bugs ───────────────────────
// Held input used to survive the pointer-lock handshake, so the click that
// resumed a run fired a shot the instant play came back.
await page.evaluate(() => window.__game.setState({ status: 'playing' }));
const inputCleared = await page.evaluate(() => {
  window.__runtime.mouseDown = true;
  window.__runtime.mouseClicked = true;
  window.__runtime.keys.add('KeyW');
  document.dispatchEvent(new Event('pointerlockchange'));
  return {
    mouseDown: window.__runtime.mouseDown,
    mouseClicked: window.__runtime.mouseClicked,
    keys: window.__runtime.keys.size,
  };
});
check(
  'pointer lock clears held input',
  !inputCleared.mouseDown && !inputCleared.mouseClicked && inputCleared.keys === 0,
  JSON.stringify(inputCleared),
);

// The world clock only tracked hit-stop and slow-mo, so effects kept animating
// behind the pause and augment panels.
await page.evaluate(() => window.__game.setState({ status: 'paused' }));
await page.waitForTimeout(600);
const pausedScale = await page.evaluate(() => window.__runtime.timeScale);
check('paused game freezes the clock', pausedScale === 0, `timeScale ${pausedScale}`);
await page.evaluate(() => window.__game.setState({ status: 'playing' }));
await page.waitForTimeout(300);
const resumedScale = await page.evaluate(() => window.__runtime.timeScale);
check('resuming restarts the clock', resumedScale === 1, `timeScale ${resumedScale}`);

// Shake was decayed on the game clock but applied to the camera unconditionally,
// so it never settled once a run ended.
const shakeSettled = await page.evaluate(async () => {
  window.__game.setState({ status: 'gameover' });
  // realistic post-burst values; recoil settles at 0.25/s
  window.__runtime.shake = 1;
  window.__runtime.recoil = 0.1;
  await new Promise((r) => setTimeout(r, 1500));
  return { shake: window.__runtime.shake, recoil: window.__runtime.recoil };
});
// Assert "settled", not "exactly zero" — how far the decay gets in a fixed wall
// time depends on the frame rate, and under software rendering that varies.
check(
  'shake settles after the run ends',
  shakeSettled.shake < 0.05 && shakeSettled.recoil < 0.02,
  JSON.stringify(shakeSettled),
);

// Space/Tab were swallowed unconditionally, which broke keyboard use of menus.
await page.evaluate(() => window.__game.setState({ status: 'menu' }));
await page.waitForTimeout(300);
const menuKeys = await page.evaluate(() => {
  const fire = (code) => {
    const ev = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  return { tab: fire('Tab'), space: fire('Space') };
});
check('menus keep Tab and Space', !menuKeys.tab && !menuKeys.space, JSON.stringify(menuKeys));

// The menu's sound label kept its own copy of the mute flag, so the M key
// silenced the game without the button ever noticing.
const muteLabel = await page.evaluate(async () => {
  const label = () => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Sound:/.test(b.textContent));
    return btn ? btn.textContent.trim() : null;
  };
  const before = label();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  const after = label();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
  return { before, after };
});
check(
  'M key updates the sound label',
  muteLabel.before !== null && muteLabel.before !== muteLabel.after,
  `${muteLabel.before} -> ${muteLabel.after}`,
);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
stop();

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed · screenshots in ${OUT}/`);
process.exit(failed.length ? 1 : 0);

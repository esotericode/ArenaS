import { runtime } from './runtime';

/**
 * Pointer lock, but resilient.
 *
 * Browsers refuse `requestPointerLock()` for ~1s after the user presses Escape
 * (the "user gesture required / lock suspended" rule). v1 silently failed there,
 * so clicking Resume too quickly did nothing. We now listen for the error and
 * retry a few times until the cooldown expires.
 */
const RETRY_DELAY = 350;
const MAX_ATTEMPTS = 8;

let attempts = 0;
let retryTimer: number | null = null;
let wanted = false;
/**
 * Whether the browser gave us unaccelerated, raw mouse counts.
 * `null` until a lock has been attempted, or when the browser predates the
 * promise-returning form of requestPointerLock and cannot tell us.
 */
let rawInput: boolean | null = null;
const listeners = new Set<(pending: boolean) => void>();

/**
 * true  — raw counts: aim is 1:1 with CS2 at the same DPI.
 * false — the OS applied pointer acceleration and scaling; aim cannot match exactly.
 * null  — not established yet.
 */
export function isRawInput() {
  return rawInput;
}

function notify() {
  listeners.forEach((fn) => fn(wanted && document.pointerLockElement !== runtime.canvas));
}

/** Subscribe to "a lock is being retried" so the UI can explain the wait. */
export function onLockPending(fn: (pending: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function clearRetry() {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry() {
  clearRetry();
  if (!wanted || attempts >= MAX_ATTEMPTS) {
    if (attempts >= MAX_ATTEMPTS) cancelLock();
    return;
  }
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    request();
  }, RETRY_DELAY);
}

function request() {
  const c = runtime.canvas;
  if (!c || !wanted) return;
  if (document.pointerLockElement === c) {
    cancelLock();
    return;
  }
  attempts++;
  try {
    // `unadjustedMovement` asks the platform to skip OS pointer acceleration and
    // hand over raw counts. It rejects with NotSupportedError rather than
    // falling back silently, so we can tell the player which one they got.
    const p = c.requestPointerLock({ unadjustedMovement: true } as unknown as undefined) as
      | Promise<void>
      | undefined;
    if (p && typeof p.then === 'function') {
      p.then(() => {
        rawInput = true;
        notify();
      }).catch((err: unknown) => {
        const name = (err as DOMException | undefined)?.name;
        if (name === 'NotSupportedError') {
          // Firefox, Safari, and platforms without raw input land here. Take the
          // accelerated lock — playable, just not 1:1 with CS2.
          rawInput = false;
          notify();
          try {
            const basic = c.requestPointerLock() as unknown as Promise<void> | undefined;
            if (basic && typeof basic.catch === 'function') basic.catch(() => scheduleRetry());
          } catch {
            scheduleRetry();
          }
        } else {
          // usually the post-Escape cooldown — keep asking for raw input
          scheduleRetry();
        }
      });
    }
  } catch {
    scheduleRetry();
  }
  notify();
}

/** Ask for pointer lock, retrying through the browser's cooldown. */
export function lockPointer() {
  wanted = true;
  attempts = 0;
  request();
}

/** True while we are still trying to (re)acquire the lock. */
export function isLockPending() {
  return wanted && document.pointerLockElement !== runtime.canvas;
}

/** Give up on any in-flight retry (menus, game over). */
export function cancelLock() {
  wanted = false;
  attempts = 0;
  clearRetry();
  notify();
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerlockerror', () => scheduleRetry());
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === runtime.canvas) cancelLock();
    else notify();
  });
}

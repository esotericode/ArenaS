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
const listeners = new Set<(pending: boolean) => void>();

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
    // `unadjustedMovement` gives raw mouse deltas where supported
    const p = c.requestPointerLock({ unadjustedMovement: true } as unknown as undefined) as
      | Promise<void>
      | undefined;
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        try {
          const basic = c.requestPointerLock() as unknown as Promise<void> | undefined;
          if (basic && typeof basic.catch === 'function') basic.catch(() => scheduleRetry());
        } catch {
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

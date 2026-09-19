import { settings } from './settings';

/**
 * Tiny procedural sound engine built on Web Audio – zero asset files.
 * All sounds are synthesized from oscillators and noise buffers.
 *
 * `music` is a scheduled bass/arp loop whose intensity is driven by the game
 * (see `setIntensity`), so combat feels louder than the intermissions.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private intensity = 0;
  private targetIntensity = 0;
  private muteListeners = new Set<() => void>();
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.startMusic();
      return;
    }
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : settings.volume;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 500;
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.0;
      this.musicFilter.connect(this.musicBus).connect(this.master);

      // white-noise buffer for percussive sounds
      const len = this.ctx.sampleRate * 1;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolume();
    this.muteListeners.forEach((fn) => fn());
  }

  /** Lets the UI follow mute changes made with the M key. */
  onMuteChange(fn: () => void) {
    this.muteListeners.add(fn);
    return () => {
      this.muteListeners.delete(fn);
    };
  }

  /** Called by the settings panel whenever the volume slider moves. */
  applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : settings.volume;
  }

  // ─── music ──────────────────────────────────────────────────────
  /** 0 = silent menu drone, 1 = full combat. */
  setIntensity(v: number) {
    this.targetIntensity = Math.max(0, Math.min(1, v));
  }

  private startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.scheduler(), 60);
  }

  stopMusic() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
  }

  /** Minor-key bass pattern; higher intensity opens the filter and adds an arp. */
  private static readonly BASS = [0, 0, 3, 0, 5, 3, 0, -2];
  private static readonly ROOT = 55; // A1

  private scheduler() {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter || !this.musicBus) return;
    this.intensity += (this.targetIntensity - this.intensity) * 0.08;
    const i = this.intensity;
    this.musicBus.gain.setTargetAtTime(0.02 + i * 0.1, ctx.currentTime, 0.4);
    this.musicFilter.frequency.setTargetAtTime(280 + i * 1700, ctx.currentTime, 0.4);

    const beat = 0.24 - i * 0.04;
    // Background tabs throttle timers while the audio clock keeps going; without
    // this the catch-up loop would fire every missed note at once on return.
    if (this.nextNoteTime < ctx.currentTime) this.nextNoteTime = ctx.currentTime + 0.05;
    while (this.nextNoteTime < ctx.currentTime + 0.25) {
      const t = this.nextNoteTime;
      const semi = AudioEngine.BASS[this.step % AudioEngine.BASS.length];
      const freq = AudioEngine.ROOT * Math.pow(2, semi / 12);
      this.musicNote(freq, t, beat * 1.6, 'sawtooth', 0.5);
      if (this.step % 2 === 0) this.musicNote(freq * 2, t, beat * 0.5, 'square', 0.12);
      if (i > 0.45 && this.step % 4 === 2) {
        this.musicNote(freq * 6, t, beat * 0.4, 'triangle', 0.1 * i);
      }
      if (i > 0.7 && this.step % 8 === 7) {
        this.musicNote(freq * 8, t, beat * 0.3, 'triangle', 0.08 * i);
      }
      this.step++;
      this.nextNoteTime += beat;
    }
  }

  private musicNote(freq: number, t: number, dur: number, type: OscillatorType, gain: number) {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicFilter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // ─── sfx primitives ─────────────────────────────────────────────
  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; slideTo?: number; delay?: number } = {},
  ) {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const { type = 'square', gain = 0.2, slideTo, delay = 0 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, opts: { gain?: number; filter?: number; delay?: number } = {}) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer || this.muted) return;
    const { gain = 0.2, filter = 1200, delay = 0 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filter, t0);
    f.frequency.exponentialRampToValueAtTime(100, t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  // ─── weapons ────────────────────────────────────────────────────
  shoot(weapon = 'rifle') {
    if (weapon === 'scatter') {
      this.noise(0.22, { gain: 0.38, filter: 2200 });
      this.tone(160, 0.22, { type: 'sawtooth', gain: 0.22, slideTo: 45 });
    } else if (weapon === 'rail') {
      this.tone(1400, 0.28, { type: 'sawtooth', gain: 0.16, slideTo: 180 });
      this.tone(320, 0.35, { type: 'sine', gain: 0.2, slideTo: 60 });
      this.noise(0.3, { gain: 0.16, filter: 4000 });
    } else {
      this.noise(0.08, { gain: 0.25, filter: 3000 });
      this.tone(520, 0.08, { type: 'sawtooth', gain: 0.12, slideTo: 90 });
    }
  }
  dryFire() {
    this.tone(200, 0.05, { type: 'square', gain: 0.08 });
  }
  reload() {
    this.noise(0.05, { gain: 0.12, filter: 2000 });
    this.tone(300, 0.06, { type: 'square', gain: 0.06, delay: 0.3 });
    this.tone(420, 0.08, { type: 'square', gain: 0.08, delay: 0.7 });
  }
  weaponSwap() {
    this.tone(700, 0.06, { type: 'square', gain: 0.07 });
    this.tone(1100, 0.07, { type: 'square', gain: 0.06, delay: 0.05 });
  }
  unlock() {
    this.tone(523, 0.12, { type: 'triangle', gain: 0.14 });
    this.tone(784, 0.14, { type: 'triangle', gain: 0.14, delay: 0.1 });
    this.tone(1046, 0.3, { type: 'triangle', gain: 0.14, delay: 0.2 });
  }
  hit() {
    this.tone(880, 0.05, { type: 'triangle', gain: 0.12 });
  }
  explode() {
    this.noise(0.45, { gain: 0.4, filter: 900 });
    this.tone(120, 0.4, { type: 'sawtooth', gain: 0.22, slideTo: 30 });
  }
  enemyDeath(kind: string) {
    if (kind === 'warden') {
      this.noise(1.1, { gain: 0.5, filter: 400 });
      this.tone(60, 1.2, { type: 'sawtooth', gain: 0.3, slideTo: 20 });
      this.tone(180, 0.8, { type: 'square', gain: 0.14, slideTo: 40, delay: 0.1 });
    } else if (kind === 'brute') {
      this.noise(0.5, { gain: 0.4, filter: 500 });
      this.tone(80, 0.5, { type: 'sawtooth', gain: 0.25, slideTo: 30 });
    } else {
      this.noise(0.25, { gain: 0.25, filter: 900 });
      this.tone(440, 0.2, { type: 'sawtooth', gain: 0.12, slideTo: 110 });
    }
  }
  enemyShoot(boss = false) {
    this.tone(boss ? 240 : 700, 0.12, { type: 'square', gain: 0.07, slideTo: boss ? 90 : 240 });
  }
  projectileHit() {
    this.noise(0.12, { gain: 0.18, filter: 800 });
    this.tone(220, 0.14, { type: 'sawtooth', gain: 0.12, slideTo: 70 });
  }
  bossSpawn() {
    this.tone(70, 1.4, { type: 'sawtooth', gain: 0.3, slideTo: 42 });
    this.noise(1.2, { gain: 0.25, filter: 700 });
    this.tone(210, 0.6, { type: 'square', gain: 0.12, slideTo: 105, delay: 0.5 });
  }
  hurt() {
    this.tone(160, 0.25, { type: 'sawtooth', gain: 0.2, slideTo: 60 });
    this.noise(0.15, { gain: 0.15, filter: 600 });
  }
  jump() {
    this.tone(220, 0.12, { type: 'triangle', gain: 0.08, slideTo: 440 });
  }
  doubleJump() {
    this.tone(440, 0.16, { type: 'triangle', gain: 0.09, slideTo: 880 });
  }
  dash() {
    this.noise(0.22, { gain: 0.18, filter: 2600 });
    this.tone(180, 0.2, { type: 'sawtooth', gain: 0.1, slideTo: 620 });
  }
  jumpPad() {
    this.tone(330, 0.3, { type: 'square', gain: 0.12, slideTo: 1320 });
    this.noise(0.18, { gain: 0.1, filter: 3000 });
  }
  land() {
    this.noise(0.08, { gain: 0.08, filter: 400 });
  }
  pickup() {
    this.tone(660, 0.1, { type: 'sine', gain: 0.15 });
    this.tone(990, 0.15, { type: 'sine', gain: 0.15, delay: 0.08 });
  }
  combo(n: number) {
    const base = 520 * Math.pow(2, Math.min(8, n / 5) / 12);
    this.tone(base, 0.08, { type: 'triangle', gain: 0.1 });
    this.tone(base * 1.5, 0.12, { type: 'triangle', gain: 0.1, delay: 0.06 });
  }
  augmentOffer() {
    this.tone(392, 0.2, { type: 'sine', gain: 0.12 });
    this.tone(587, 0.25, { type: 'sine', gain: 0.12, delay: 0.12 });
    this.tone(784, 0.45, { type: 'sine', gain: 0.12, delay: 0.24 });
  }
  augmentPick() {
    this.tone(880, 0.12, { type: 'triangle', gain: 0.14 });
    this.tone(1318, 0.3, { type: 'triangle', gain: 0.12, delay: 0.09 });
  }
  waveStart() {
    this.tone(330, 0.2, { type: 'square', gain: 0.1 });
    this.tone(440, 0.2, { type: 'square', gain: 0.1, delay: 0.18 });
    this.tone(660, 0.35, { type: 'square', gain: 0.12, delay: 0.36 });
  }
  waveClear() {
    this.tone(523, 0.16, { type: 'sine', gain: 0.12 });
    this.tone(659, 0.16, { type: 'sine', gain: 0.12, delay: 0.14 });
    this.tone(880, 0.4, { type: 'sine', gain: 0.13, delay: 0.28 });
  }
  gameOver() {
    this.tone(440, 0.4, { type: 'sawtooth', gain: 0.15, slideTo: 220 });
    this.tone(330, 0.5, { type: 'sawtooth', gain: 0.15, slideTo: 110, delay: 0.35 });
    this.tone(220, 0.9, { type: 'sawtooth', gain: 0.15, slideTo: 40, delay: 0.75 });
  }
}

export const audio = new AudioEngine();

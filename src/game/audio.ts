/**
 * Tiny procedural sound engine built on Web Audio – zero asset files.
 * All sounds are synthesized from oscillators and noise buffers.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // white-noise buffer for percussive sounds
      const len = this.ctx.sampleRate * 1;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; slideTo?: number; delay?: number } = {},
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const { type = 'square', gain = 0.2, slideTo, delay = 0 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, opts: { gain?: number; filter?: number; delay?: number } = {}) {
    if (!this.ctx || !this.master || !this.noiseBuffer || this.muted) return;
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
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  shoot() {
    this.noise(0.08, { gain: 0.25, filter: 3000 });
    this.tone(520, 0.08, { type: 'sawtooth', gain: 0.12, slideTo: 90 });
  }
  dryFire() {
    this.tone(200, 0.05, { type: 'square', gain: 0.08 });
  }
  reload() {
    this.noise(0.05, { gain: 0.12, filter: 2000 });
    this.tone(300, 0.06, { type: 'square', gain: 0.06, delay: 0.5 });
    this.tone(420, 0.08, { type: 'square', gain: 0.08, delay: 1.2 });
  }
  hit() {
    this.tone(880, 0.05, { type: 'triangle', gain: 0.12 });
  }
  enemyDeath(kind: string) {
    if (kind === 'brute') {
      this.noise(0.5, { gain: 0.4, filter: 500 });
      this.tone(80, 0.5, { type: 'sawtooth', gain: 0.25, slideTo: 30 });
    } else {
      this.noise(0.25, { gain: 0.25, filter: 900 });
      this.tone(440, 0.2, { type: 'sawtooth', gain: 0.12, slideTo: 110 });
    }
  }
  hurt() {
    this.tone(160, 0.25, { type: 'sawtooth', gain: 0.2, slideTo: 60 });
    this.noise(0.15, { gain: 0.15, filter: 600 });
  }
  jump() {
    this.tone(220, 0.12, { type: 'triangle', gain: 0.08, slideTo: 440 });
  }
  land() {
    this.noise(0.08, { gain: 0.08, filter: 400 });
  }
  pickup() {
    this.tone(660, 0.1, { type: 'sine', gain: 0.15 });
    this.tone(990, 0.15, { type: 'sine', gain: 0.15, delay: 0.08 });
  }
  waveStart() {
    this.tone(330, 0.2, { type: 'square', gain: 0.1 });
    this.tone(440, 0.2, { type: 'square', gain: 0.1, delay: 0.18 });
    this.tone(660, 0.35, { type: 'square', gain: 0.12, delay: 0.36 });
  }
  gameOver() {
    this.tone(440, 0.4, { type: 'sawtooth', gain: 0.15, slideTo: 220 });
    this.tone(330, 0.5, { type: 'sawtooth', gain: 0.15, slideTo: 110, delay: 0.35 });
    this.tone(220, 0.9, { type: 'sawtooth', gain: 0.15, slideTo: 40, delay: 0.75 });
  }
}

export const audio = new AudioEngine();

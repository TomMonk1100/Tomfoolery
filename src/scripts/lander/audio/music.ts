import { getAudioCtx } from './sfx';

// --- Music engine ---------------------------------------------------------------
// v8: still 100% synthesized and never-repeating, but now *musical* — the sub
// drone and cavern reverb remain, joined by slow minor-add9 chord swells and
// sparse pentatonic plucks through a feedback delay. Tension (level depth)
// darkens the filter and widens the reverb like before.
export class MusicEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  dry: GainNode | null = null;
  wet: GainNode | null = null;
  reverb: ConvolverNode | null = null;
  delay: DelayNode | null = null;
  padFilter: BiquadFilterNode | null = null;
  droneNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  running = false;
  enabled = true;
  tension = 0;
  timeouts: ReturnType<typeof setTimeout>[] = [];
  chordStep = 0;
  vol = 0.75;      // 0..1 user volume
  ducked = false;  // thrust ducking state, so volume changes re-apply correctly

  private applyLevel(timeConstant = 0.4) {
    if (!this.ctx || !this.master) return;
    const target = this.running ? (this.ducked ? 0.45 : 0.75) * this.vol : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, timeConstant);
  }

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    this.applyLevel(0.08);
  }

  private buildReverb(ctx: AudioContext): ConvolverNode {
    const len = Math.floor(ctx.sampleRate * 3.2);
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const decay = Math.pow(1 - i / len, 2.6);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = impulse;
    return conv;
  }

  ensure() {
    if (this.ctx) return;
    const shared = getAudioCtx();
    if (!shared) { this.enabled = false; return; }
    const ctx = shared;
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.8;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.reverb = this.buildReverb(ctx);
    this.dry.connect(this.master);
    this.wet.connect(this.reverb);
    this.reverb.connect(this.master);

    // Feedback delay for the plucks — gives them space + rhythm
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.wet);

    // Sub drone — two slow-beating low sines
    [55, 82.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.045 - i * 0.012;
      osc.connect(gain);
      gain.connect(this.dry!);
      gain.connect(this.wet!);
      osc.start();
      this.droneNodes.push({ osc, gain });
    });

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 1.4;
    lfo.connect(lfoGain);
    this.droneNodes.forEach(({ osc }) => lfoGain.connect(osc.frequency));
    lfo.start();

    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 640;
    this.padFilter.Q.value = 2;
    this.padFilter.connect(this.wet);
    this.padFilter.connect(this.dry);
  }

  // A-minor-ish progression, voiced low and soft: Am9 → F(add9) → C(add9) → Em
  private static CHORDS: number[][] = [
    [110, 164.81, 246.94, 329.63],
    [87.31, 130.81, 220, 261.63],
    [98, 146.83, 196, 293.66],
    [82.41, 123.47, 164.81, 246.94],
  ];
  private static SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];

  private playChord() {
    if (!this.ctx || !this.padFilter || !this.running) return;
    const chord = MusicEngine.CHORDS[this.chordStep % MusicEngine.CHORDS.length];
    this.chordStep++;
    const t0 = this.ctx.currentTime;
    const dur = 9;
    chord.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 === 0 ? -4 : 4);
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.028 - i * 0.004, t0 + 3);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.padFilter!);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    });
  }

  private playPluck() {
    if (!this.ctx || !this.delay || !this.running) return;
    // Stay on chord tones half the time so it always sounds intentional
    const chord = MusicEngine.CHORDS[(this.chordStep + MusicEngine.CHORDS.length - 1) % MusicEngine.CHORDS.length];
    const pool = Math.random() > 0.5 ? chord.map((f) => f * 2) : MusicEngine.SCALE;
    const freq = pool[Math.floor(Math.random() * pool.length)];
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    osc.connect(gain);
    gain.connect(this.delay);
    gain.connect(this.wet!);
    osc.start(t0);
    osc.stop(t0 + 1.5);
  }

  private playRumble() {
    if (!this.ctx || !this.wet || !this.dry || !this.running) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(38 + Math.random() * 14, t0);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
    osc.connect(gain);
    gain.connect(this.dry);
    gain.connect(this.wet);
    osc.start(t0);
    osc.stop(t0 + 3.6);
  }

  private schedule(fn: () => void, min: number, spread: number) {
    const loop = () => {
      if (!this.running) return;
      fn();
      this.timeouts.push(setTimeout(loop, min + Math.random() * spread));
    };
    this.timeouts.push(setTimeout(loop, 300 + Math.random() * 1200));
  }

  start() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (!this.running) {
      this.running = true;
      this.schedule(() => this.playChord(), 8000, 3000);
      this.schedule(() => this.playPluck(), 1600, 2600 - this.tension * 800);
      this.schedule(() => this.playRumble(), 11000, 12000);
    }
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.applyLevel(1.2);
  }

  stop() {
    this.running = false;
    this.timeouts.forEach((t) => clearTimeout(t));
    this.timeouts = [];
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8);
  }

  duck(active: boolean) {
    if (this.ducked === active) return;
    this.ducked = active;
    if (!this.running) return;
    this.applyLevel(0.3);
  }

  setTension(t: number) {
    this.tension = Math.max(0, Math.min(1, t));
    if (this.padFilter && this.ctx) {
      this.padFilter.frequency.setTargetAtTime(640 - this.tension * 320, this.ctx.currentTime, 1.5);
    }
    if (this.wet && this.ctx) {
      this.wet.gain.setTargetAtTime(0.55 + this.tension * 0.15, this.ctx.currentTime, 1.5);
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
    else this.start();
  }
}

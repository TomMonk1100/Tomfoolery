// --- Shared AudioContext ------------------------------------------------------
let sharedAudioCtx: AudioContext | null = null;
export function getAudioCtx(): AudioContext | null {
  if (sharedAudioCtx) return sharedAudioCtx;
  try {
    // @ts-ignore webkitAudioContext fallback for older Safari
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedAudioCtx = new Ctx();
  } catch (e) {
    sharedAudioCtx = null;
  }
  return sharedAudioCtx;
}

// --- SFX engine ----------------------------------------------------------------
// v8: the old thrust was a single lowpassed sawtooth — the "low hum" complaint.
// Now it's a proper rocket rumble: looped noise through a wobbling bandpass +
// a sub oscillator, with real envelopes on every one-shot.
export class AudioEngine {
  ctx: AudioContext | null = null;
  out: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  thrustNodes: { noise: AudioBufferSourceNode; sub: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  enabled = true;
  vol = 0.9; // 0..1 user volume, applied on the master sfx bus

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(0.9 * this.vol, this.ctx.currentTime, 0.05);
  }

  ensure() {
    if (this.ctx) return;
    const shared = getAudioCtx();
    if (!shared) { this.enabled = false; return; }
    try {
      this.ctx = shared;
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.9 * this.vol;
      this.out.connect(this.ctx.destination);
      const bufferSize = this.ctx.sampleRate * 1.5;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.enabled = false;
    }
  }

  startThrust() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.out || !this.noiseBuffer || this.thrustNodes) return;
    const t0 = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 620;
    band.Q.value = 0.7;

    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1600;

    // Slow wobble on the bandpass = the characteristic rocket "flutter"
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 7 + Math.random() * 3;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(band.frequency);

    const sub = this.ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.value = 46;
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.1);

    noise.connect(band);
    band.connect(low);
    low.connect(gain);
    sub.connect(subGain);
    subGain.connect(gain);
    gain.connect(this.out);

    noise.start();
    sub.start();
    lfo.start();
    this.thrustNodes = { noise, sub, lfo, gain };
  }

  stopThrust() {
    if (!this.ctx || !this.thrustNodes) return;
    const { noise, sub, lfo, gain } = this.thrustNodes;
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);
    setTimeout(() => {
      try { noise.stop(); sub.stop(); lfo.stop(); } catch (e) {}
    }, 200);
    this.thrustNodes = null;
  }

  private tone(freq: number, dur: number, type: OscillatorType, delay = 0, vol = 0.08, sweepTo?: number) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.out) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, fromFreq: number, toFreq: number, vol: number, delay = 0) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.out || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(fromFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.out);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  landingSuccess() {
    // touchdown "pssh" + a bright little arpeggio
    this.noiseBurst(0.25, 1800, 300, 0.1);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.06 + i * 0.09, 0.09));
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f * 2, 0.12, 'triangle', 0.06 + i * 0.09, 0.02));
  }

  crash() {
    this.noiseBurst(0.6, 2400, 90, 0.26);
    this.tone(60, 0.5, 'sine', 0, 0.22, 32);
  }

  select() {
    this.tone(620, 0.07, 'triangle', 0, 0.06);
    this.tone(930, 0.06, 'triangle', 0.05, 0.04);
  }

  ufoFire() {
    this.tone(900, 0.18, 'sawtooth', 0, 0.06, 180);
  }

  chuteDeploy() {
    this.noiseBurst(0.35, 900, 2200, 0.09);
  }

  boing() {
    this.tone(160, 0.3, 'sine', 0, 0.12, 480);
    this.tone(80, 0.2, 'triangle', 0, 0.08, 160);
  }

  phoenix() {
    this.noiseBurst(0.7, 500, 3400, 0.12);
    [440, 554.37, 659.25, 880].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.1 + i * 0.09, 0.09));
    this.tone(1760, 0.6, 'sine', 0.5, 0.03);
  }

  // Rarity fanfares: rank 2 = rare, 3 = epic, 4 = legendary
  raritySting(rank: number) {
    if (rank >= 4) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.5, 'sine', i * 0.11, 0.09));
      this.noiseBurst(0.8, 4000, 8000, 0.03, 0.2);
      this.tone(2093, 0.7, 'triangle', 0.55, 0.025);
    } else if (rank >= 3) {
      [523.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.35, 'sine', i * 0.1, 0.08));
    } else {
      [659.25, 987.77].forEach((f, i) => this.tone(f, 0.25, 'sine', i * 0.09, 0.07));
    }
  }
}

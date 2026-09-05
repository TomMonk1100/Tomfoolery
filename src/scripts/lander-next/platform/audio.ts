export class AudioMixer {
  private context: AudioContext | null = null;
  enabled = true;
  private ensure(): AudioContext | null { if (!this.enabled) return null; try { this.context ??= new AudioContext(); if (this.context.state === 'suspended') void this.context.resume(); return this.context; } catch { return null; } }
  cue(kind: 'thrust' | 'landing' | 'crash' | 'upgrade'): void { const context = this.ensure(); if (!context) return; const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = kind === 'crash' ? 'sawtooth' : 'sine'; oscillator.frequency.value = kind === 'landing' ? 420 : kind === 'upgrade' ? 660 : kind === 'crash' ? 90 : 150; gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(kind === 'thrust' ? 0.025 : 0.05, context.currentTime + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === 'thrust' ? 0.08 : 0.24)); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.25); }
  destroy(): void { void this.context?.close(); this.context = null; }
}

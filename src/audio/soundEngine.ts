/**
 * Web Audio API procedural Synthwave BGM & Sound Effects engine.
 * Works completely offline with zero external audio asset dependencies.
 */

const MIDI_TO_FREQ = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

// 64-step (4 bars of 16th notes) Synthwave progression: Am -> F -> C -> G
const BASS_PATTERN: number[] = [
  // Bar 1: A minor (A1 = 33, A2 = 45)
  33, 33, 45, 33, 33, 33, 45, 33, 33, 33, 45, 33, 33, 40, 45, 43,
  // Bar 2: F major (F1 = 29, F2 = 41)
  29, 29, 41, 29, 29, 29, 41, 29, 29, 29, 41, 29, 29, 36, 41, 40,
  // Bar 3: C major (C2 = 36, C3 = 48)
  36, 36, 48, 36, 36, 36, 48, 36, 36, 36, 48, 36, 36, 43, 48, 47,
  // Bar 4: G major (G1 = 31, G2 = 43)
  31, 31, 43, 31, 31, 31, 43, 31, 31, 31, 43, 31, 31, 38, 43, 45,
];

// Catchy retro-futuristic synth lead melody (0 = rest)
const LEAD_PATTERN: number[] = [
  // Bar 1 (Am)
  69, 0, 72, 0, 76, 0, 72, 74, 76, 0, 79, 0, 76, 0, 72, 0,
  // Bar 2 (F)
  69, 0, 72, 0, 77, 0, 76, 72, 74, 0, 72, 0, 69, 0, 0, 0,
  // Bar 3 (C)
  72, 0, 76, 0, 79, 0, 76, 79, 84, 0, 83, 0, 79, 0, 76, 0,
  // Bar 4 (G)
  74, 0, 79, 0, 76, 0, 74, 72, 71, 0, 74, 0, 76, 0, 72, 0,
];

const CHORD_ROOTS: number[][] = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [60, 64, 67], // C
  [55, 59, 62], // G
];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private bgmEnabled = true;
  private sfxEnabled = true;
  private bgmVolume = 0.42;
  private isPlayingBgm = false;
  private intensity = 0.35; // 0..1 controls filter brightness & tempo feel

  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  private readonly bpm = 128;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;
      this.masterGain.connect(this.ctx.destination);

      this.bgmFilter = this.ctx.createBiquadFilter();
      this.bgmFilter.type = 'lowpass';
      this.bgmFilter.frequency.value = 2400;
      this.bgmFilter.Q.value = 1.2;

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.bgmEnabled ? this.bgmVolume : 0;

      this.bgmFilter.connect(this.bgmGain);
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 0.55 : 0;
      this.sfxGain.connect(this.masterGain);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public unlockAndStartBgm(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.bgmEnabled && !this.isPlayingBgm) {
      this.startBgmLoop();
    }
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;

    const now = ctx.currentTime;
    if (enabled) {
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(this.bgmVolume, now, 0.04);
      if (!this.isPlayingBgm) {
        this.startBgmLoop();
      }
    } else {
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(0, now, 0.04);
      this.stopBgmLoop();
    }
  }

  public setBgmVolume(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.bgmGain && this.bgmEnabled) {
      this.bgmGain.gain.setTargetAtTime(this.bgmVolume, this.ctx.currentTime, 0.03);
    }
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    if (this.ctx && this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(enabled ? 0.55 : 0, this.ctx.currentTime, 0.02);
    }
  }

  public setIntensity(intensity: number): void {
    this.intensity = Math.max(0, Math.min(1, intensity));
    if (this.ctx && this.bgmFilter) {
      const targetFreq = 1600 + this.intensity * 6400;
      this.bgmFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.12);
    }
  }

  private startBgmLoop(): void {
    if (!this.ctx || this.isPlayingBgm) return;
    this.isPlayingBgm = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;

    this.schedulerTimer = window.setInterval(() => {
      this.scheduleSteps();
    }, 25);
  }

  private stopBgmLoop(): void {
    this.isPlayingBgm = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleSteps(): void {
    if (!this.ctx || !this.bgmFilter || !this.isPlayingBgm) return;

    const secondsPerBeat = 60 / this.bpm;
    const stepDuration = secondsPerBeat / 4; // 16th note
    const lookahead = 0.12;

    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this.triggerBgmStep(this.currentStep, this.nextStepTime, stepDuration);
      this.nextStepTime += stepDuration;
      this.currentStep = (this.currentStep + 1) % 64;
    }
  }

  private triggerBgmStep(step: number, time: number, stepDur: number): void {
    if (!this.ctx || !this.bgmFilter) return;

    // 1. Kick on every quarter note (0, 4, 8, 12...)
    if (step % 4 === 0) {
      this.playKick(time);
    }

    // 2. Snare on beats 2 and 4 (4, 12, 20, 28...)
    if (step % 8 === 4) {
      this.playSnare(time);
    }

    // 3. Hi-hat on off-beats and fast 16ths when intensity is high
    if (step % 2 === 1 || (this.intensity > 0.65 && step % 2 === 0)) {
      this.playHiHat(time, step % 4 === 2 ? 0.16 : 0.09);
    }

    // 4. Driving 16th-note synthwave bass
    const bassNote = BASS_PATTERN[step];
    if (bassNote > 0) {
      this.playBassNote(MIDI_TO_FREQ(bassNote), time, stepDur * 0.85);
    }

    // 5. Lush pad chord at the start of each bar
    if (step % 16 === 0) {
      const barIndex = Math.floor(step / 16) % CHORD_ROOTS.length;
      this.playChordPad(CHORD_ROOTS[barIndex], time, stepDur * 15.5);
    }

    // 6. Lead synth melody
    const leadNote = LEAD_PATTERN[step];
    if (leadNote > 0) {
      this.playLeadNote(MIDI_TO_FREQ(leadNote), time, stepDur * 1.65);
    }
  }

  private playKick(time: number): void {
    if (!this.ctx || !this.bgmFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    gain.gain.setValueAtTime(0.62, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.bgmFilter);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  private playSnare(time: number): void {
    if (!this.ctx || !this.bgmFilter || !this.noiseBuffer) return;
    // Noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmFilter);
    noise.start(time);
    noise.stop(time + 0.18);

    // Body tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(110, time + 0.08);
    oscGain.gain.setValueAtTime(0.2, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.bgmFilter);
    osc.start(time);
    osc.stop(time + 0.11);
  }

  private playHiHat(time: number, level: number): void {
    if (!this.ctx || !this.bgmFilter || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.bgmFilter);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  private playBassNote(freq: number, time: number, duration: number): void {
    if (!this.ctx || !this.bgmFilter) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900 + this.intensity * 900, time);
    filter.frequency.exponentialRampToValueAtTime(260, time + duration);

    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmFilter);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playChordPad(midiNotes: number[], time: number, duration: number): void {
    if (!this.ctx || !this.bgmFilter) return;
    for (const midi of midiNotes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(MIDI_TO_FREQ(midi), time);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 12, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.045, time + 0.18);
      gain.gain.setValueAtTime(0.04, time + duration - 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.bgmFilter);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    }
  }

  private playLeadNote(freq: number, time: number, duration: number): void {
    if (!this.ctx || !this.bgmFilter) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc2.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.004, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.095, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.bgmFilter);

    osc.start(time);
    osc2.start(time);
    osc.stop(time + duration + 0.02);
    osc2.stop(time + duration + 0.02);
  }

  // ==================== Sound Effects (SE) ====================

  public playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.05);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playOrb(combo: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const baseMidi = 69 + Math.min(combo, 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(MIDI_TO_FREQ(baseMidi), now);
    osc.frequency.setValueAtTime(MIDI_TO_FREQ(baseMidi + 7), now + 0.055);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playNearMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.22);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playNitroStart(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.35);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  public playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.26);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public playShieldPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.18, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.22);
    });
  }

  public playSmash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.2);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playCrash(shielded: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;

    if (shielded) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.28);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.32);
      return;
    }

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 950;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      noise.connect(lp);
      lp.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.4);
    }

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.35);
    oscGain.gain.setValueAtTime(0.36, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public dispose(): void {
    this.stopBgmLoop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const soundEngine = new SoundEngine();

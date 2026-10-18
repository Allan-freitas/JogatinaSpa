import { Injectable, OnDestroy, signal } from '@angular/core';

/**
 * Trilha chiptune/MIDI procedural (Web Audio), sem arquivos externos.
 * Toca somente após interação do usuário (política de autoplay dos browsers).
 */

// 8 compassos em Lá menor: Am | F | C | G | Am | F | C | G
const MELODY: number[][] = [
  [69, 72, 76, 81, 76, 72, 69, 64],
  [65, 69, 72, 77, 72, 69, 65, 60],
  [72, 76, 79, 84, 79, 76, 72, 67],
  [67, 71, 74, 79, 74, 71, 67, 62],
  [69, 72, 76, 81, 76, 72, 69, 64],
  [65, 69, 72, 77, 81, 84, 81, 77],
  [76, 79, 84, 88, 84, 79, 76, 72],
  [74, 79, 83, 86, 83, 79, 74, 71],
];

const BASS: number[][] = [
  [45, 45, 52, 52],
  [41, 41, 48, 48],
  [48, 48, 55, 55],
  [43, 43, 50, 50],
  [45, 45, 52, 52],
  [41, 41, 48, 48],
  [48, 48, 55, 55],
  [43, 43, 50, 50],
];

const TEMPO = 126;
const BEATS_PER_BAR = 4;
const BARS = MELODY.length;
const MASTER_VOLUME = 0.08;

type AudioContextCtor = typeof AudioContext;

@Injectable({ providedIn: 'root' })
export class MusicService implements OnDestroy {
  readonly playing = signal(false);

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private loopTimer: number | null = null;

  toggle(): void {
    if (this.playing()) {
      this.stop();
    } else {
      this.start();
    }
  }

  start(): void {
    if (this.playing() || this.ctx) {
      return;
    }
    const AudioCtor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!AudioCtor) {
      return;
    }

    try {
      const ctx = new AudioCtor();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(MASTER_VOLUME, ctx.currentTime + 0.9);
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
      this.noiseBuffer = this.createNoiseBuffer(ctx);
      this.playing.set(true);

      void ctx
        .resume()
        .then(() => {
          if (this.ctx === ctx) {
            this.scheduleLoop(ctx.currentTime + 0.1);
          }
        })
        .catch(() => this.stop());
    } catch {
      this.playing.set(false);
      this.cleanup();
    }
  }

  stop(): void {
    this.playing.set(false);
    if (!this.ctx) {
      return;
    }
    const ctx = this.ctx;
    const master = this.master;
    this.clearLoopTimer();
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;

    if (master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0, now, 0.06);
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 240);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private scheduleLoop(startAt: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noiseBuffer) {
      return;
    }

    const beat = 60 / TEMPO;
    const eighth = beat / 2;
    const loopDuration = BARS * BEATS_PER_BAR * beat;

    for (let bar = 0; bar < BARS; bar += 1) {
      const barStart = startAt + bar * BEATS_PER_BAR * beat;

      MELODY[bar].forEach((note, index) => {
        this.tone(
          ctx,
          master,
          this.midiToFrequency(note),
          barStart + index * eighth,
          eighth * 0.82,
          'square',
          0.13,
        );
      });

      BASS[bar].forEach((note, index) => {
        this.tone(
          ctx,
          master,
          this.midiToFrequency(note),
          barStart + index * beat,
          beat * 0.7,
          'triangle',
          0.18,
        );
      });

      for (let step = 0; step < 8; step += 1) {
        this.noise(ctx, master, barStart + step * eighth, 0.028, 7000, 'highpass', 0.01);
      }

      this.kick(ctx, master, barStart, 0.15, 0.17);
      this.kick(ctx, master, barStart + 2 * beat, 0.15, 0.17);
      this.noise(ctx, master, barStart + beat, 0.09, 1800, 'bandpass', 0.05);
      this.noise(ctx, master, barStart + 3 * beat, 0.09, 1800, 'bandpass', 0.05);
    }

    this.loopTimer = window.setTimeout(
      () => {
        if (this.playing() && this.ctx) {
          this.scheduleLoop(startAt + loopDuration);
        }
      },
      Math.max(0, (startAt + loopDuration - ctx.currentTime - 0.25) * 1000),
    );
  }

  private tone(
    ctx: AudioContext,
    master: GainNode,
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const begin = Math.max(start, ctx.currentTime);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, begin);
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.linearRampToValueAtTime(volume, begin + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + duration);
    osc.connect(gain).connect(master);
    osc.start(begin);
    osc.stop(begin + duration + 0.02);
  }

  private kick(
    ctx: AudioContext,
    master: GainNode,
    start: number,
    duration: number,
    volume: number,
  ): void {
    if (start < ctx.currentTime) {
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(48, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(
    ctx: AudioContext,
    master: GainNode,
    start: number,
    duration: number,
    frequency: number,
    filterType: BiquadFilterType,
    volume: number,
  ): void {
    if (!this.noiseBuffer || start < ctx.currentTime) {
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(gain).connect(master);
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private midiToFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  private clearLoopTimer(): void {
    if (this.loopTimer !== null) {
      window.clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private cleanup(): void {
    this.clearLoopTimer();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }
}

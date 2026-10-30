// Tüm sesler Web Audio ile anında üretilir; indirilecek dosya yok.
// Ses efektleri kısa ve yumuşak, müzik ise arkada nefes alan bir müzik kutusu.

import { loadPref, savePref } from '../core/storage.js';

const PENTA = [0, 2, 4, 7, 9]; // majör pentatonik
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxOn = loadPref('sfx', true);
    this.musicOn = loadPref('music', true);
    this.last = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxOn ? 0.55 : 0;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicOn ? 0.16 : 0;
    this.music.connect(this.master);
    this.reverb = this.#makeReverb();
    this.reverb.connect(this.master);
    this.noise = this.#makeNoise();
    this.#startMusic();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  setSfx(on) {
    this.sfxOn = on;
    savePref('sfx', on);
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on) {
    this.musicOn = on;
    savePref('music', on);
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.4);
  }

  #makeNoise() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  #makeReverb() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 1.6;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    conv.connect(g);
    this.reverbIn = conv;
    return g;
  }

  // Tek bir ton: zarf + isteğe bağlı perde kayması
  #tone({ f, f2, type = 'sine', t = 0, dur = 0.15, vol = 0.3, attack = 0.005, out, wet = 0.2 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(out ?? this.sfx);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.reverbIn);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  #noiseHit({ t = 0, dur = 0.08, vol = 0.3, freq = 2000, q = 1, type = 'bandpass' }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  play(name, opts = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    const gap = opts.gap ?? 40;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const v = opts.vol ?? 1;
    switch (name) {
      case 'tap':
        this.#tone({ f: 900, f2: 700, dur: 0.07, vol: 0.12 * v, wet: 0.05 });
        break;
      case 'select':
        this.#tone({ f: 520, f2: 780, dur: 0.12, vol: 0.16 * v, type: 'triangle', wet: 0.1 });
        this.#noiseHit({ dur: 0.05, vol: 0.05 * v, freq: 3000 });
        break;
      case 'open':
        this.#noiseHit({ dur: 0.22, vol: 0.07 * v, freq: 1400, q: 0.6 });
        this.#tone({ f: 660, f2: 990, dur: 0.16, vol: 0.08 * v, wet: 0.2 });
        break;
      case 'close':
        this.#tone({ f: 800, f2: 520, dur: 0.12, vol: 0.07 * v, wet: 0.1 });
        break;
      case 'place':
        this.#tone({ f: 150, f2: 60, dur: 0.25, vol: 0.4 * v, wet: 0.1 });
        this.#noiseHit({ dur: 0.18, vol: 0.18 * v, freq: 500, q: 0.7, type: 'lowpass' });
        this.#tone({ f: 1046, dur: 0.18, t: 0.05, vol: 0.06 * v, type: 'triangle' });
        break;
      case 'lift':
        this.#tone({ f: 330, f2: 520, dur: 0.12, vol: 0.1 * v, type: 'triangle' });
        break;
      case 'drop':
        this.#tone({ f: 220, f2: 110, dur: 0.14, vol: 0.2 * v });
        this.#noiseHit({ dur: 0.08, vol: 0.08 * v, freq: 800, type: 'lowpass' });
        break;
      case 'error':
        this.#tone({ f: 260, dur: 0.12, vol: 0.14 * v, type: 'square', wet: 0 });
        this.#tone({ f: 196, dur: 0.18, t: 0.1, vol: 0.12 * v, type: 'square', wet: 0 });
        break;
      case 'coin': {
        const base = 1318 + Math.random() * 60;
        this.#tone({ f: base, dur: 0.12, vol: 0.12 * v, type: 'triangle', wet: 0.3 });
        this.#tone({ f: base * 1.5, dur: 0.22, t: 0.06, vol: 0.1 * v, type: 'triangle', wet: 0.3 });
        break;
      }
      case 'wood':
        this.#tone({ f: 420 + Math.random() * 60, f2: 300, dur: 0.09, vol: 0.22 * v, type: 'sine', wet: 0.1 });
        this.#noiseHit({ dur: 0.04, vol: 0.12 * v, freq: 1600, q: 4 });
        break;
      case 'hammer':
        this.#noiseHit({ dur: 0.05, vol: 0.12 * v, freq: 2600 + Math.random() * 800, q: 6 });
        this.#tone({ f: 1800 + Math.random() * 300, dur: 0.05, vol: 0.04 * v, type: 'square', wet: 0.15 });
        break;
      case 'build':
        this.#tone({ f: 392, dur: 0.2, vol: 0.12 * v, type: 'triangle' });
        this.#tone({ f: 523, dur: 0.25, t: 0.08, vol: 0.12 * v, type: 'triangle' });
        break;
      case 'complete':
        [523, 659, 784, 1046].forEach((f, i) => this.#tone({ f, dur: 0.5, t: i * 0.07, vol: 0.12 * v, type: 'triangle', wet: 0.35 }));
        this.#tone({ f: 2093, dur: 0.6, t: 0.3, vol: 0.04 * v, wet: 0.5 });
        break;
      case 'levelup':
        [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.#tone({ f, dur: 0.6, t: i * 0.09, vol: 0.13 * v, type: 'triangle', wet: 0.4 }));
        break;
      case 'poof':
        this.#noiseHit({ dur: 0.35, vol: 0.2 * v, freq: 900, q: 0.5 });
        this.#tone({ f: 600, f2: 200, dur: 0.25, vol: 0.08 * v });
        break;
      case 'leaves':
        this.#noiseHit({ dur: 0.5, vol: 0.16 * v, freq: 4000, q: 0.4, type: 'highpass' });
        this.#tone({ f: 300, f2: 120, dur: 0.3, vol: 0.12 * v });
        break;
      case 'quest':
        [659, 784, 988, 1318].forEach((f, i) => this.#tone({ f, dur: 0.35, t: i * 0.06, vol: 0.1 * v, type: 'sine', wet: 0.4 }));
        break;
      default:
        break;
    }
  }

  // --- müzik kutusu ---------------------------------------------------------

  #startMusic() {
    const ctx = this.ctx;
    const bpm = 76;
    const beat = 60 / bpm;
    let next = ctx.currentTime + 0.5;
    let step = 0;
    const progression = [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]];
    let melody = 72;
    const tick = () => {
      if (!this.ctx) return;
      while (next < ctx.currentTime + 0.6) {
        const bar = Math.floor(step / 8) % progression.length;
        const chord = progression[bar];
        if (step % 8 === 0) {
          chord.forEach((n) => this.#tone({ f: midi(n - 12), t: next - ctx.currentTime, dur: beat * 7.5, vol: 0.05, type: 'sine', attack: 0.6, out: this.music, wet: 0.5 }));
          this.#tone({ f: midi(chord[0] - 24), t: next - ctx.currentTime, dur: beat * 3.5, vol: 0.08, type: 'triangle', attack: 0.02, out: this.music, wet: 0.2 });
        }
        if (Math.random() < (step % 2 ? 0.35 : 0.7)) {
          const choices = PENTA.map((p) => 60 + p).concat(PENTA.map((p) => 72 + p));
          const near = choices.filter((n) => Math.abs(n - melody) <= 5);
          melody = near[Math.floor(Math.random() * near.length)] ?? 72;
          const at = next - ctx.currentTime;
          this.#tone({ f: midi(melody), t: at, dur: 1.2, vol: 0.09, type: 'sine', attack: 0.004, out: this.music, wet: 0.6 });
          this.#tone({ f: midi(melody + 12), t: at, dur: 0.5, vol: 0.025, type: 'sine', attack: 0.004, out: this.music, wet: 0.6 });
        }
        if (Math.random() < 0.025) this.#bird(next - ctx.currentTime);
        next += beat / 2;
        step++;
      }
    };
    this.musicTimer = setInterval(tick, 200);
    tick();
  }

  #bird(t) {
    const base = 2200 + Math.random() * 1400;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      this.#tone({ f: base, f2: base * (1.2 + Math.random() * 0.3), t: t + i * 0.11, dur: 0.07, vol: 0.03, out: this.music, wet: 0.5 });
    }
  }
}

export const audio = new AudioEngine();

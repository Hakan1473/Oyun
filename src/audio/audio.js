// Sesler Web Audio ile anında üretilir; indirilecek dosya yok.
// Ortam: derinden gelen dron, rüzgâr, uzak kargalar. Gece: kalp atışı, tiz cam tınıları,
// metal sürtünmesi, fısıltılar. Korku seviyesi (yakındaki gölgeler) katmanları yükseltir.

import { loadPref, savePref } from '../core/storage.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxOn = loadPref('sfx', true);
    this.musicOn = loadPref('music', true);
    this.last = {};
    this.mood = 'day';
    this.fear = 0;
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
    comp.threshold.value = -16;
    comp.ratio.value = 3.5;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxOn ? 0.7 : 0;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicOn ? 0.55 : 0;
    this.music.connect(this.master);
    this.noise = this.#makeNoise();
    this.reverbIn = ctx.createConvolver();
    this.reverbIn.buffer = this.#impulse(3.2, 2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    this.reverbIn.connect(wet).connect(this.master);
    this.#ambience();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  setSfx(on) {
    this.sfxOn = on;
    savePref('sfx', on);
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on) {
    this.musicOn = on;
    savePref('music', on);
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.4);
  }

  #makeNoise() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  #impulse(sec, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  #tone({ f, f2, type = 'sine', t = 0, dur = 0.2, vol = 0.2, attack = 0.005, out, wet = 0.15, detune = 0 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out ?? this.sfx);
    if (wet) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.reverbIn);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  #noiseHit({ t = 0, dur = 0.1, vol = 0.3, freq = 1500, q = 1, type = 'bandpass', sweep = null, out, wet = 0.1, attack = 0.004 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(out ?? this.sfx);
    if (wet) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.reverbIn);
    }
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
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
        this.#noiseHit({ dur: 0.03, vol: 0.06 * v, freq: 2800, q: 3, wet: 0 });
        break;
      case 'type':
        this.#noiseHit({ dur: 0.018, vol: 0.03 * v, freq: 3500, q: 6, wet: 0 });
        break;
      case 'select':
        this.#tone({ f: 330, f2: 300, dur: 0.12, vol: 0.06 * v, type: 'triangle', wet: 0.2 });
        this.#noiseHit({ dur: 0.04, vol: 0.05 * v, freq: 2400, q: 2, wet: 0 });
        break;
      case 'order':
        this.#tone({ f: 220, f2: 180, dur: 0.1, vol: 0.08 * v, type: 'triangle', wet: 0.1 });
        break;
      case 'open':
        this.#noiseHit({ dur: 0.35, vol: 0.05 * v, freq: 600, sweep: 1600, q: 0.7, attack: 0.08 });
        break;
      case 'close':
        this.#noiseHit({ dur: 0.25, vol: 0.04 * v, freq: 1400, sweep: 500, q: 0.7, attack: 0.03 });
        break;
      case 'lift':
        this.#tone({ f: 160, f2: 220, dur: 0.12, vol: 0.06 * v, type: 'triangle', wet: 0.05 });
        break;
      case 'drop':
      case 'place':
        this.#tone({ f: 110, f2: 50, dur: 0.3, vol: 0.32 * v, wet: 0.15 });
        this.#noiseHit({ dur: 0.2, vol: 0.14 * v, freq: 400, q: 0.6, type: 'lowpass' });
        break;
      case 'error':
        this.#tone({ f: 140, dur: 0.14, vol: 0.12 * v, type: 'square', wet: 0 });
        this.#tone({ f: 132, dur: 0.2, t: 0.08, vol: 0.1 * v, type: 'square', wet: 0 });
        break;
      case 'chop':
        this.#tone({ f: 190 + Math.random() * 40, f2: 80, dur: 0.16, vol: 0.38 * v, wet: 0.25 });
        this.#noiseHit({ dur: 0.07, vol: 0.22 * v, freq: 1800, q: 1.2, wet: 0.2 });
        break;
      case 'creak':
        this.#tone({ f: 70, f2: 48, dur: 1.4, vol: 0.06 * v, type: 'sawtooth', attack: 0.3, wet: 0.4 });
        this.#noiseHit({ dur: 1.3, vol: 0.05 * v, freq: 300, sweep: 180, q: 8, attack: 0.4, wet: 0.4 });
        break;
      case 'treefall':
        this.#noiseHit({ dur: 1.4, vol: 0.4 * v, freq: 900, sweep: 120, q: 0.5, wet: 0.4, attack: 0.01 });
        this.#tone({ f: 60, f2: 30, dur: 0.9, vol: 0.4 * v, wet: 0.3 });
        break;
      case 'hammer':
        this.#tone({ f: 420 + Math.random() * 80, f2: 300, dur: 0.06, vol: 0.12 * v, type: 'triangle', wet: 0.3 });
        this.#noiseHit({ dur: 0.04, vol: 0.12 * v, freq: 2600, q: 5, wet: 0.2 });
        break;
      case 'harvest':
        this.#noiseHit({ dur: 0.35, vol: 0.1 * v, freq: 3500, q: 0.6, type: 'highpass', attack: 0.05 });
        this.#tone({ f: 523, dur: 0.4, t: 0.1, vol: 0.04 * v, type: 'sine', wet: 0.5 });
        break;
      case 'complete':
        [220, 277, 330].forEach((f, i) => this.#tone({ f, dur: 1.2, t: i * 0.09, vol: 0.05 * v, type: 'triangle', attack: 0.02, wet: 0.5 }));
        break;
      case 'build':
        this.#tone({ f: 196, dur: 0.3, vol: 0.06 * v, type: 'triangle', wet: 0.3 });
        break;
      case 'poof':
      case 'break':
        this.#noiseHit({ dur: 0.5, vol: 0.2 * v, freq: 700, sweep: 150, q: 0.5, wet: 0.3 });
        this.#tone({ f: 90, f2: 40, dur: 0.4, vol: 0.2 * v, wet: 0.2 });
        break;
      case 'impact':
        this.#noiseHit({ dur: 0.12, vol: 0.2 * v, freq: 900, q: 1, type: 'lowpass', wet: 0.3 });
        this.#tone({ f: 80, f2: 50, dur: 0.18, vol: 0.2 * v, wet: 0.2 });
        break;
      case 'trap':
        this.#noiseHit({ dur: 0.08, vol: 0.4 * v, freq: 3800, q: 3, wet: 0.3 });
        this.#tone({ f: 900, f2: 300, dur: 0.12, vol: 0.12 * v, type: 'square', wet: 0.2 });
        break;
      case 'ignite':
        this.#noiseHit({ dur: 0.9, vol: 0.2 * v, freq: 400, sweep: 2500, q: 0.6, attack: 0.15, wet: 0.2 });
        for (let i = 0; i < 6; i++) this.#noiseHit({ t: 0.2 + Math.random() * 0.8, dur: 0.02, vol: 0.12 * v, freq: 3000, q: 4, wet: 0 });
        break;
      case 'feed':
        this.#noiseHit({ dur: 0.4, vol: 0.12 * v, freq: 500, sweep: 1500, q: 0.6, attack: 0.05 });
        for (let i = 0; i < 4; i++) this.#noiseHit({ t: 0.1 + Math.random() * 0.4, dur: 0.02, vol: 0.1 * v, freq: 3200, q: 4, wet: 0 });
        break;
      case 'extinguish':
        this.#noiseHit({ dur: 1.4, vol: 0.18 * v, freq: 5000, sweep: 800, q: 0.5, type: 'highpass', attack: 0.05 });
        break;
      case 'flash':
        this.#noiseHit({ dur: 0.02, vol: 0.12 * v, freq: 4000, q: 2, wet: 0 });
        break;
      case 'hurt':
        this.#tone({ f: 70, f2: 40, dur: 0.35, vol: 0.4 * v, wet: 0.2 });
        this.#noiseHit({ dur: 0.18, vol: 0.18 * v, freq: 600, q: 2, wet: 0.2 });
        break;
      case 'death':
        this.#tone({ f: 55, f2: 30, dur: 3, vol: 0.5 * v, attack: 0.01, wet: 0.6 });
        [233, 247, 311].forEach((f) => this.#tone({ f, dur: 3.5, vol: 0.05 * v, type: 'sawtooth', attack: 0.4, wet: 0.7 }));
        break;
      case 'shriek': {
        const o = this.#tone({ f: 500, f2: 1800, dur: 0.8, vol: 0.06 * v, type: 'sawtooth', attack: 0.05, wet: 0.6 });
        void o;
        this.#noiseHit({ dur: 0.9, vol: 0.14 * v, freq: 1200, sweep: 4000, q: 6, attack: 0.05, wet: 0.6 });
        break;
      }
      case 'whisper':
        this.#whisper(0.5 * v);
        break;
      case 'nightfall':
        this.#tone({ f: 41, f2: 36, dur: 4, vol: 0.45 * v, attack: 0.02, wet: 0.7 });
        this.#noiseHit({ dur: 3, vol: 0.06 * v, freq: 200, sweep: 1200, q: 2, attack: 1.5, wet: 0.7 });
        break;
      case 'sting':
        [220, 233, 330, 349].forEach((f, i) => this.#tone({ f, dur: 2.4, t: i * 0.02, vol: 0.05 * v, type: 'sawtooth', attack: 0.3, wet: 0.7 }));
        break;
      case 'choose':
        this.#tone({ f: 110, f2: 70, dur: 0.6, vol: 0.25 * v, wet: 0.5 });
        break;
      case 'heartbeat':
        this.#tone({ f: 55, f2: 40, dur: 0.18, vol: 0.4 * v, wet: 0.1 });
        this.#tone({ f: 50, f2: 38, dur: 0.2, t: 0.22, vol: 0.3 * v, wet: 0.1 });
        break;
      default:
        break;
    }
  }

  #whisper(vol = 0.4) {
    // biçimlendirilmiş gürültü: anlaşılmayan bir fısıltı
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const t = i * (0.12 + Math.random() * 0.1);
      this.#noiseHit({ t, dur: 0.14 + Math.random() * 0.12, vol: 0.08 * vol, freq: 700 + Math.random() * 1800, q: 5 + Math.random() * 5, attack: 0.03, wet: 0.8, out: this.music });
    }
  }

  setMood(m) {
    this.mood = m;
  }

  setFear(k) {
    this.fear = k;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.highG?.gain.setTargetAtTime(0.0001 + k * 0.035, now, 0.6);
  }

  // --- ortam ------------------------------------------------------------------------------

  #ambience() {
    const ctx = this.ctx;
    // Dron: birbirine sürtünen iki testere dişi + alt bas
    const drone = ctx.createGain();
    drone.gain.value = 0.0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    lp.Q.value = 1.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 90;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    for (const [f, d] of [[55, 0], [55, 9], [82.4, -7]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start();
    }
    const sub = ctx.createOscillator();
    sub.frequency.value = 27.5;
    const subG = ctx.createGain();
    subG.gain.value = 0.35;
    sub.connect(subG).connect(drone);
    sub.start();
    lp.connect(drone);
    drone.connect(this.music);
    const dw = ctx.createGain();
    dw.gain.value = 0.3;
    drone.connect(dw).connect(this.reverbIn);
    this.droneG = drone;

    // Rüzgâr
    const wsrc = ctx.createBufferSource();
    wsrc.buffer = this.noise;
    wsrc.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 500;
    wf.Q.value = 0.8;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.07;
    const wlg = ctx.createGain();
    wlg.gain.value = 260;
    wl.connect(wlg).connect(wf.frequency);
    wl.start();
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    wsrc.connect(wf).connect(wg).connect(this.music);
    wsrc.start();
    this.windG = wg;

    // Gece: tiz, birbirine vuran cam tınıları (korkuyla yükselir)
    const high = ctx.createGain();
    high.gain.value = 0.0001;
    for (const f of [2093, 2217]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(high);
      o.start();
    }
    high.connect(this.music);
    const hw = ctx.createGain();
    hw.gain.value = 0.8;
    high.connect(hw).connect(this.reverbIn);
    this.highG = high;

    let beat = 0;
    let next = ctx.currentTime + 1;
    const chords = [[45, 52, 57, 60], [44, 51, 56, 59], [41, 48, 53, 57], [43, 50, 55, 58]];
    let ci = 0;
    let padAt = ctx.currentTime + 2;
    const tick = () => {
      if (!this.ctx) return;
      const now = ctx.currentTime;
      const night = this.mood === 'night';
      const dusk = this.mood === 'dusk' || this.mood === 'dawn';
      drone.gain.setTargetAtTime(night ? 0.07 : dusk ? 0.05 : 0.03, now, 2);
      wg.gain.setTargetAtTime(night ? 0.08 : 0.05, now, 2);
      // ağır ses kümeleri
      if (now > padAt) {
        const c = chords[ci++ % chords.length];
        const dur = night ? 9 : 12;
        c.forEach((n, i) => this.#tone({ f: midi(n), dur, t: i * 0.4, vol: night ? 0.028 : 0.02, type: 'triangle', attack: 3, out: this.music, wet: 0.8, detune: (Math.random() - 0.5) * 12 }));
        padAt = now + dur - 1.5;
      }
      // kalp atışı (korku)
      if (night && this.fear > 0.25 && now > next) {
        const bpm = 50 + this.fear * 40;
        next = now + 60 / bpm;
        beat++;
        this.#tone({ f: 52, f2: 38, dur: 0.2, vol: 0.12 + this.fear * 0.15, out: this.music, wet: 0.05 });
        this.#tone({ f: 48, f2: 36, dur: 0.22, t: 0.24, vol: 0.08 + this.fear * 0.1, out: this.music, wet: 0.05 });
      }
      // rastgele uzak sesler
      const r = Math.random();
      if (!night && r < 0.006) this.#crow();
      if (night && r < 0.004) this.#noiseHit({ dur: 2.2, vol: 0.03, freq: 300, sweep: 1400, q: 14, attack: 0.8, out: this.music, wet: 0.9 });
      if (night && r > 0.996) this.#whisper(0.6);
      if (this.mood !== 'night' && r > 0.994) this.#woodpecker();
      if (Math.random() < 0.35) this.#noiseHit({ dur: 0.015, vol: 0.012 + (night ? 0.008 : 0), freq: 2600 + Math.random() * 2000, q: 3, out: this.music, wet: 0 });
    };
    this.timer = setInterval(tick, 120);
    void beat;
  }

  #crow() {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      this.#tone({ f: 620, f2: 380, dur: 0.28, t: i * 0.42, vol: 0.022, type: 'sawtooth', out: this.music, wet: 0.8 });
      this.#noiseHit({ t: i * 0.42, dur: 0.25, vol: 0.02, freq: 1100, q: 4, out: this.music, wet: 0.8 });
    }
  }

  #woodpecker() {
    for (let i = 0; i < 10; i++) this.#noiseHit({ t: i * 0.06, dur: 0.02, vol: 0.02, freq: 1800, q: 6, out: this.music, wet: 0.8 });
  }
}

export const audio = new AudioEngine();

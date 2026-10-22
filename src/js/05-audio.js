
// =====================================================================
//  Procedural audio (WebAudio, no files)
// =====================================================================
const AudioFX = {
  ctx: null, on: store.get('lumora-sound') !== false, mood: 0, nextChord: 0, chordIdx: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());
    this.master = ctx.createGain(); this.master.gain.value = this.on ? 0.85 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.rev = ctx.createConvolver(); this.rev.buffer = this.impulse(3.4, 2.4);
    const rg = ctx.createGain(); rg.gain.value = 0.5; this.rev.connect(rg); rg.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.2; this.music.connect(this.master); this.music.connect(this.rev);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
    this.sfxRev = ctx.createGain(); this.sfxRev.gain.value = 0.25; this.sfx.connect(this.sfxRev); this.sfxRev.connect(this.rev);
    this.white = this.noiseBuf(2, false); this.brown = this.noiseBuf(4, true);
    // wind bed
    const w = ctx.createBufferSource(); w.buffer = this.white; w.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.Q.value = 0.7; this.windF.frequency.value = 400;
    this.windG = ctx.createGain(); this.windG.gain.value = 0.0;
    w.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.master); w.start();
    // surf bed
    const o = ctx.createBufferSource(); o.buffer = this.brown; o.loop = true;
    const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 520;
    this.seaG = ctx.createGain(); this.seaG.gain.value = 0;
    o.connect(of); of.connect(this.seaG); this.seaG.connect(this.master); o.start();
    // fire crackle bed
    this.fireG = ctx.createGain(); this.fireG.gain.value = 0;
    const fsrc = ctx.createBufferSource(); fsrc.buffer = this.brown; fsrc.loop = true;
    const ff = ctx.createBiquadFilter(); ff.type = 'highpass'; ff.frequency.value = 900;
    fsrc.connect(ff); ff.connect(this.fireG); this.fireG.connect(this.master); fsrc.start();
    this.nextChord = ctx.currentTime + 0.3;
  },
  setOn(v) { this.on = v; store.set('lumora-sound', v); if (this.master) this.master.gain.setTargetAtTime(v ? 0.85 : 0, this.ctx.currentTime, 0.1); },
  impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  },
  noiseBuf(sec, brown) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  },
  hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
  tone(f, t0, dur, { type = 'sine', gain = 0.2, a = 0.01, dest = null, detune = 0, glide = 0 } = {}) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * glide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  bell(m, t0, gain = 0.12, dest = null) {
    const f = this.hz(m);
    this.tone(f, t0, 2.2, { gain, a: 0.005, dest });
    this.tone(f * 2.76, t0, 0.9, { gain: gain * 0.35, a: 0.003, dest });
    this.tone(f * 5.4, t0, 0.4, { gain: gain * 0.12, a: 0.002, dest });
  },
  noise(t0, dur, { f = 800, q = 1, gain = 0.2, type = 'bandpass', sweep = 0 } = {}) {
    const ctx = this.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.white; fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(f * sweep, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
  },
  // ---- music ----
  progs: [
    [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]],
    [[53, 57, 60, 64], [48, 55, 60, 62], [55, 59, 62, 66], [57, 60, 64, 67]],
    [[48, 55, 64, 67], [53, 60, 65, 69], [57, 64, 67, 72], [55, 62, 67, 71]],
  ],
  updateMusic() {
    const ctx = this.ctx;
    if (!ctx || ctx.currentTime < this.nextChord - 0.15) return;
    const t0 = this.nextChord, dur = 7.5;
    const prog = this.progs[Math.min(2, Math.floor(this.mood))];
    const ch = prog[this.chordIdx++ % prog.length];
    this.tone(this.hz(ch[0] - 12), t0, dur + 1, { type: 'sine', gain: 0.16, a: 2.0, dest: this.music });
    ch.forEach((m, i) => {
      this.tone(this.hz(m), t0 + i * 0.05, dur, { type: 'triangle', gain: 0.045, a: 2.4, dest: this.music, detune: -6 });
      this.tone(this.hz(m), t0 + i * 0.05, dur, { type: 'sine', gain: 0.05, a: 2.6, dest: this.music, detune: 7 });
    });
    const scale = this.mood < 1 ? [69, 72, 74, 76, 79, 81] : [72, 74, 76, 79, 81, 84];
    for (let k = 0; k < 4; k++) if (Math.random() < 0.55) this.bell(scale[Math.floor(Math.random() * scale.length)], t0 + 0.8 + k * 1.6 + Math.random() * 0.3, 0.035, this.music);
    this.nextChord += dur;
  },
  update(dt, env) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windF.frequency.setTargetAtTime(320 + Math.sin(t * 0.13) * 140 + env.speed * 25, t, 0.3);
    this.windG.gain.setTargetAtTime(0.035 + 0.02 * Math.sin(t * 0.21) + env.height * 0.0012, t, 0.5);
    this.seaG.gain.setTargetAtTime(env.sea * (0.22 + 0.1 * Math.sin(t * 0.55)), t, 0.4);
    this.fireG.gain.setTargetAtTime(env.fire * (0.03 + Math.random() * 0.05), t, 0.05);
    this.updateMusic();
  },
  // ---- sfx ----
  step(surface) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = surface === 'stone' ? 2200 : surface === 'sand' ? 650 : surface === 'wood' ? 380 : surface === 'water' ? 900 : 1100;
    this.noise(t, surface === 'wood' ? 0.09 : 0.07, { f: f * (0.9 + Math.random() * 0.2), q: surface === 'wood' ? 4 : 0.9, gain: surface === 'water' ? 0.12 : 0.07 });
    if (surface === 'wood') this.tone(140 + Math.random() * 20, t, 0.08, { gain: 0.08 });
  },
  jump() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(t, 0.18, { f: 500, sweep: 3, gain: 0.08 }); },
  land() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(t, 0.12, { f: 300, type: 'lowpass', gain: 0.18 }); },
  pickup(n) { if (!this.ctx) return; const t = this.ctx.currentTime; [76, 81, 88].forEach((m, i) => this.bell(m + (n % 3), t + i * 0.07, 0.09)); },
  burst() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.noise(t, 0.6, { f: 300, sweep: 8, gain: 0.22, q: 0.6 });
    [69, 76, 81].forEach((m, i) => this.bell(m, t + 0.02 + i * 0.02, 0.07));
  },
  hurt() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(160, t, 0.4, { type: 'sawtooth', gain: 0.08, glide: 0.4 }); this.noise(t, 0.25, { f: 200, type: 'lowpass', gain: 0.25 }); },
  wispDie() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(900, t, 0.6, { type: 'sine', gain: 0.07, glide: 0.25 }); this.noise(t, 0.4, { f: 3000, sweep: 0.3, gain: 0.06 }); },
  wispSpawn() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(110, t, 1.2, { type: 'triangle', gain: 0.06, a: 0.4, glide: 1.5 }); },
  ui() { if (!this.ctx) return; this.tone(880, this.ctx.currentTime, 0.12, { gain: 0.05 }); },
  talk() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(320 + Math.random() * 80, t, 0.07, { type: 'triangle', gain: 0.04 }); },
  ritualTick(p) { if (!this.ctx) return; this.bell(60 + Math.floor(clamp(p, 0, 1) * 12), this.ctx.currentTime, 0.05); },
  lit() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [48, 55, 60, 64, 67, 72].forEach((m, i) => this.tone(this.hz(m), t + i * 0.04, 5, { type: i % 2 ? 'triangle' : 'sine', gain: 0.07, a: 0.6, dest: this.music }));
    [72, 76, 79, 84, 88].forEach((m, i) => this.bell(m, t + 0.3 + i * 0.12, 0.08));
    this.noise(t, 2.2, { f: 200, sweep: 10, gain: 0.1, q: 0.4 });
  },
  finale() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [36, 48, 55, 60, 64, 67, 71, 74].forEach((m, i) => this.tone(this.hz(m), t + i * 0.08, 9, { type: i % 2 ? 'triangle' : 'sine', gain: 0.07, a: 1.5, dest: this.music }));
    [72, 76, 79, 83, 84, 88, 91].forEach((m, i) => this.bell(m, t + 1 + i * 0.25, 0.08));
  },
};

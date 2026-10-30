// Gün döngüsü: gündüz → alacakaranlık → gece → şafak. Işığın rengini, sisin yoğunluğunu,
// renk derecelendirmesini ve gece parlayan yüzeyleri birlikte değiştirir.

import * as THREE from 'three';
import { MAT } from '../engine/materials.js';

export const TIMES = { day: 170, dusk: 16, night: 95, dawn: 14 };
export const CYCLE = TIMES.day + TIMES.dusk + TIMES.night + TIMES.dawn;

const P = {
  day: {
    key: 0xe0dbcf, keyI: 1.9, sky: 0xa3b0b6, gnd: 0x2e3324, hemiI: 1.35,
    fog: 0x7c8783, fogLight: 0xa4ada6, density: 0.42, heightK: 0.95,
    exposure: 1.15, sat: 0.72, contrast: 1.06, tint: [0.98, 1.0, 0.98], lift: [0.008, 0.01, 0.011], vignette: 0.42, bloom: 0.55,
    warm: 0.25, cold: 0.12, bg: 0x5c6562,
  },
  dusk: {
    key: 0xd88a62, keyI: 1.2, sky: 0x66667c, gnd: 0x17171a, hemiI: 0.95,
    fog: 0x4a4c5a, fogLight: 0x8a6c60, density: 0.55, heightK: 0.85,
    exposure: 1.1, sat: 0.68, contrast: 1.08, tint: [1.01, 0.97, 0.99], lift: [0.008, 0.008, 0.014], vignette: 0.54, bloom: 0.8,
    warm: 1.0, cold: 0.5, bg: 0x2a2b33,
  },
  night: {
    key: 0x8aa6ff, keyI: 1.7, sky: 0x4a6090, gnd: 0x0e1218, hemiI: 1.5,
    fog: 0x2a3a52, fogLight: 0x40587a, density: 0.6, heightK: 0.8,
    exposure: 1.7, sat: 0.6, contrast: 1.08, tint: [0.88, 0.97, 1.1], lift: [0.004, 0.009, 0.018], vignette: 0.6, bloom: 1.1,
    warm: 2.2, cold: 1.6, bg: 0x0a0e16,
  },
  dawn: {
    key: 0xd8b4b4, keyI: 1.5, sky: 0x8a8aa2, gnd: 0x1e1e22, hemiI: 1.05,
    fog: 0x6a6c7a, fogLight: 0x9a8a9a, density: 0.55, heightK: 0.9,
    exposure: 1.12, sat: 0.66, contrast: 1.06, tint: [1.02, 0.97, 1.02], lift: [0.008, 0.006, 0.012], vignette: 0.5, bloom: 0.8,
    warm: 0.8, cold: 0.5, bg: 0x3c3c48,
  },
};

const ca = new THREE.Color();
const cb = new THREE.Color();
const mixColor = (out, a, b, t) => out.copy(ca.set(a)).lerp(cb.set(b), t);
const mixN = (a, b, t) => a + (b - a) * t;
const mixArr = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const ease = (t) => t * t * (3 - 2 * t);

export class Cycle {
  constructor(stage, state) {
    this.stage = stage;
    this.state = state; // state.clock = { day, t }
    this.flash = 0;
  }

  get t() {
    return this.state.clock.t;
  }

  get day() {
    return this.state.clock.day;
  }

  get phase() {
    const t = this.t;
    if (t < TIMES.day) return 'day';
    if (t < TIMES.day + TIMES.dusk) return 'dusk';
    if (t < TIMES.day + TIMES.dusk + TIMES.night) return 'night';
    return 'dawn';
  }

  // Gecenin ne kadar "içinde" olduğumuz (0 gündüz, 1 tam gece)
  get darkness() {
    const t = this.t;
    const d = TIMES.day;
    const u = TIMES.dusk;
    const n = TIMES.night;
    if (t < d) return 0;
    if (t < d + u) return ease((t - d) / u);
    if (t < d + u + n) return 1;
    return 1 - ease((t - d - u - n) / TIMES.dawn);
  }

  // Gecenin kalan süresi / gündüzün kalan süresi
  remaining() {
    const t = this.t;
    const nightStart = TIMES.day + TIMES.dusk;
    if (t < TIMES.day) return { kind: 'day', left: TIMES.day - t, k: t / TIMES.day };
    if (t < nightStart) return { kind: 'dusk', left: nightStart - t, k: (t - TIMES.day) / TIMES.dusk };
    if (t < nightStart + TIMES.night) return { kind: 'night', left: nightStart + TIMES.night - t, k: (t - nightStart) / TIMES.night };
    return { kind: 'dawn', left: CYCLE - t, k: (t - nightStart - TIMES.night) / TIMES.dawn };
  }

  // Gündüzü atlayıp alacakaranlığa geç
  skipToDusk() {
    if (this.t < TIMES.day - 2) this.state.clock.t = TIMES.day - 2;
  }

  // Zaman ilerlet; olayları (gün doğumu, gece başlangıcı) döndürür
  advance(dt) {
    const c = this.state.clock;
    const before = this.phase;
    c.t += dt;
    c.total = (c.total ?? 0) + dt;
    let wrapped = false;
    if (c.t >= CYCLE) {
      c.t -= CYCLE;
      c.day += 1;
      wrapped = true;
    }
    const after = this.phase;
    return { changed: before !== after || wrapped, before, after, newDay: wrapped };
  }

  #preset() {
    const t = this.t;
    const d = TIMES.day;
    const u = TIMES.dusk;
    const n = TIMES.night;
    if (t < d) {
      // sabahın ilk saniyeleri şafaktan gündüze geçer
      const k = Math.min(1, t / 7);
      return [P.dawn, P.day, ease(k)];
    }
    if (t < d + u) {
      const q = (t - d) / u;
      return q < 0.6 ? [P.day, P.dusk, ease(q / 0.6)] : [P.dusk, P.night, ease((q - 0.6) / 0.4)];
    }
    if (t < d + u + n) return [P.night, P.night, 0];
    return [P.night, P.dawn, ease((t - d - u - n) / TIMES.dawn)];
  }

  apply(dt) {
    const [a, b, k] = this.#preset();
    const s = this.stage;
    mixColor(s.key.color, a.key, b.key, k);
    s.key.intensity = mixN(a.keyI, b.keyI, k);
    mixColor(s.hemi.color, a.sky, b.sky, k);
    mixColor(s.hemi.groundColor, a.gnd, b.gnd, k);
    s.hemi.intensity = mixN(a.hemiI, b.hemiI, k);
    mixColor(s.scene.background, a.bg, b.bg, k);
    const f = s.post.fog;
    mixColor(f.uFogColor.value, a.fog, b.fog, k);
    mixColor(f.uFogLight.value, a.fogLight, b.fogLight, k);
    f.uDensity.value = mixN(a.density, b.density, k);
    f.uHeightK.value = mixN(a.heightK, b.heightK, k);
    const q = s.post.params;
    q.uExposure.value = mixN(a.exposure, b.exposure, k);
    q.uSat.value = mixN(a.sat, b.sat, k);
    q.uContrast.value = mixN(a.contrast, b.contrast, k);
    q.uTint.value.setRGB(...mixArr(a.tint, b.tint, k));
    q.uLift.value.setRGB(...mixArr(a.lift, b.lift, k));
    q.uVignette.value = mixN(a.vignette, b.vignette, k);
    q.uBloom.value = mixN(a.bloom, b.bloom, k);
    const w = mixN(a.warm, b.warm, k);
    MAT.warm.color.setScalar(w);
    MAT.cold.color.setScalar(mixN(a.cold, b.cold, k));
    // Şimşek ya da korku anı parlaması
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.5);
      s.hemi.intensity += this.flash * 2;
    }
  }
}

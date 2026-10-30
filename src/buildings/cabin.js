// Ormanın ortasındaki kulübe. Seviye 1: harabe. Seviye 2: onarılmış. Seviye 3: takviyeli.

import { defineBuilding } from './registry.js';

const HALF_PI = Math.PI / 2;

// Kütük duvar: açıklıklar (kapı, pencere) [x0, x1, y0, y1] aralıklarında kütük kesilir
function logWall(kit, { len, axis, offset, y0, courses, r, phase, openings = [], tint = 0xffffff }) {
  const step = r * 1.84;
  for (let k = 0; k < courses; k++) {
    const y = y0 + r + k * step + phase * step * 0.5;
    let segs = [[-len / 2, len / 2]];
    for (const [a, b, oy0, oy1] of openings) {
      if (y + r < oy0 || y - r > oy1) continue;
      segs = segs.flatMap(([s, e]) => {
        const out = [];
        if (a > s) out.push([s, Math.min(a, e)]);
        if (b < e) out.push([Math.max(b, s), e]);
        return out;
      });
    }
    for (const [s, e] of segs) {
      const L = e - s;
      if (L < 0.12) continue;
      const c = (s + e) / 2;
      const jitter = ((k * 7 + Math.round(c * 13)) % 5) * 0.012;
      const o = axis === 'x' ? { x: c, y, z: offset } : { x: offset, y, z: c, ry: HALF_PI };
      kit.log(L, r + jitter * 0.3, { ...o, color: tint });
    }
  }
}

function cabinModel(m) {
  const { kit, level, rng } = m;
  const W = 3.2;
  const D = 2.5;
  const cz = -0.35;
  const r = 0.11;
  const courses = 10;
  const wallTop = 0.12 + courses * r * 1.84;
  const ruin = level === 1;

  // Taş temel
  kit.group({ z: cz }, () => {
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      for (const s of [-1, 1]) {
        kit.rock(0.16, 0xc8c4bc, { seed: i * 3 + (s > 0 ? 1 : 2), x: -W / 2 + t * W, y: 0.04, z: s * (D / 2), squash: 0.6 });
      }
    }
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      for (const s of [-1, 1]) kit.rock(0.15, 0xc8c4bc, { seed: i * 5 + 40, x: s * (W / 2), y: 0.04, z: -D / 2 + t * D, squash: 0.6 });
    }

    // Karanlık iç hacim (kapı, pencere ve çatı deliğinden görünür)
    kit.box(W - 0.2, wallTop, D - 0.2, 0x0a0908, { y: wallTop / 2 + 0.05 });

    const door = [-0.95, -0.15, 0, 1.62];
    const win = [0.4, 1.12, 0.72, 1.36];
    logWall(kit, { len: W + 0.38, axis: 'x', offset: D / 2, y0: 0.1, courses, r, phase: 0, openings: [door, win] });
    logWall(kit, { len: W + 0.38, axis: 'x', offset: -D / 2, y0: 0.1, courses, r, phase: 0, openings: [[-0.4, 0.35, 0.72, 1.3]] });
    logWall(kit, { len: D + 0.38, axis: 'z', offset: W / 2, y0: 0.1, courses, r, phase: 1, openings: [] });
    logWall(kit, { len: D + 0.38, axis: 'z', offset: -W / 2, y0: 0.1, courses, r, phase: 1, openings: [[-0.35, 0.35, 0.8, 1.3]] });

    // Alınlık: kısalan kütükler
    const rise = 1.0;
    const gk = 5;
    for (const s of [-1, 1]) {
      for (let k = 0; k < gk; k++) {
        const len = (D + 0.1) * (1 - (k + 0.6) / (gk + 0.4));
        kit.log(len, r * 0.95, { x: s * (W / 2), y: wallTop + r + k * r * 1.84, ry: HALF_PI });
      }
    }

    // Kapı (seviye 1'de aralık, yamuk)
    kit.group({ x: -0.95, z: D / 2 + 0.02, ry: ruin ? 0.55 : 0 }, () => {
      kit.group({ x: 0.4 }, () => {
        for (let p = 0; p < 4; p++) kit.box(0.19, 1.56, 0.05, 0xd8ccbc, { mat: 'wood', x: -0.3 + p * 0.2, y: 0.8, uvScale: 1.3 });
        kit.box(0.78, 0.1, 0.06, 0xb0a090, { mat: 'wood', y: 0.4, z: 0.03 });
        kit.box(0.78, 0.1, 0.06, 0xb0a090, { mat: 'wood', y: 1.25, z: 0.03 });
        kit.box(0.08, 0.92, 0.06, 0xb0a090, { mat: 'wood', y: 0.82, z: 0.04, rz: 0.75 });
        kit.sphere(0.03, 0x5a5048, { mat: 'metal', x: 0.28, y: 0.85, z: 0.07, ws: 10, hs: 8 });
      });
    });
    // Kapı kasası
    kit.box(0.08, 1.66, 0.12, 0xa89888, { mat: 'wood', x: -0.95, y: 0.83, z: D / 2 + 0.02 });
    kit.box(0.08, 1.66, 0.12, 0xa89888, { mat: 'wood', x: -0.15, y: 0.83, z: D / 2 + 0.02 });
    kit.box(0.92, 0.1, 0.14, 0xa89888, { mat: 'wood', x: -0.55, y: 1.68, z: D / 2 + 0.02 });

    // Pencere
    kit.group({ x: 0.76, y: 1.04, z: D / 2 + 0.03 }, () => {
      kit.box(0.78, 0.08, 0.14, 0xa89888, { mat: 'wood', y: -0.34 });
      kit.box(0.78, 0.07, 0.12, 0xa89888, { mat: 'wood', y: 0.34 });
      kit.box(0.07, 0.68, 0.12, 0xa89888, { mat: 'wood', x: -0.36 });
      kit.box(0.07, 0.68, 0.12, 0xa89888, { mat: 'wood', x: 0.36 });
      if (ruin) {
        // kırık cam parçaları
        kit.box(0.3, 0.22, 0.01, 0x8fa3a8, { mat: 'glass', x: -0.17, y: -0.18, rz: 0.15 });
        kit.box(0.18, 0.3, 0.01, 0x8fa3a8, { mat: 'glass', x: 0.2, y: 0.14, rz: -0.2 });
      } else {
        kit.box(0.66, 0.6, 0.02, 0xffb060, { mat: 'warm', z: -0.04 });
        for (const a of [0.72, -0.72]) kit.box(0.92, 0.1, 0.04, 0xc0b0a0, { mat: 'wood', z: 0.06, rz: a });
      }
    });

    // Çatı: mahya x boyunca; ön saçak sundurmayı örter
    const halfD = D / 2;
    const ang = Math.atan2(rise, halfD);
    const ridgeY = wallTop + rise;
    const L = W + 0.7;
    const strips = 8;
    for (const s of [-1, 1]) {
      const over = s > 0 ? 0.42 : 0.36;
      const run = halfD + over;
      const slope = run / Math.cos(ang);
      for (let k = 0; k < strips; k++) {
        const x = -L / 2 + (L * (k + 0.5)) / strips;
        // Seviye 1: ön yamaçta delik, bir tahta yamuk
        if (ruin && s > 0 && (k === 2 || k === 3)) {
          const part = k === 2 ? 0.35 : 0.55;
          const sl = slope * part;
          const rr = sl / 2;
          kit.box(L / strips - 0.02, 0.07, sl, 0xffffff, {
            mat: 'roof', x, y: ridgeY - rr * Math.sin(ang) + 0.04, z: s * rr * Math.cos(ang), rx: s * ang, uvScale: 0.8,
          });
          continue;
        }
        const tilt = ruin && k === 5 && s > 0 ? 0.06 : 0;
        kit.box(L / strips - 0.015, 0.08, slope, 0xffffff, {
          mat: 'roof', x, y: ridgeY - (run / 2) * Math.tan(ang) + 0.04, z: s * (run / 2), rx: s * ang + tilt, uvScale: 0.8,
        });
      }
      // Kirişler (delikten görünür)
      for (let k = 0; k < 5; k++) {
        const x = -W / 2 + 0.1 + (k * (W - 0.2)) / 4;
        kit.cyl(0.05, 0.05, slope * 0.98, 8, 0xc8bcb0, { mat: 'bark', uv: 'native', x, y: ridgeY - (run / 2) * Math.tan(ang) - 0.05, z: s * (run / 2), rx: HALF_PI + s * ang });
      }
    }
    kit.cyl(0.09, 0.09, L + 0.1, 12, 0xb8b0a8, { mat: 'bark', uv: 'native', y: ridgeY + 0.08, rz: HALF_PI, uvRepeat: [2, 3] });
    // Sundurma: döşeme, direkler, korkuluk, basamak
    const pz = D / 2 + 0.55;
    for (let k = 0; k < 9; k++) {
      const x = -W / 2 + 0.2 + (k * (W - 0.4)) / 8;
      const broken = ruin && k === 6;
      kit.box(0.34, 0.06, 1.0, 0xe0d4c4, { mat: 'wood', x, y: broken ? 0.12 : 0.2, z: pz, rx: broken ? 0.12 : 0, ry: HALF_PI, uvScale: 1.1 });
    }
    for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) {
      kit.cyl(0.07, 0.08, wallTop + 0.5, 10, 0xc8bcb0, { mat: 'bark', uv: 'native', x, y: (wallTop + 0.5) / 2, z: D / 2 + 1.0, uvRepeat: [1, 2] });
    }
    // korkuluk (sağda, bir parçası kırık)
    kit.box(1.1, 0.06, 0.06, 0xd0c4b4, { mat: 'wood', x: W / 2 - 0.7, y: 0.9, z: D / 2 + 1.0 });
    kit.box(0.9, 0.06, 0.06, 0xd0c4b4, { mat: 'wood', x: W / 2 - 0.62, y: ruin ? 0.38 : 0.6, z: D / 2 + 1.02, rz: ruin ? 0.5 : 0 });
    for (let k = 0; k < 4; k++) kit.box(0.05, 0.7, 0.05, 0xd0c4b4, { mat: 'wood', x: W / 2 - 0.3 - k * 0.28, y: 0.55, z: D / 2 + 1.0 });
    for (let k = 0; k < 2; k++) kit.box(0.9, 0.08, 0.3, 0xd8ccbc, { mat: 'wood', x: -0.55, y: 0.06 + k * 0.08 - 0.02, z: D / 2 + 1.25 + (1 - k) * 0.25 });

    // Fener (sundurma direğinde)
    kit.group({ x: -W / 2 + 0.15, y: wallTop + 0.1, z: D / 2 + 1.0 }, () => {
      kit.box(0.35, 0.04, 0.04, 0x40403c, { mat: 'metal', x: 0.17 });
      kit.cyl(0.006, 0.006, 0.2, 4, 0x30302c, { mat: 'metal', x: 0.32, y: -0.1 });
      kit.group({ x: 0.32, y: -0.32 }, () => {
        kit.cyl(0.07, 0.08, 0.04, 10, 0x40403c, { mat: 'metal', y: 0.12 });
        kit.cyl(0.055, 0.055, 0.17, 10, ruin ? 0x6a6050 : 0xffc070, { mat: ruin ? 'glass' : 'warm' });
        kit.cyl(0.07, 0.07, 0.03, 10, 0x40403c, { mat: 'metal', y: -0.09 });
        kit.cone(0.08, 0.08, 10, 0x40403c, { mat: 'metal', y: 0.18 });
      });
    });
    if (!ruin) m.light({ x: -W / 2 + 0.47, y: wallTop - 0.25, z: cz + D / 2 + 1.0, radius: 4.2, color: 0xffb26a, intensity: 1.4 });

    // Taş baca (+x alınlığının dışında)
    const cx = W / 2 + 0.32;
    const ch = ruin ? ridgeY + 0.1 : ridgeY + 0.7;
    const rows = Math.round(ch / 0.22);
    for (let k = 0; k < rows; k++) {
      const wdt = k < rows * 0.45 ? 0.62 : 0.44;
      for (let q = 0; q < 2; q++) {
        kit.box(wdt / 2 - 0.01, 0.21, 0.5, 0xffffff, {
          mat: 'stone', x: cx + (q - 0.5) * (wdt / 2) + ((k % 2) * 0.03), y: 0.11 + k * 0.22, z: 0.0, r: 0.04, uvScale: 1.6,
        });
      }
    }
    if (ruin) {
      for (let i = 0; i < 4; i++) kit.rock(0.11, 0xb8b4ac, { mat: 'stone', seed: 90 + i, x: cx + 0.3 + rng() * 0.5, y: 0.04, z: -0.4 + rng() * 0.8 });
    } else {
      m.anchor('smoke', cx, ch + 0.1, cz);
    }

    // Takviye (seviye 3): kazıklar ve kepenkler
    if (level >= 3) {
      for (let k = 0; k < 7; k++) {
        const x = -W / 2 - 0.2 + (k * (W + 0.4)) / 6;
        kit.cyl(0.05, 0.06, 0.9, 8, 0xc8bcb0, { mat: 'bark', uv: 'native', x, y: 0.45, z: D / 2 + 1.75, rx: 0.5 });
        kit.cone(0.05, 0.16, 8, 0xd8ccbc, { mat: 'wood', x, y: 0.88, z: D / 2 + 1.98, rx: 0.5 });
      }
      for (const s of [-1, 1]) kit.box(0.36, 0.66, 0.05, 0xd0c4b4, { mat: 'wood', x: 0.76 + s * 0.2, y: 1.04, z: D / 2 + 0.12, ry: s * 0.9 });
    }
  });

  // Çevre eşyaları: odun yığını, fıçı, kütükte balta, dağınık tahtalar
  kit.group({ x: -W / 2 - 0.45, z: cz - 0.3 }, () => {
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 4 - row; k++) kit.log(0.7, 0.09, { x: 0, y: 0.09 + row * 0.16, z: -0.3 + k * 0.19 + row * 0.095, ry: HALF_PI });
    }
  });
  kit.group({ x: 1.55, z: 1.65 }, () => {
    kit.cyl(0.24, 0.27, 0.36, 16, 0xd8d0c4, { mat: 'bark', uv: 'native', y: 0.18, uvRepeat: [2, 1] });
    kit.disc(0.235, 16, 0xffffff, { mat: 'endgrain', uv: 'native', y: 0.362 });
    kit.cyl(0.02, 0.025, 0.55, 8, 0xb89a74, { mat: 'wood', x: 0.05, y: 0.55, rz: -0.45 });
    kit.box(0.2, 0.12, 0.025, 0x707070, { mat: 'metal', x: -0.06, y: 0.38, rz: -0.45 });
  });
  kit.group({ x: -1.75, z: 1.45 }, () => {
    kit.cyl(0.2, 0.22, 0.5, 16, 0xa89070, { mat: 'wood', y: 0.25, uvScale: 1.4 });
    for (const y of [0.08, 0.42]) kit.cyl(0.215, 0.215, 0.035, 16, 0x504840, { mat: 'metal', y });
  });
  if (ruin) {
    kit.box(1.4, 0.04, 0.16, 0xd0c4b4, { mat: 'wood', x: 1.0, y: 0.03, z: 1.9, ry: 0.6 });
    kit.box(1.0, 0.04, 0.14, 0xc8bcac, { mat: 'wood', x: 0.6, y: 0.07, z: 1.85, ry: 1.1, rx: 0.08 });
  }
  m.door = { x: -0.55, z: cz + D / 2 + 0.6 };
}

export const cabin = defineBuilding({
  id: 'cabin',
  name: 'Kulübe',
  description: 'Ormanın ortasında unutulmuş bir av kulübesi. Onardıkça daha sağlam bir sığınak olur.',
  category: 'shelter',
  size: 4,
  order: 1,
  shop: false,
  limit: () => 1,
  levels: [
    { name: 'Harabe', cost: {}, work: 0, hp: 260, storage: { wood: 120, food: 40 } },
    { name: 'Onarılmış', cost: { wood: 90 }, work: 30, hp: 480, storage: { wood: 220, food: 70 } },
    { name: 'Takviyeli', cost: { wood: 220, food: 10 }, work: 55, hp: 800, storage: { wood: 360, food: 110 } },
  ],
  model: cabinModel,
});

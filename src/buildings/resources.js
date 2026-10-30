// Kaynak binaları: Oduncu (kereste), Pazar (altın), Ambar (depo).

import { defineBuilding } from './registry.js';
import { C, shade } from '../engine/palette.js';
import { SLOT } from '../engine/materials.js';
import { pad, onFace, windowPane, door, gableRoof, log, barrel, crate } from './parts.js';
import { bush, pineTree, flowers } from '../world/nature.js';

export const lumber = defineBuilding({
  id: 'lumber',
  name: 'Oduncu',
  description: 'Ormandan kereste getirir. Kereste; ev, pazar ve saray için gerekir.',
  category: 'resource',
  size: 3,
  order: 10,
  limit: ({ palaceLevel }) => [1, 1, 2, 3][palaceLevel] ?? 3,
  levels: [
    { cost: { gold: 150 }, time: 10, xp: 15, produces: { resource: 'wood', rate: 14, capacity: 140 } },
    { cost: { gold: 420 }, time: 30, xp: 35, requires: { palace: 2 }, produces: { resource: 'wood', rate: 26, capacity: 280 } },
    { cost: { gold: 950 }, time: 75, xp: 80, requires: { palace: 3 }, produces: { resource: 'wood', rate: 42, capacity: 460 } },
  ],

  model(m) {
    const { kit, level, rng } = m;
    const y0 = pad(kit, 3, { color: C.dirtDark, top: C.dirt, h: 0.1, inset: 0.14 });

    // Kütük kulübe
    const w = 1.45;
    const d = 1.05;
    const h = 0.72 + (level >= 2 ? 0.12 : 0);
    kit.group({ x: -0.42, z: -0.38 }, () => {
      kit.box(w, h, d, C.woodLight, { y: y0 + h / 2, r: 0.02 });
      for (let k = 1; k < 5; k++) {
        const yy = y0 + (h * k) / 5;
        kit.box(w + 0.02, 0.025, 0.03, C.wood, { y: yy, z: d / 2 });
        kit.box(0.03, 0.025, d + 0.02, C.wood, { x: w / 2, y: yy });
      }
      for (const [px, pz] of [[1, 1], [1, -1], [-1, 1]]) {
        kit.cyl(0.06, 0.06, h + 0.06, 7, C.bark, { x: (px * w) / 2, y: y0 + h / 2, z: (pz * d) / 2 });
      }
      const roof = level >= 3 ? C.roofRed : C.roofBrown;
      gableRoof(kit, { len: w, depth: d, rise: 0.48, y: y0 + h, color: roof, gable: C.woodLight, overhang: 0.18, overhangX: 0.14, rows: 2 });
      onFace(kit, '+z', d / 2, -0.25, y0, () => door(kit, { w: 0.3, h: 0.5, color: C.woodDark, frame: C.bark, arch: false, step: false }));
      onFace(kit, '+z', d / 2, 0.35, y0 + 0.42, () => windowPane(kit, { w: 0.22, h: 0.2, frame: C.woodDark, sill: false }));
      onFace(kit, '+x', w / 2, 0, y0 + 0.42, () => windowPane(kit, { w: 0.22, h: 0.2, frame: C.woodDark, sill: false }));
      // Duvara asılı balta ve testere
      onFace(kit, '+x', w / 2 + 0.02, 0.38, y0 + 0.42, () => {
        kit.box(0.03, 0.34, 0.03, C.wood, { rz: 0.3 });
        kit.box(0.12, 0.08, 0.02, C.iron, { x: 0.06, y: 0.14, rz: 0.3 });
      });
    });

    // Kütük yığını
    const rows = level >= 2 ? 4 : 3;
    kit.group({ x: 0.72, z: 0.55, ry: -0.2 }, () => {
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < rows - r; k++) {
          log(kit, { len: 0.78, r: 0.085, x: 0, y: y0 + 0.085 + r * 0.15, z: (k - (rows - r - 1) / 2) * 0.172 });
        }
      }
      kit.box(0.05, 0.4, 0.05, C.woodDark, { x: 0, y: y0 + 0.2, z: (rows / 2) * 0.172 + 0.06 });
      kit.box(0.05, 0.4, 0.05, C.woodDark, { x: 0, y: y0 + 0.2, z: -(rows / 2) * 0.172 - 0.06 });
    });

    // Kesim kütüğü ve balta
    kit.group({ x: -0.75, z: 0.78 }, () => {
      kit.cyl(0.2, 0.23, 0.22, 10, C.bark, { y: y0 + 0.11 });
      kit.cyl(0.19, 0.19, 0.012, 10, C.woodPale, { y: y0 + 0.225 });
      kit.box(0.035, 0.34, 0.035, C.wood, { x: 0.02, y: y0 + 0.36, rz: -0.5 });
      kit.box(0.14, 0.1, 0.025, C.iron, { x: -0.04, y: y0 + 0.25, rz: -0.5, slot: SLOT.SHINY });
      for (let k = 0; k < 6; k++) {
        kit.box(0.06, 0.012, 0.03, C.woodPale, { x: rng.range(-0.35, 0.35), y: y0 + 0.006, z: rng.range(-0.2, 0.3), ry: rng.range(0, 3) });
      }
    });

    // Testere sehpası
    kit.group({ x: 0.72, z: -0.75 }, () => {
      for (const s of [-1, 1]) {
        kit.box(0.04, 0.34, 0.04, C.wood, { x: s * 0.22, y: y0 + 0.17, z: 0.08, rx: 0.3 });
        kit.box(0.04, 0.34, 0.04, C.wood, { x: s * 0.22, y: y0 + 0.17, z: -0.08, rx: -0.3 });
      }
      log(kit, { len: 0.7, r: 0.07, y: y0 + 0.36 });
    });

    pineTree(kit, rng, { x: -1.15, z: 1.1, s: 0.55 });
    bush(kit, rng, { x: 1.2, z: -1.15, s: 0.6 });
    if (level >= 3) barrel(kit, { x: 0.1, z: 1.1 });
  },
});

export const market = defineBuilding({
  id: 'market',
  name: 'Pazar',
  description: 'Rengârenk tezgâhlar. Komşu köylerle ticaret yapar, altın kazandırır.',
  category: 'resource',
  size: 3,
  order: 11,
  limit: ({ palaceLevel }) => [0, 1, 2, 3][palaceLevel] ?? 3,
  levels: [
    { cost: { wood: 220 }, time: 12, xp: 18, requires: { palace: 1 }, produces: { resource: 'gold', rate: 16, capacity: 160 } },
    { cost: { wood: 560 }, time: 35, xp: 40, requires: { palace: 2 }, produces: { resource: 'gold', rate: 30, capacity: 320 } },
    { cost: { wood: 1200 }, time: 90, xp: 90, requires: { palace: 3 }, produces: { resource: 'gold', rate: 50, capacity: 520 } },
  ],

  model(m) {
    const { kit, level, rng } = m;
    const y0 = pad(kit, 3, { color: C.stone, top: C.path, h: 0.12, inset: 0.14 });
    const fruits = [C.flowerRed, C.roofOrange, C.flowerYellow, C.leafLight, C.roofPurple];

    const stall = (x, z, ry, a, b, wide = 1.2) => {
      kit.group({ x, z, ry }, () => {
        kit.box(wide, 0.42, 0.46, C.woodLight, { y: y0 + 0.21, r: 0.02 });
        kit.box(wide + 0.06, 0.04, 0.52, C.wood, { y: y0 + 0.44, r: 0.01 });
        for (let k = 0; k < 3; k++) kit.box(wide + 0.005, 0.02, 0.02, C.wood, { y: y0 + 0.1 + k * 0.11, z: 0.235 });
        for (const px of [-1, 1]) {
          for (const pz of [-1, 1]) kit.box(0.055, 1.05, 0.055, C.woodDark, { x: (px * wide) / 2, y: y0 + 0.52, z: pz * 0.26 });
        }
        // Çizgili tente
        const n = 7;
        for (let k = 0; k < n; k++) {
          const sx = -wide / 2 - 0.06 + ((wide + 0.12) * (k + 0.5)) / n;
          kit.box((wide + 0.12) / n + 0.002, 0.045, 0.82, k % 2 ? b : a, { x: sx, y: y0 + 1.1, z: 0.12, rx: 0.32 });
          kit.cyl(0.0, (wide + 0.12) / n / 2, 0.12, 3, k % 2 ? b : a, { x: sx, y: y0 + 0.92, z: 0.52, rx: Math.PI, rz: 0, sz: 0.25 });
        }
        // Tezgâhtaki ürünler
        crate(kit, { x: -wide * 0.28, y: y0 + 0.46, z: 0.04, s: 0.26, fill: fruits, rng });
        crate(kit, { x: wide * 0.05, y: y0 + 0.46, z: 0.02, s: 0.26, fill: fruits, rng });
        kit.sphere(0.09, C.hay, { x: wide * 0.34, y: y0 + 0.53, z: 0.04, sy: 0.75 });
      });
    };

    stall(-0.45, 0.25, 0, C.cloth, C.wallWhite);
    stall(0.65, -0.55, Math.PI / 2, C.clothBlue, C.wallWhite, 1.0);
    if (level >= 2) stall(-0.55, -0.85, 0, C.roofGreen, C.wallButter, 0.9);

    // Fıçılar, sandıklar, çuvallar
    barrel(kit, { x: 0.9, z: 0.85 });
    barrel(kit, { x: 1.12, z: 0.6, r: 0.11, h: 0.22 });
    crate(kit, { x: 0.55, z: 1.0, s: 0.26, ry: 0.3 });
    crate(kit, { x: 0.58, z: 1.02, y: 0.21, s: 0.2, ry: 0.5, fill: fruits, rng });
    for (const [sx, sz] of [[-1.05, 1.0], [-0.85, 1.12]]) {
      kit.sphere(0.13, C.rope, { x: sx, y: y0 + 0.11, z: sz, sy: 0.85, ws: 10, hs: 7 });
      kit.cyl(0.04, 0.06, 0.06, 8, shade(C.rope, 0.85), { x: sx, y: y0 + 0.23, z: sz });
    }
    if (level >= 3) {
      kit.cyl(0.03, 0.035, 1.6, 6, C.woodDark, { x: -1.15, y: y0 + 0.8, z: -1.1 });
      kit.cone(0.16, 0.3, 3, C.gold, { x: -1.0, y: y0 + 1.45, z: -1.1, rz: -Math.PI / 2, sz: 0.2, slot: SLOT.SHINY });
    }
    flowers(kit, rng, { count: 6, radius: 0.2, x: 1.1, z: -1.15, y: y0 });
  },
});

export const storehouse = defineBuilding({
  id: 'storehouse',
  name: 'Ambar',
  description: 'Büyük, sağlam bir ahır-ambar. Altın ve kereste depoların genişler.',
  category: 'resource',
  size: 3,
  order: 12,
  limit: ({ palaceLevel }) => [0, 0, 1, 2][palaceLevel] ?? 2,
  levels: [
    { cost: { gold: 350, wood: 350 }, time: 20, xp: 30, requires: { palace: 2 }, storage: { gold: 1500, wood: 1500 } },
    { cost: { gold: 900, wood: 900 }, time: 60, xp: 80, requires: { palace: 3 }, storage: { gold: 3500, wood: 3500 } },
  ],

  model(m) {
    const { kit, level, rng } = m;
    const y0 = pad(kit, 3, { color: C.stone, top: C.stoneLight, h: 0.14, inset: 0.14 });
    const red = 0xc8463b;
    const w = 2.0;
    const d = 1.55;
    const h = 1.0 + level * 0.1;
    kit.group({ x: -0.15, z: -0.2 }, () => {
      kit.box(w + 0.06, 0.14, d + 0.06, C.stoneDark, { y: y0 + 0.07, r: 0.02 });
      kit.box(w, h, d, red, { y: y0 + h / 2, r: 0.03 });
      for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        kit.box(0.08, h, 0.08, C.wallWhite, { x: (px * w) / 2, y: y0 + h / 2, z: (pz * d) / 2 });
      }
      for (let k = 1; k < 8; k++) kit.box(0.015, h * 0.98, 0.02, shade(red, 0.82), { x: -w / 2 + (w * k) / 8, y: y0 + h / 2, z: d / 2 + 0.005 });
      gableRoof(kit, { len: w, depth: d, rise: 0.75, y: y0 + h, color: C.roofSlate, gable: red, overhang: 0.16, overhangX: 0.12, rows: 3 });
      // Büyük kapılar
      onFace(kit, '+z', d / 2, 0, y0, () => {
        kit.box(0.92, 0.82, 0.04, C.wallWhite, { y: 0.41, z: 0.01 });
        for (const s of [-1, 1]) {
          kit.box(0.4, 0.74, 0.05, shade(red, 0.9), { x: s * 0.22, y: 0.39, z: 0.02 });
          kit.box(0.04, 0.82, 0.06, C.wallWhite, { x: s * 0.22, y: 0.39, z: 0.03, rz: s * 0.56 });
          kit.box(0.04, 0.82, 0.06, C.wallWhite, { x: s * 0.22, y: 0.39, z: 0.03, rz: -s * 0.56 });
        }
      });
      // Saman kapağı
      onFace(kit, '+x', w / 2, 0, y0 + h + 0.15, () => {
        kit.box(0.34, 0.32, 0.04, C.wallWhite, { z: 0.01 });
        kit.box(0.28, 0.26, 0.05, C.woodDark, { z: 0.02 });
        kit.box(0.3, 0.03, 0.06, C.hay, { y: -0.12, z: 0.03 });
      });
      onFace(kit, '+x', w / 2, -0.4, y0 + 0.5, () => windowPane(kit, { w: 0.24, h: 0.24, frame: C.wallWhite, sill: false }));
      onFace(kit, '+x', w / 2, 0.4, y0 + 0.5, () => windowPane(kit, { w: 0.24, h: 0.24, frame: C.wallWhite, sill: false }));
      // Rüzgâr gülü
      kit.cyl(0.012, 0.012, 0.35, 5, C.iron, { y: y0 + h + 0.95, x: 0.5 });
      kit.cone(0.05, 0.16, 3, C.gold, { y: y0 + h + 1.08, x: 0.5, rz: Math.PI / 2, slot: SLOT.SHINY });
    });
    // Saman balyaları
    for (const [x, z, ry] of [[1.05, 0.75, 0.2], [0.75, 1.1, -0.3], [0.95, 0.95, 0]]) {
      const yy = x === 0.95 ? y0 + 0.37 : y0 + 0.15;
      kit.cyl(0.16, 0.16, 0.36, 12, C.hay, { x, y: yy, z, rx: Math.PI / 2, ry });
    }
    barrel(kit, { x: -1.1, z: 1.05 });
    crate(kit, { x: -0.8, z: 1.15, s: 0.24, ry: 0.4 });
    bush(kit, rng, { x: 1.15, z: -1.15, s: 0.6 });
  },
});

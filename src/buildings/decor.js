// Süsler ve doğal engeller.

import { defineBuilding } from './registry.js';
import { C } from '../engine/palette.js';
import { SLOT } from '../engine/materials.js';
import { pad, gableRoof, lantern } from './parts.js';
import { roundTree, pineTree, bush, rockPile, flowers } from '../world/nature.js';

export const well = defineBuilding({
  id: 'well',
  name: 'Kuyu',
  description: 'Köy meydanının buluşma noktası. Köylüler burada sohbet etmeyi sever.',
  category: 'decor',
  size: 2,
  order: 30,
  limit: () => 2,
  levels: [{ cost: { gold: 160 }, time: 0, xp: 8 }],
  model({ kit, rng }) {
    const y0 = pad(kit, 2, { color: C.stone, top: C.path, h: 0.08, inset: 0.18 });
    kit.cyl(0.46, 0.5, 0.42, 16, C.stone, { y: y0 + 0.21 });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      kit.box(0.2, 0.12, 0.1, k % 2 ? C.stoneLight : C.stoneDark, { x: Math.cos(a) * 0.49, y: y0 + 0.1 + (k % 3) * 0.1, z: Math.sin(a) * 0.49, ry: -a + Math.PI / 2, r: 0.02 });
    }
    kit.cyl(0.5, 0.5, 0.07, 16, C.stoneLight, { y: y0 + 0.44 });
    kit.cyl(0.38, 0.38, 0.02, 16, C.water, { y: y0 + 0.36, slot: SLOT.SHINY });
    for (const s of [-1, 1]) kit.box(0.07, 0.75, 0.07, C.wood, { x: s * 0.42, y: y0 + 0.8 });
    gableRoof(kit, { len: 0.96, depth: 0.62, rise: 0.3, y: y0 + 1.15, color: C.roofRed, overhang: 0.08, overhangX: 0.06, thick: 0.06, rows: 1 });
    kit.cyl(0.04, 0.04, 0.9, 8, C.woodDark, { y: y0 + 0.95, rz: Math.PI / 2 });
    kit.box(0.04, 0.16, 0.04, C.iron, { x: 0.5, y: y0 + 0.9 });
    kit.cyl(0.006, 0.006, 0.4, 3, C.rope, { y: y0 + 0.73 });
    kit.cyl(0.08, 0.065, 0.12, 10, C.woodLight, { y: y0 + 0.5, x: 0.3, z: 0.36 });
    flowers(kit, rng, { count: 5, radius: 0.18, x: 0.62, z: 0.6, y: y0 });
  },
});

export const fountain = defineBuilding({
  id: 'fountain',
  name: 'Çeşme',
  description: 'Şırıl şırıl akan taş çeşme. Meydanına neşe katar.',
  category: 'decor',
  size: 2,
  order: 31,
  limit: ({ palaceLevel }) => (palaceLevel >= 1 ? 2 : 0),
  levels: [{ cost: { gold: 300, wood: 80 }, time: 0, xp: 15, requires: { palace: 1 } }],
  model({ kit }) {
    const y0 = pad(kit, 2, { color: C.stone, top: C.stoneLight, h: 0.06, inset: 0.12 });
    kit.cyl(0.78, 0.82, 0.28, 8, C.stone, { y: y0 + 0.14, flat: true });
    kit.cyl(0.8, 0.8, 0.06, 8, C.stoneLight, { y: y0 + 0.29, flat: true });
    kit.cyl(0.68, 0.68, 0.02, 16, C.water, { y: y0 + 0.25, slot: SLOT.SHINY });
    kit.cyl(0.1, 0.14, 0.55, 8, C.stoneLight, { y: y0 + 0.5 });
    kit.cyl(0.32, 0.1, 0.12, 12, C.stone, { y: y0 + 0.8 });
    kit.cyl(0.25, 0.25, 0.02, 12, C.water, { y: y0 + 0.86, slot: SLOT.SHINY });
    kit.cyl(0.05, 0.07, 0.22, 8, C.stoneLight, { y: y0 + 0.96 });
    kit.sphere(0.07, C.water, { y: y0 + 1.1, slot: SLOT.SHINY, ws: 10, hs: 8 });
  },
  fx: 'fountain',
});

export const flowerbed = defineBuilding({
  id: 'flowerbed',
  name: 'Çiçeklik',
  description: 'Mis kokulu, rengârenk bir çiçek tarhı.',
  category: 'decor',
  size: 1,
  order: 32,
  levels: [{ cost: { gold: 30 }, time: 0, xp: 2 }],
  model({ kit, rng }) {
    kit.box(0.8, 0.12, 0.8, C.woodLight, { y: 0.06, r: 0.03 });
    kit.box(0.7, 0.13, 0.7, 0x7a5232, { y: 0.07 });
    flowers(kit, rng, { count: 11, radius: 0.3, y: 0.13 });
    kit.blob(0.07, C.leaf, { x: 0.2, y: 0.17, z: -0.18, detail: 0 });
    kit.blob(0.06, C.leaf, { x: -0.22, y: 0.16, z: 0.15, detail: 0 });
  },
});

export const lamp = defineBuilding({
  id: 'lamp',
  name: 'Fener',
  description: 'Akşamları sokakları ısıtan dökme demir fener.',
  category: 'decor',
  size: 1,
  order: 33,
  levels: [{ cost: { gold: 60 }, time: 0, xp: 3 }],
  model({ kit }) {
    kit.cyl(0.13, 0.16, 0.1, 8, C.stone, { y: 0.05 });
    kit.cyl(0.03, 0.04, 0.95, 8, C.iron, { y: 0.55 });
    kit.cyl(0.05, 0.05, 0.05, 8, C.iron, { y: 0.2 });
    lantern(kit, { y: 1.02, s: 1.25 });
  },
});

export const bench = defineBuilding({
  id: 'bench',
  name: 'Bank',
  description: 'Gölgede dinlenmek için tahta bir bank.',
  category: 'decor',
  size: 1,
  order: 34,
  levels: [{ cost: { wood: 40 }, time: 0, xp: 2 }],
  model({ kit }) {
    for (const s of [-1, 1]) {
      kit.box(0.05, 0.2, 0.26, C.iron, { x: s * 0.3, y: 0.1 });
      kit.box(0.05, 0.28, 0.05, C.iron, { x: s * 0.3, y: 0.32, z: -0.12 });
    }
    for (let k = 0; k < 3; k++) kit.box(0.74, 0.03, 0.075, C.woodLight, { y: 0.22, z: -0.08 + k * 0.085, r: 0.01 });
    for (let k = 0; k < 2; k++) kit.box(0.74, 0.06, 0.03, C.woodLight, { y: 0.34 + k * 0.1, z: -0.14, r: 0.01 });
  },
});

export const tree = defineBuilding({
  id: 'tree',
  name: 'Ağaç',
  description: 'Gölgesi bol, yuvarlak bir meşe fidanı.',
  category: 'decor',
  size: 1,
  order: 35,
  levels: [{ cost: { gold: 25 }, time: 0, xp: 2 }],
  model({ kit, rng }) {
    kit.box(0.5, 0.05, 0.5, C.dirtDark, { y: 0.025, r: 0.02 });
    roundTree(kit, rng, { s: 0.95 });
  },
});

export const path = defineBuilding({
  id: 'path',
  name: 'Taş Yol',
  description: 'Köylüler taş yolları sever ve hep onları kullanır.',
  category: 'decor',
  size: 1,
  order: 36,
  solid: false,
  pathCost: 0.35,
  repeat: true,
  levels: [{ cost: { gold: 8 }, time: 0, xp: 0 }],
  model({ kit, rng }) {
    kit.box(0.98, 0.03, 0.98, C.path, { y: 0.015, r: 0.01 });
    const spots = [[-0.24, -0.24], [0.22, -0.2], [-0.2, 0.22], [0.24, 0.24], [0, 0]];
    for (const [x, z] of spots) {
      kit.box(0.34 + rng.range(-0.04, 0.04), 0.035, 0.32 + rng.range(-0.04, 0.04), rng.chance(0.5) ? C.stoneLight : C.pathDark, {
        x: x + rng.range(-0.03, 0.03), y: 0.04, z: z + rng.range(-0.03, 0.03), ry: rng.range(-0.3, 0.3), r: 0.015,
      });
    }
  },
  castShadow: false,
});

// --- doğal engeller: dokun → temizle -------------------------------------

export const oak = defineBuilding({
  id: 'oak',
  name: 'Yaşlı Meşe',
  description: 'Köyün yaşlı ağaçlarından biri. Temizlersen kereste kazanırsın.',
  category: 'obstacle',
  size: 2,
  clear: { cost: {}, reward: { wood: [40, 70] }, xp: 6 },
  model({ kit, rng }) {
    roundTree(kit, rng, { s: 1.45, x: -0.12, z: -0.1 });
    roundTree(kit, rng, { s: 0.85, x: 0.5, z: 0.45, leaf: C.leafLight });
    bush(kit, rng, { x: -0.5, z: 0.55, s: 0.7 });
  },
});

export const pine = defineBuilding({
  id: 'pine',
  name: 'Çam',
  description: 'Mis kokulu bir çam. Temizlersen kereste kazanırsın.',
  category: 'obstacle',
  size: 1,
  clear: { cost: {}, reward: { wood: [15, 25] }, xp: 3 },
  model({ kit, rng }) {
    pineTree(kit, rng, { s: rng.range(0.9, 1.15) });
  },
});

export const shrub = defineBuilding({
  id: 'shrub',
  name: 'Çalı',
  description: 'Böğürtlenli bir çalı. Temizlersen biraz altın düşebilir.',
  category: 'obstacle',
  size: 1,
  clear: { cost: {}, reward: { gold: [10, 20], wood: [4, 8] }, xp: 2 },
  model({ kit, rng }) {
    bush(kit, rng, { s: 1.2, berries: true });
  },
});

export const boulder = defineBuilding({
  id: 'boulder',
  name: 'Kaya',
  description: 'Ağır bir kaya. Kırması altın ister ama içinden değerli taşlar çıkar.',
  category: 'obstacle',
  size: 2,
  clear: { cost: { gold: 60 }, reward: { gold: [90, 140] }, xp: 10 },
  model({ kit, rng }) {
    rockPile(kit, rng, { s: 2.0, x: -0.05, z: -0.05 });
    kit.rock(0.18, C.stoneLight, { x: 0.6, y: 0.08, z: 0.55, sy: 0.6 });
  },
});

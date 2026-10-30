// Doğa parçaları: ağaçlar, çamlar, çalılar, kayalar, çiçekler.
// Hem süs/engel binaları hem orman kuşağı aynı fonksiyonları kullanır.

import { C, FLOWER_COLORS } from '../engine/palette.js';

export function roundTree(kit, rng, { s = 1, x = 0, z = 0, leaf = C.leaf } = {}) {
  const tilt = rng.range(-0.08, 0.08);
  kit.group({ x, z, s, rz: tilt }, () => {
    kit.cyl(0.06, 0.1, 0.55, 7, C.trunk, { y: 0.27 });
    kit.cyl(0.03, 0.05, 0.22, 5, C.trunk, { x: 0.1, y: 0.42, rz: -0.7 });
    const l2 = leaf === C.leaf ? C.leafLight : leaf;
    kit.blob(0.38, leaf, { y: 0.78, sy: 0.92 });
    kit.blob(0.27, l2, { x: 0.18, y: 0.95, z: 0.12, sy: 0.9 });
    kit.blob(0.26, C.leafDark, { x: -0.2, y: 0.7, z: -0.12 });
    kit.blob(0.22, l2, { x: -0.06, y: 1.08, z: -0.08 });
  });
}

export function pineTree(kit, rng, { s = 1, x = 0, z = 0 } = {}) {
  kit.group({ x, z, s, ry: rng.range(0, 6.28) }, () => {
    kit.cyl(0.05, 0.08, 0.3, 6, C.bark, { y: 0.15 });
    kit.cone(0.42, 0.55, 7, C.pine, { y: 0.52 });
    kit.cone(0.33, 0.48, 7, C.pineLight, { y: 0.84 });
    kit.cone(0.22, 0.4, 7, C.pine, { y: 1.12 });
  });
}

export function bush(kit, rng, { s = 1, x = 0, z = 0, berries = false } = {}) {
  kit.group({ x, z, s }, () => {
    kit.blob(0.24, C.leaf, { y: 0.16, sy: 0.8 });
    kit.blob(0.18, C.leafLight, { x: 0.16, y: 0.13, z: 0.08, sy: 0.8 });
    kit.blob(0.17, C.leafDark, { x: -0.15, y: 0.12, z: -0.06, sy: 0.8 });
    if (berries) {
      for (let i = 0; i < 5; i++) {
        const a = rng.range(0, 6.28);
        kit.sphere(0.035, C.flowerRed, { x: Math.cos(a) * 0.2, y: 0.22 + rng.range(0, 0.08), z: Math.sin(a) * 0.2, ws: 6, hs: 4 });
      }
    }
  });
}

export function rockPile(kit, rng, { s = 1, x = 0, z = 0, moss = true } = {}) {
  kit.group({ x, z, s }, () => {
    kit.rock(0.32, C.rock, { y: 0.16, sy: 0.7, ry: rng.range(0, 6) });
    kit.rock(0.2, C.stoneLight, { x: 0.26, y: 0.08, z: 0.14, sy: 0.65, ry: rng.range(0, 6) });
    kit.rock(0.15, C.rockDark, { x: -0.22, y: 0.06, z: 0.18, sy: 0.7 });
    if (moss) kit.blob(0.12, C.leafDark, { x: -0.08, y: 0.3, z: -0.05, sy: 0.35 });
  });
}

export function flowers(kit, rng, { count = 6, radius = 0.35, x = 0, z = 0, y = 0 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, 6.28);
    const r = Math.sqrt(rng()) * radius;
    const fx = x + Math.cos(a) * r;
    const fz = z + Math.sin(a) * r;
    const h = rng.range(0.07, 0.14);
    kit.cyl(0.008, 0.01, 0.1, 3, C.leafDark, { x: fx, y: y + h / 2, z: fz, sy: h / 0.1 });
    kit.blob(0.045, rng.pick(FLOWER_COLORS), { x: fx, y: y + h, z: fz, detail: 0, s: rng.range(0.8, 1.15) });
  }
}

export function grassTuft(kit, rng, { x = 0, z = 0, s = 1 } = {}) {
  kit.group({ x, z, s, ry: rng.range(0, 6.28) }, () => {
    kit.cone(0.03, 0.16, 3, C.leafLight, { x: 0, y: 0.08, rz: 0.15 });
    kit.cone(0.03, 0.13, 3, C.leaf, { x: 0.04, y: 0.065, rz: -0.25 });
    kit.cone(0.025, 0.12, 3, C.leafLight, { x: -0.035, y: 0.06, z: 0.02, rx: 0.3 });
  });
}

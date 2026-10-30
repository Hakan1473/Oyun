// Izgaradaki doğa: kesilebilir ağaçlar, böğürtlen çalıları, kayalar, kütükler.

import * as THREE from 'three';
import { defineBuilding } from './registry.js';

const PLANE = new THREE.PlaneGeometry(1, 1);

const tree = (id, name, description, work, wood) => defineBuilding({
  id,
  name,
  description,
  category: 'nature',
  size: 2,
  instanced: true,
  shop: false,
  clear: { verb: 'Kes', icon: 'axe', work, reward: { wood }, leaves: 'stump' },
  model() {},
});

export const spruce = tree('spruce', 'Ladin', 'Yaşlı, kara bir ladin. Kesersen kereste ve yer kazanırsın.', 7, [14, 20]);
export const deadtree = tree('deadtree', 'Kuru Ağaç', 'Çoktan ölmüş, eğri büğrü bir ağaç. Kolay kesilir.', 4.5, [8, 12]);
export const birch = tree('birch', 'Huş', 'Soluk kabuklu bir huş. Odunu iyi yanar.', 5.5, [10, 15]);

export const stump = defineBuilding({
  id: 'stump',
  name: 'Kütük',
  description: 'Kesilen ağaçtan kalan kök. Sökersen yeri açılır.',
  category: 'nature',
  size: 1,
  shop: false,
  clear: { verb: 'Sök', icon: 'axe', work: 2.5, reward: { wood: [2, 4] } },
  model({ kit, variant }) {
    const r = 0.22 + (variant % 3) * 0.03;
    kit.cyl(r, r * 1.2, 0.3, 16, 0xd8d0c4, { mat: 'bark', uv: 'native', y: 0.15, uvRepeat: [2, 0.5] });
    kit.disc(r * 0.97, 16, 0xffffff, { mat: 'endgrain', uv: 'native', y: 0.302 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + variant;
      kit.cyl(0.05, 0.08, 0.35, 7, 0xc8c0b4, { mat: 'bark', uv: 'native', x: Math.cos(a) * r * 1.1, y: 0.05, z: Math.sin(a) * r * 1.1, rz: Math.cos(a) * 1.2, rx: -Math.sin(a) * 1.2 });
    }
    kit.box(0.04, 0.02, 0.12, 0xe8dccc, { mat: 'wood', x: 0.3, y: 0.01, z: 0.1, ry: 0.5 });
  },
});

export const berrybush = defineBuilding({
  id: 'berrybush',
  name: 'Böğürtlen Çalısı',
  description: 'Koyu, ekşi böğürtlenler. Toplarsan erzak olur; birkaç gün sonra yeniden dolar.',
  category: 'nature',
  size: 1,
  shop: false,
  harvest: { verb: 'Topla', icon: 'food', work: 3, reward: { food: [4, 7] }, regrowDays: 2 },
  clear: { verb: 'Kaldır', icon: 'axe', work: 2, reward: { wood: [1, 3] } },
  model({ kit, rng, variant, state }) {
    const picked = state === 'picked';
    kit.rock(0.16, 0x4a4030, { mat: 'plain', seed: variant + 2, y: 0.02, squash: 0.4 });
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rng() * 0.5;
      const r = 0.08 + rng() * 0.2;
      kit.add(PLANE, 0x7a8a5c, {
        mat: 'leaves', uv: 'native', x: Math.cos(a) * r, y: 0.22 + rng() * 0.22, z: Math.sin(a) * r,
        s: 0.55 + rng() * 0.25, ry: a + Math.PI / 2, rx: -0.5 - rng() * 0.6, order: 'YXZ',
      });
    }
    if (!picked) {
      for (let i = 0; i < 16; i++) {
        const a = rng() * Math.PI * 2;
        const y = 0.16 + rng() * 0.3;
        const r = 0.18 + rng() * 0.14;
        kit.sphere(0.03, 0x1e0a20, { x: Math.cos(a) * r, y, z: Math.sin(a) * r, ws: 10, hs: 8 });
      }
    }
  },
});

export const boulder = defineBuilding({
  id: 'boulder',
  name: 'Kaya',
  description: 'Yosun tutmuş bir kaya. Kaldırmak zahmetli ama yer açar.',
  category: 'nature',
  size: 1,
  shop: false,
  clear: { verb: 'Kaldır', icon: 'hammer', work: 5, reward: {} },
  model({ kit, variant }) {
    kit.rock(0.42, 0xd0ccc4, { seed: variant + 3, y: 0.08, squash: 0.6 });
    kit.rock(0.2, 0xc0bcb4, { seed: variant + 9, x: 0.32, y: 0.03, z: 0.2, squash: 0.6 });
  },
});

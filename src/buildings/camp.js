// Kamp yapıları: ateş, ışık, savunma ve hayatta kalma.

import * as THREE from 'three';
import { defineBuilding } from './registry.js';
import { clothGeometry } from '../engine/geo.js';

const HALF_PI = Math.PI / 2;

function stake(kit, { x = 0, z = 0, h = 1, r = 0.05, rx = 0, rz = 0, ry = 0 }) {
  kit.group({ x, z, rx, rz, ry }, () => {
    kit.cyl(r, r * 1.1, h, 9, 0xd0c4b4, { mat: 'bark', uv: 'native', y: h / 2, uvRepeat: [1, h] });
    kit.cone(r, r * 3.2, 9, 0xe8dccc, { mat: 'wood', y: h + r * 1.6 });
  });
}

export const campfire = defineBuilding({
  id: 'campfire',
  name: 'Kamp Ateşi',
  description: 'Gecenin tek dostu. Gölgeler ışığa yaklaşamaz. Ateşi odunla beslemeyi unutma.',
  category: 'survival',
  size: 2,
  order: 1,
  shop: false,
  limit: () => 1,
  levels: [
    { name: 'Küçük ateş', cost: {}, work: 0, hp: 200, light: { radius: 5.2, intensity: 3.2 }, fuelMax: 160 },
    { name: 'Taş ocak', cost: { wood: 60 }, work: 18, hp: 320, light: { radius: 6.4, intensity: 3.8 }, fuelMax: 260 },
    { name: 'Şenlik ateşi', cost: { wood: 160, food: 5 }, work: 35, hp: 450, light: { radius: 7.8, intensity: 4.6 }, fuelMax: 400 },
  ],
  model(m) {
    const { kit, level, rng } = m;
    const R = 0.5 + level * 0.08;
    const n = 9 + level * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      kit.rock(0.13 + (level - 1) * 0.02, 0xbab6ae, { seed: i + 11, x: Math.cos(a) * R, y: 0.05, z: Math.sin(a) * R, squash: 0.7 });
    }
    kit.disc(R * 0.85, 20, 0x1c1814, { y: 0.02 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      kit.group({ ry: -a }, () => kit.log(0.62, 0.05, { x: 0.18, y: 0.18, rz: 0.75, color: 0x6a5a4a }));
    }
    kit.dome(0.22, 0xff6a20, { mat: 'glow', y: 0.02, sy: 0.35 });
    // Oturma kütükleri
    for (let i = 0; i < level + 1; i++) {
      const a = 0.6 + i * (Math.PI * 2 / (level + 1.4));
      kit.group({ x: Math.cos(a) * 1.25, z: Math.sin(a) * 1.25, ry: -a + HALF_PI }, () => kit.log(0.9, 0.13, { y: 0.13, color: 0xd8d0c4 }));
    }
    if (level >= 2) {
      // Pişirme çatalı
      for (const s of [-1, 1]) kit.cyl(0.025, 0.03, 0.9, 6, 0xc8bcb0, { mat: 'bark', uv: 'native', x: s * 0.62, y: 0.45 });
      kit.cyl(0.015, 0.015, 1.3, 6, 0x50504c, { mat: 'metal', y: 0.86, rz: HALF_PI });
      kit.cyl(0.12, 0.1, 0.16, 14, 0x3a3a38, { mat: 'metal', y: 0.62 });
    }
    m.fire({ x: 0, y: 0.28, z: 0, size: 0.8 + level * 0.25 });
    m.anchor('smoke', 0, 1.0 + level * 0.3, 0);
    void rng;
  },
});

export const torch = defineBuilding({
  id: 'torch',
  name: 'Meşale',
  description: 'Karanlıkta küçük bir ışık adası. Gölgeler önce ışıkları söndürmeye çalışır.',
  category: 'defense',
  size: 1,
  order: 10,
  limit: ({ cabinLevel }) => 4 + cabinLevel * 2,
  levels: [{ cost: { wood: 8 }, work: 4, hp: 60, light: { radius: 3.4, intensity: 2.0 } }],
  model(m) {
    const { kit } = m;
    kit.rock(0.12, 0xb0aca4, { seed: 3, x: 0.08, y: 0.03, z: 0.05 });
    kit.rock(0.1, 0xb0aca4, { seed: 4, x: -0.1, y: 0.03, z: -0.04 });
    kit.group({ rz: 0.06, rx: -0.05 }, () => {
      kit.cyl(0.035, 0.045, 1.45, 9, 0xd0c4b4, { mat: 'bark', uv: 'native', y: 0.72, uvRepeat: [1, 1.5] });
      kit.cyl(0.07, 0.055, 0.22, 10, 0x5a4e40, { mat: 'cloth', y: 1.5 });
      kit.sphere(0.06, 0xff8030, { mat: 'glow', y: 1.62, ws: 10, hs: 8 });
    });
    m.fire({ x: 0.09, y: 1.66, z: -0.07, size: 0.32 });
  },
});

export const barricade = defineBuilding({
  id: 'barricade',
  name: 'Barikat',
  description: 'Sivri kazıklar. Gölgeleri yavaşlatır; geçmek için önce kırmaları gerekir.',
  category: 'defense',
  size: 1,
  order: 11,
  repeat: true,
  blocksCreatures: true,
  levels: [{ cost: { wood: 12 }, work: 5, hp: 140 }],
  model(m) {
    const { kit } = m;
    kit.log(1.05, 0.08, { y: 0.32, color: 0xd8d0c4 });
    stake(kit, { x: -0.25, h: 1.1, rz: 0.55, rx: 0.1 });
    stake(kit, { x: 0.25, h: 1.1, rz: -0.55, rx: 0.1 });
    stake(kit, { x: 0, z: 0.1, h: 1.0, rx: 0.5 });
    kit.torus(0.07, 0.012, 0xb8a078, { mat: 'cloth', y: 0.42, x: -0.05, rx: HALF_PI });
  },
});

export const shelter = defineBuilding({
  id: 'shelter',
  name: 'Branda Barınak',
  description: 'Dallar ve eski bir brandadan yapılmış barınak. Yaralılar burada daha çabuk iyileşir.',
  category: 'shelter',
  size: 2,
  order: 2,
  limit: ({ cabinLevel }) => 1 + cabinLevel,
  levels: [{ cost: { wood: 40 }, work: 14, hp: 160, heal: 1.6 }],
  model(m) {
    const { kit } = m;
    // A çerçeve
    for (const s of [-1, 1]) {
      kit.group({ x: s * 0.72 }, () => {
        kit.cyl(0.04, 0.05, 1.45, 8, 0xd0c4b4, { mat: 'bark', uv: 'native', y: 0.66, z: 0.42, rx: -0.6 });
        kit.cyl(0.04, 0.05, 1.45, 8, 0xd0c4b4, { mat: 'bark', uv: 'native', y: 0.66, z: -0.42, rx: 0.6 });
      });
    }
    kit.cyl(0.045, 0.045, 1.75, 8, 0xd0c4b4, { mat: 'bark', uv: 'native', y: 1.2, rz: HALF_PI });
    // Branda: iki eğimli kumaş
    const cloth = clothGeometry(1.7, 1.25, 0.06);
    for (const s of [-1, 1]) {
      kit.add(cloth, 0x4c5a62, { mat: 'cloth', uv: 'native', uvRepeat: [2, 2], y: 0.62, z: s * 0.44, rx: s * 0.98 });
    }
    kit.box(0.6, 0.08, 1.2, 0x7a5a3a, { mat: 'cloth', x: 0.1, y: 0.05, rx: 0, r: 0.03 });
    kit.cyl(0.11, 0.11, 0.5, 12, 0x6a4a6a, { mat: 'cloth', x: -0.3, y: 0.11, rz: HALF_PI });
    for (const [x, z] of [[-0.9, 0.95], [0.9, 0.95], [-0.9, -0.95], [0.9, -0.95]]) {
      kit.cyl(0.015, 0.02, 0.18, 5, 0xc8bcb0, { mat: 'wood', x, y: 0.06, z });
    }
  },
});

export const woodshed = defineBuilding({
  id: 'woodshed',
  name: 'Odunluk',
  description: 'Yağmurdan korunan odun yığını. Kereste deposu büyür.',
  category: 'survival',
  size: 2,
  order: 20,
  limit: ({ cabinLevel }) => cabinLevel + 1,
  levels: [{ cost: { wood: 30 }, work: 12, hp: 180, storage: { wood: 160 } }],
  model(m) {
    const { kit } = m;
    for (const [x, z, h] of [[-0.75, -0.6, 1.5], [0.75, -0.6, 1.5], [-0.75, 0.6, 1.1], [0.75, 0.6, 1.1]]) {
      kit.cyl(0.05, 0.06, h, 8, 0xd0c4b4, { mat: 'bark', uv: 'native', x, y: h / 2, z });
    }
    kit.box(1.85, 0.06, 1.55, 0xffffff, { mat: 'roof', y: 1.33, rx: 0.27, uvScale: 0.6 });
    for (let row = 0; row < 5; row++) {
      for (let k = 0; k < 6 - (row % 2); k++) {
        kit.log(0.5, 0.075, { x: -0.6 + k * 0.24 + (row % 2) * 0.12, y: 0.08 + row * 0.14, z: 0, ry: HALF_PI, color: 0xe0d8cc });
      }
    }
  },
});

export const trap = defineBuilding({
  id: 'trap',
  name: 'Kapan',
  description: 'Paslı bir ayı kapanı. Üstüne basan gölge ağır yara alır. Her gece yeniden kurulur.',
  category: 'defense',
  size: 1,
  order: 12,
  limit: ({ cabinLevel }) => 2 + cabinLevel * 2,
  levels: [{ cost: { wood: 10, food: 2 }, work: 4, hp: 80, trapDamage: 70 }],
  model(m) {
    const { kit } = m;
    kit.cyl(0.18, 0.18, 0.02, 20, 0x3a3836, { mat: 'metal', y: 0.02 });
    for (const s of [-1, 1]) {
      kit.group({ ry: s > 0 ? 0 : Math.PI, rx: 0 }, () => {
        kit.torus(0.2, 0.014, 0x5a4e44, { mat: 'metal', arc: Math.PI, y: 0.04, rx: -HALF_PI + 0.45 });
        for (let k = 0; k < 6; k++) {
          const a = 0.2 + (k / 5) * (Math.PI - 0.4);
          kit.cone(0.014, 0.06, 5, 0x8a8078, { mat: 'metal', x: Math.cos(a) * 0.2, y: 0.08, z: Math.sin(a) * 0.08 + 0.05 });
        }
      });
    }
    kit.cyl(0.006, 0.006, 0.4, 4, 0x4a4844, { mat: 'metal', x: 0.25, y: 0.02, z: 0.1, rz: HALF_PI, ry: 0.4 });
    kit.cyl(0.02, 0.03, 0.15, 6, 0xc8bcb0, { mat: 'wood', x: 0.44, y: 0.06, z: 0.2 });
  },
});

export const snare = defineBuilding({
  id: 'snare',
  name: 'Av Tuzağı',
  description: 'Tavşan için tel tuzak. Zamanla erzak toplar; dolunca üstüne dokun.',
  category: 'survival',
  size: 1,
  order: 21,
  limit: ({ cabinLevel }) => 1 + cabinLevel,
  levels: [{ cost: { wood: 15 }, work: 6, hp: 50, produces: { resource: 'food', rate: 2.2, capacity: 8 } }],
  model(m) {
    const { kit } = m;
    kit.cyl(0.03, 0.035, 0.6, 7, 0xd0c4b4, { mat: 'bark', uv: 'native', x: -0.2, y: 0.3 });
    kit.cyl(0.02, 0.025, 0.5, 7, 0xd0c4b4, { mat: 'bark', uv: 'native', x: 0.15, y: 0.25, rz: -0.3 });
    kit.cyl(0.012, 0.012, 0.5, 5, 0xd0c4b4, { mat: 'bark', uv: 'native', x: -0.05, y: 0.52, rz: HALF_PI + 0.2 });
    kit.torus(0.09, 0.006, 0x8a8478, { mat: 'metal', y: 0.14, x: 0.05 });
    kit.rock(0.1, 0xb0aca4, { seed: 12, x: 0.28, y: 0.03, z: 0.15 });
  },
});

export const lamppost = defineBuilding({
  id: 'lamppost',
  name: 'Fener Direği',
  description: 'Kulübeden bulunan gaz lambası, yüksek bir direkte. Geniş bir alanı aydınlatır.',
  category: 'defense',
  size: 1,
  order: 13,
  limit: ({ cabinLevel }) => (cabinLevel >= 2 ? 2 + (cabinLevel - 2) * 2 : 0),
  levels: [{ cost: { wood: 35, food: 4 }, work: 10, hp: 120, requires: { cabin: 2 }, light: { radius: 5.0, intensity: 2.6, warm: true } }],
  model(m) {
    const { kit } = m;
    kit.cyl(0.07, 0.08, 2.4, 10, 0xd0c4b4, { mat: 'bark', uv: 'native', y: 1.2, uvRepeat: [1, 2] });
    kit.box(0.6, 0.06, 0.06, 0xc8bcac, { mat: 'wood', x: 0.25, y: 2.3 });
    kit.box(0.04, 0.42, 0.04, 0xc8bcac, { mat: 'wood', x: 0.15, y: 2.12, rz: 0.75 });
    kit.group({ x: 0.5, y: 2.0 }, () => {
      kit.cyl(0.004, 0.004, 0.22, 4, 0x30302c, { mat: 'metal', y: 0.18 });
      kit.cyl(0.09, 0.1, 0.05, 12, 0x3a3a38, { mat: 'metal', y: 0.06 });
      kit.cyl(0.07, 0.07, 0.2, 12, 0xffc070, { mat: 'warm', y: -0.07 });
      kit.cyl(0.09, 0.09, 0.03, 12, 0x3a3a38, { mat: 'metal', y: -0.18 });
      kit.cone(0.1, 0.1, 12, 0x3a3a38, { mat: 'metal', y: 0.13 });
    });
    for (let i = 0; i < 3; i++) kit.rock(0.12, 0xb0aca4, { seed: 20 + i, x: Math.cos(i * 2) * 0.15, y: 0.03, z: Math.sin(i * 2) * 0.15 });
    m.light({ x: 0.5, y: 1.9, z: 0, radius: 5.0, color: 0xffb46a, intensity: 2.6 });
  },
});

export const radio = defineBuilding({
  id: 'radio',
  name: 'Telsiz Direği',
  description: 'Mert\'in bulduğu eski telsiz için yüksek bir anten. Belki biri bizi duyar.',
  category: 'survival',
  size: 2,
  order: 30,
  limit: ({ flags }) => (flags?.radioFound ? 1 : 0),
  levels: [{ cost: { wood: 120, food: 6 }, work: 40, hp: 220, requires: { cabin: 2 } }],
  model(m) {
    const { kit } = m;
    kit.cyl(0.09, 0.12, 5.6, 10, 0xd0c4b4, { mat: 'bark', uv: 'native', y: 2.8, uvRepeat: [1, 4] });
    for (let k = 0; k < 6; k++) kit.box(0.28, 0.03, 0.05, 0xc8bcac, { mat: 'wood', y: 0.5 + k * 0.8, z: 0.08 });
    kit.cyl(0.012, 0.012, 1.4, 5, 0x707074, { mat: 'metal', y: 6.2 });
    kit.box(0.7, 0.03, 0.03, 0x707074, { mat: 'metal', y: 6.0 });
    kit.box(0.5, 0.03, 0.03, 0x707074, { mat: 'metal', y: 6.35 });
    kit.sphere(0.05, 0xff2020, { mat: 'glow', y: 6.95, ws: 10, hs: 8 });
    for (const a of [0.4, 2.5, 4.6]) {
      const dx = Math.cos(a) * 1.1;
      const dz = Math.sin(a) * 1.1;
      const len = Math.hypot(1.1, 4.8);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-dx, 4.8, -dz).normalize());
      const e = new THREE.Euler().setFromQuaternion(q);
      kit.cyl(0.006, 0.006, len, 4, 0x2a2a2a, { mat: 'metal', x: dx / 2, y: 2.4, z: dz / 2, rx: e.x, ry: e.y, rz: e.z });
      kit.cyl(0.02, 0.025, 0.16, 6, 0xc8bcb0, { mat: 'wood', x: dx, y: 0.05, z: dz });
    }
    kit.box(0.42, 0.3, 0.3, 0x3a4234, { mat: 'metal', x: 0.45, y: 0.15, z: 0.25, r: 0.03 });
    kit.box(0.12, 0.02, 0.05, 0x9ad08a, { mat: 'glow', x: 0.45, y: 0.22, z: 0.41 });
    kit.box(0.3, 0.2, 0.18, 0x202020, { mat: 'plain', x: -0.3, y: 0.1, z: 0.4 });
    m.blink({ x: 0, y: 6.95, z: 0 });
  },
});

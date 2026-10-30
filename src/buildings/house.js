import { defineBuilding } from './registry.js';
import { C, ROOF_VARIANTS, WALL_VARIANTS } from '../engine/palette.js';
import { pad, onFace, windowPane, door, gableRoof, lantern } from './parts.js';
import { flowers } from '../world/nature.js';

const SHUTTERS = [C.roofTeal, C.roofBlue, C.roofGreen, C.wood, C.roofRed];

export default defineBuilding({
  id: 'house',
  name: 'Ev',
  description: 'Sıcak bir yuva. Her ev köyüne yeni köylüler getirir ve küçük bir vergi öder.',
  category: 'village',
  size: 2,
  order: 2,
  limit: ({ palaceLevel }) => 2 + palaceLevel * 2,
  levels: [
    { cost: { gold: 120, wood: 90 }, time: 8, xp: 12, villagers: 2, produces: { resource: 'gold', rate: 6, capacity: 60 } },
    { cost: { gold: 320, wood: 260 }, time: 25, xp: 30, villagers: 3, requires: { palace: 2 }, produces: { resource: 'gold', rate: 11, capacity: 120 } },
    { cost: { gold: 800, wood: 650 }, time: 60, xp: 70, villagers: 4, requires: { palace: 3 }, produces: { resource: 'gold', rate: 18, capacity: 220 } },
  ],

  model(m) {
    const { kit, level, variant, rng } = m;
    const roof = ROOF_VARIANTS[variant % ROOF_VARIANTS.length];
    const wall = WALL_VARIANTS[(variant >> 3) % WALL_VARIANTS.length];
    const shutters = SHUTTERS[(variant >> 5) % SHUTTERS.length];
    const y0 = pad(kit, 2, { color: C.stone, top: C.path, h: 0.14, inset: 0.12 });

    const w = level >= 3 ? 1.36 : 1.26;
    const d = 0.98;
    const h = level >= 2 ? 1.12 : 0.78;
    const cx = level >= 3 ? -0.1 : 0;

    kit.group({ x: cx }, () => {
      kit.box(w + 0.07, 0.12, d + 0.07, C.stone, { y: y0 + 0.06, r: 0.02 });
      kit.box(w, h, d, wall, { y: y0 + h / 2, r: 0.025 });
      // Ahşap iskelet
      for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        kit.box(0.07, h, 0.07, C.woodDark, { x: (px * w) / 2, y: y0 + h / 2, z: (pz * d) / 2 });
      }
      kit.box(w + 0.05, 0.06, d + 0.05, C.woodDark, { y: y0 + h });
      if (level >= 2) kit.box(w + 0.04, 0.05, d + 0.04, C.woodDark, { y: y0 + 0.58 });

      const top = gableRoof(kit, { len: w, depth: d, rise: 0.5, y: y0 + h + 0.03, color: roof, gable: wall, overhang: 0.16, overhangX: 0.12, thick: 0.09 });

      // Baca
      kit.box(0.2, 0.5, 0.2, C.stone, { x: w * 0.27, y: top - 0.05, z: -0.24, r: 0.02 });
      kit.box(0.26, 0.06, 0.26, C.stoneDark, { x: w * 0.27, y: top + 0.2, z: -0.24, r: 0.015 });
      m.anchor('smoke', cx + w * 0.27, top + 0.26, -0.24);

      // Ön yüz (+z): kapı ve pencere
      onFace(kit, '+z', d / 2, -w * 0.22, y0, () => door(kit, { w: 0.3, h: 0.52, color: C.door }));
      onFace(kit, '+z', d / 2, w * 0.24, y0 + 0.42, () => windowPane(kit, { flowerbox: true, shutters, rng }));
      if (level >= 2) {
        onFace(kit, '+z', d / 2, -w * 0.22, y0 + 0.85, () => windowPane(kit, { w: 0.22, h: 0.22, shutters }));
        onFace(kit, '+z', d / 2, w * 0.24, y0 + 0.85, () => windowPane(kit, { w: 0.22, h: 0.22, shutters }));
      }
      // Yan yüz (+x): pencere ve çatı arası
      onFace(kit, '+x', w / 2, 0, y0 + 0.42, () => windowPane(kit, { flowerbox: level >= 2, shutters, rng }));
      if (level >= 2) onFace(kit, '+x', w / 2, 0, y0 + 0.85, () => windowPane(kit, { w: 0.22, h: 0.22 }));
      kit.group({ x: w / 2 + 0.005, y: y0 + h + 0.22, ry: Math.PI / 2 }, () => {
        kit.cyl(0.09, 0.09, 0.04, 14, C.wallWhite, { rx: Math.PI / 2 });
        kit.cyl(0.065, 0.065, 0.05, 14, C.window, { rx: Math.PI / 2, z: 0.005 });
      });
      onFace(kit, '-z', d / 2, 0, y0 + 0.42, () => windowPane(kit, {}));
      onFace(kit, '-x', w / 2, 0, y0 + 0.42, () => windowPane(kit, {}));
    });

    m.door = { x: cx - w * 0.22, z: d / 2 + 0.1 };

    if (level >= 3) {
      // Sundurma ve fener
      kit.box(0.08, 0.6, 0.08, C.wood, { x: 0.62, y: y0 + 0.3, z: 0.72 });
      kit.box(0.08, 0.6, 0.08, C.wood, { x: 0.62, y: y0 + 0.3, z: 0.1 });
      kit.box(0.42, 0.06, 0.78, roof, { x: 0.52, y: y0 + 0.64, z: 0.41, rz: -0.25, r: 0.015 });
      kit.cyl(0.02, 0.02, 0.5, 6, C.iron, { x: 0.82, y: y0 + 0.25, z: 0.82 });
      kit.group({ x: 0.82, z: 0.82 }, () => lantern(kit, { y: y0 + 0.5, s: 0.8 }));
    } else {
      // Kapı önünde çiçekler
      flowers(kit, rng, { count: 5, radius: 0.16, x: 0.62, z: 0.68, y: y0 });
    }
    flowers(kit, rng, { count: 4, radius: 0.12, x: -0.7, z: 0.72, y: y0 });
  },
});

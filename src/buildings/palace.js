import { defineBuilding } from './registry.js';
import { C, shade } from '../engine/palette.js';
import { SLOT } from '../engine/materials.js';
import { pad, onFace, windowPane, door, crenels, tower, flag } from './parts.js';
import { bush } from '../world/nature.js';

const ROOFS = [C.roofRed, C.roofBlue, C.roofPurple];

export default defineBuilding({
  id: 'palace',
  name: 'Saray',
  description: 'Köyünün kalbi. Saray büyüdükçe yeni yapılar açılır, ambarların genişler.',
  category: 'village',
  size: 4,
  order: 1,
  limit: () => 1,
  levels: [
    { cost: { gold: 200, wood: 150 }, time: 15, xp: 40, storage: { gold: 1000, wood: 1000 } },
    { cost: { gold: 900, wood: 700 }, time: 45, xp: 120, storage: { gold: 2500, wood: 2500 } },
    { cost: { gold: 2400, wood: 1800 }, time: 120, xp: 300, storage: { gold: 5000, wood: 5000 } },
  ],

  model(m) {
    const { kit, level } = m;
    const roof = ROOFS[level - 1];
    const y0 = pad(kit, 4, { h: 0.24, inset: 0.12 });
    const kw = 2.45;
    const kh = 1.3 + level * 0.12;
    const trim = level >= 2 ? C.gold : C.stoneLight;

    // Ana gövde
    kit.box(kw + 0.1, 0.2, kw + 0.1, C.stone, { y: y0 + 0.1, r: 0.03 });
    kit.box(kw, kh, kw, C.wall, { y: y0 + kh / 2, r: 0.04 });
    kit.box(kw + 0.14, 0.1, kw + 0.14, C.stoneLight, { y: y0 + kh, r: 0.02 });
    crenels(kit, kw + 0.1, kw + 0.1, y0 + kh + 0.05, C.stoneLight, { size: 0.18, gap: 0.44 });

    // Ön kapı ve basamaklar (+z yüzü)
    onFace(kit, '+z', kw / 2, 0, y0, () => {
      door(kit, { w: 0.5, h: 0.82, color: C.door, frame: C.stoneLight, step: false });
      kit.cyl(0.3, 0.3, 0.045, 14, trim, { y: 0.57, z: 0.002, rx: Math.PI / 2, thetaStart: Math.PI / 2, thetaLength: Math.PI, slot: level >= 2 ? SLOT.SHINY : 0 });
    });
    kit.box(0.95, 0.07, 0.3, C.stoneLight, { y: y0 + 0.035, z: kw / 2 + 0.15, r: 0.02 });
    kit.box(1.15, 0.07, 0.24, C.stone, { y: y0 - 0.03, z: kw / 2 + 0.35, r: 0.02 });

    // Pencereler ve sancaklar
    for (const u of [-0.78, 0.78]) {
      onFace(kit, '+z', kw / 2, u, y0 + kh * 0.6, () => windowPane(kit, { w: 0.24, h: 0.3, arch: true, frame: C.stoneLight }));
    }
    for (const u of [-0.75, 0, 0.75]) {
      onFace(kit, '+x', kw / 2, u, y0 + kh * 0.6, () => {
        if (u === 0) {
          kit.box(0.34, 0.6, 0.03, C.cloth, { y: -0.05, z: 0.02 });
          kit.cyl(0.0, 0.17, 0.12, 3, C.cloth, { y: -0.39, z: 0.02, rx: Math.PI, sz: 0.2 });
          kit.cyl(0.08, 0.08, 0.02, 14, C.gold, { y: 0.04, z: 0.04, rx: Math.PI / 2, slot: SLOT.SHINY });
          kit.box(0.42, 0.04, 0.05, C.woodDark, { y: 0.26, z: 0.03 });
        } else {
          windowPane(kit, { w: 0.24, h: 0.3, arch: true, frame: C.stoneLight });
        }
      });
    }
    for (const u of [-0.75, 0.75]) {
      onFace(kit, '-x', kw / 2, u, y0 + kh * 0.6, () => windowPane(kit, { w: 0.24, h: 0.3, arch: true, frame: C.stoneLight }));
      onFace(kit, '-z', kw / 2, u, y0 + kh * 0.6, () => windowPane(kit, { w: 0.24, h: 0.3, arch: true, frame: C.stoneLight }));
    }

    // Üst kule (taht salonu)
    const uw = 1.32;
    const uy = y0 + kh;
    const uh = 0.85 + level * 0.18;
    kit.box(uw, uh, uw, C.wallWhite, { y: uy + uh / 2, r: 0.03 });
    kit.box(uw + 0.08, 0.08, uw + 0.08, trim, { y: uy + uh, r: 0.02, slot: level >= 2 ? SLOT.SHINY : 0 });
    for (const face of ['+z', '+x', '-z', '-x']) {
      onFace(kit, face, uw / 2, 0, uy + uh * 0.52, () => windowPane(kit, { w: 0.22, h: 0.32, arch: true, frame: C.stoneLight, cross: false }));
    }
    const ry = uy + uh + 0.04;
    const roofH = 1.05 + level * 0.15;
    kit.box(uw + 0.3, 0.08, uw + 0.3, shade(roof, 0.78), { y: ry, r: 0.02 });
    kit.pyramid((uw + 0.26) / 2, roofH, roof, { y: ry + roofH / 2 + 0.04 });
    if (level >= 3) {
      kit.dome(0.2, C.gold, { y: ry + roofH * 0.82, slot: SLOT.SHINY });
    }
    const top = ry + roofH + 0.04;
    kit.cyl(0.018, 0.022, 0.5, 6, C.iron, { y: top + 0.2 });
    kit.sphere(0.07, C.gold, { y: top, slot: SLOT.SHINY, ws: 10, hs: 8 });
    const f0 = flag(C.cloth, { w: 0.46, h: 0.28 });
    f0.mesh.position.set(0, top + 0.32, 0);
    m.dynamic(f0.mesh, f0.update, f0.dispose);

    // Köşe kuleleri
    const tr = 0.44 + level * 0.02;
    const th = kh + 0.5 + level * 0.18;
    const c = kw / 2 + 0.02;
    const corners = [[c, c], [c, -c], [-c, c], [-c, -c]];
    corners.forEach(([x, z], n) => {
      const tTop = tower(kit, {
        x, z, y0, r: tr, h: th, wall: C.wall, roof, band: C.stoneLight, roofH: 0.85 + level * 0.1,
        windows: [{ angle: Math.atan2(x, z), y: th * 0.62 }],
      });
      if (level >= 2) kit.torus(tr * 1.02, 0.025, C.gold, { x, z, y: y0 + th * 0.35, rx: Math.PI / 2, slot: SLOT.SHINY });
      if (level >= 2 || n === 0) {
        const f = flag(n % 2 ? C.clothBlue : C.cloth, { w: 0.3, h: 0.18, phase: n * 1.7 });
        f.mesh.position.set(x, tTop + 0.14, z);
        m.dynamic(f.mesh, f.update, f.dispose);
      }
    });

    // Bahçe: çalılar ve fenerler
    const rng = m.rng;
    bush(kit, rng, { x: 1.02, z: 1.72, s: 0.55 });
    bush(kit, rng, { x: -1.02, z: 1.72, s: 0.55 });
    bush(kit, rng, { x: 1.74, z: 0.1, s: 0.5 });
    for (const sx of [-0.62, 0.62]) {
      kit.cyl(0.05, 0.06, 0.12, 8, C.stone, { x: sx, y: y0 + 0.06, z: kw / 2 + 0.5 });
      kit.cyl(0.018, 0.022, 0.48, 6, C.iron, { x: sx, y: y0 + 0.36, z: kw / 2 + 0.5 });
      kit.box(0.1, 0.12, 0.1, C.glow, { x: sx, y: y0 + 0.66, z: kw / 2 + 0.5, slot: SLOT.GLOW });
      kit.pyramid(0.075, 0.08, C.iron, { x: sx, y: y0 + 0.76, z: kw / 2 + 0.5 });
    }
  },
});

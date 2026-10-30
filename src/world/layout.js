// Dünyanın yerleşimi: kulübe ortada, gelinen patika güneydoğudan girer,
// ikinci, silik patika kuzeybatıya, ormanın derinliklerine uzanır.

import * as THREE from 'three';

export const PATHS = [
  {
    id: 'camp',
    width: 1.8,
    points: [[0.6, 2.6], [2.6, 4.6], [4.6, 5.6], [6.8, 7.8], [9.4, 9.2], [12.6, 12.4], [16.4, 14.6], [20.5, 19.8], [26, 23.5], [32, 30], [40, 35], [50, 46], [62, 55]],
  },
  {
    id: 'deep',
    width: 1.25,
    points: [[-0.8, -2.4], [-2.6, -4.6], [-5.2, -5.4], [-7.4, -8.2], [-10.6, -9.6], [-14, -13.4], [-18.6, -15.6], [-24, -21], [-31, -26], [-40, -33], [-52, -41], [-64, -50]],
  },
];

for (const p of PATHS) {
  p.curve = new THREE.CatmullRomCurve3(p.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  p.samples = p.curve.getSpacedPoints(400);
}

// Bir noktanın en yakın patika merkez çizgisine uzaklığı (ve hangi patika)
export function pathDistance(x, z) {
  let best = Infinity;
  let which = null;
  for (const p of PATHS) {
    for (const s of p.samples) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < best) {
        best = d;
        which = p;
      }
    }
  }
  return { d: Math.sqrt(best), path: which };
}

export const CLEARING = { x: 0, z: 1, r: 7.4 };
export const CABIN = { i: 16, j: 16, size: 4 };
export const CAMPFIRE = { i: 15, j: 21 };

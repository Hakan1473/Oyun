// Malzeme kütüphanesi. Modeller anahtar adlarla malzeme seçer ('wood', 'bark', 'stone'...);
// Kit aynı malzemeyi kullanan parçaları tek ağda birleştirir.

import * as THREE from 'three';

export const MAT = {};
export const MAT_KEYS = [];
let ready = false;

const std = (opts) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...opts });

export function initMaterials(T, { msaa = false } = {}) {
  if (ready) return MAT;
  ready = true;
  const add = (key, m) => {
    MAT[key] = m;
    MAT_KEYS.push(key);
  };
  add('plain', std({ roughness: 0.85 }));
  add('wood', std({ map: T.wood, roughness: 0.92 }));
  add('bark', std({ map: T.bark, roughness: 0.95 }));
  add('birch', std({ map: T.birch, roughness: 0.8 }));
  add('endgrain', std({ map: T.endgrain, roughness: 0.9 }));
  add('roof', std({ map: T.roof, roughness: 0.95 }));
  add('stone', std({ map: T.stone, roughness: 0.92 }));
  add('rock', std({ map: T.rock, roughness: 0.9 }));
  add('metal', std({ map: T.metal, roughness: 0.55, metalness: 0.55 }));
  add('cloth', std({ map: T.cloth, roughness: 0.96, side: THREE.DoubleSide }));
  add('glass', std({ roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.55 }));
  // Parlayan yüzeyler HDR değer yazar; bloom onları yakalar
  add('glow', new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.6, 2.6, 2.6) }));
  // Gece yanan sıcak ışık (pencere, fener camı) ve soğuk ışıltı (mantar); şiddeti gün döngüsü ayarlar
  add('warm', new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.4, 0.4, 0.4) }));
  add('cold', new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.2, 0.2, 0.2) }));
  const leafy = (map) => std({
    map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95, alphaToCoverage: msaa,
  });
  add('needles', leafy(T.needles));
  add('leaves', leafy(T.leaves));
  add('fern', leafy(T.fern));
  for (const k of ['needles', 'leaves', 'fern']) MAT[k].shadowSide = THREE.DoubleSide;
  // Gölge varlıkları: ışığı zor yansıtan, hafif ıslak görünümlü kara yüzey
  add('shade', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35, color: 0x4a4e58, emissive: 0x020305 }));
  return MAT;
}

// Seçili nesne için parlayan kopyalar (tembel)
const hi = new Map();
export function highlightOf(m) {
  let c = hi.get(m);
  if (!c) {
    c = m.clone();
    if (c.emissive) {
      c.emissive = new THREE.Color(0xffe2b8);
      c.emissiveIntensity = 0.12;
      if (c.map) c.emissiveMap = c.map;
    }
    hi.set(m, c);
  }
  return c;
}

export function setHighlightPulse(t) {
  const k = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 4.5));
  for (const m of hi.values()) if (m.emissive) m.emissiveIntensity = k;
}

// İnşaat sırasında binayı aşağıdan yukarı örmek için kesme düzlemli kopya
export function clippedOf(m, plane) {
  const c = m.clone();
  c.clippingPlanes = [plane];
  c.clipShadows = true;
  return c;
}

let softTex = null;
export function softShadowTexture() {
  if (softTex) return softTex;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.7)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  softTex = new THREE.CanvasTexture(cv);
  return softTex;
}

let blob = null;
export function blobShadowMaterial() {
  if (!blob) {
    blob = new THREE.MeshBasicMaterial({
      map: softShadowTexture(), transparent: true, depthWrite: false, color: 0x000000,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
  }
  return blob;
}

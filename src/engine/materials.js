// Paylaşılan malzemeler. Modeller köşe renkleri (vertex color) kullandığı için
// tüm köy birkaç malzemeyle çizilir — mobilde hız bunun sayesindedir.

import * as THREE from 'three';

export const SLOT = { MATTE: 0, SHINY: 1, GLOW: 2 };

export const MATERIALS = [
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35 }),
  new THREE.MeshBasicMaterial({ vertexColors: true }),
];

// Seçili bina için aynı malzemelerin parlayan kopyaları.
export const HIGHLIGHT = MATERIALS.map((m) => {
  const c = m.clone();
  if (c.emissive) {
    c.emissive = new THREE.Color(0xffffff);
    c.emissiveIntensity = 0.18;
  } else {
    c.color = new THREE.Color(1.25, 1.25, 1.25);
  }
  return c;
});

export function setHighlightPulse(t) {
  const k = 0.05 + 0.07 * (0.5 + 0.5 * Math.sin(t * 4.5));
  for (const m of HIGHLIGHT) if (m.emissive) m.emissiveIntensity = k;
}

// İnşaat sırasında binayı aşağıdan yukarı "örmek" için kesme düzlemli kopyalar.
export function clippedMaterials(plane) {
  return MATERIALS.map((m) => {
    const c = m.clone();
    c.clippingPlanes = [plane];
    c.clipShadows = true;
    return c;
  });
}

let softTex = null;
export function softShadowTexture() {
  if (softTex) return softTex;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  softTex = new THREE.CanvasTexture(cv);
  softTex.colorSpace = THREE.SRGBColorSpace;
  return softTex;
}

let squareTex = null;
export function softSquareTexture() {
  if (squareTex) return squareTex;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.filter = 'blur(10px)';
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath();
  g.roundRect(22, 22, s - 44, s - 44, 18);
  g.fill();
  squareTex = new THREE.CanvasTexture(cv);
  squareTex.colorSpace = THREE.SRGBColorSpace;
  return squareTex;
}

const blobMat = { round: null, square: null };
export function contactShadowMaterial(kind = 'round') {
  if (!blobMat[kind]) {
    blobMat[kind] = new THREE.MeshBasicMaterial({
      map: kind === 'round' ? softShadowTexture() : softSquareTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });
  }
  return blobMat[kind];
}

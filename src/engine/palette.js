// Yuva renk paleti. Tüm modeller bu renklerden beslenir;
// sanat yönünü değiştirmek için tek yer burası.

export const C = {
  // zemin
  grassA: 0x80c049,
  grassB: 0x79b943,
  grassEdge: 0x6cae3c,
  grassOuter: 0x4f9634,
  forestFloor: 0x3f8430,
  dirt: 0xc69c62,
  dirtDark: 0xa57c48,
  path: 0xe2cfa4,
  pathDark: 0xc9b285,
  sand: 0xe8d39a,

  // taş
  stone: 0xbab4a8,
  stoneLight: 0xd9d3c6,
  stoneDark: 0x8f887c,
  rock: 0xa7a197,
  rockDark: 0x857f75,

  // duvar ve sıva
  wall: 0xf6e8cb,
  wallWarm: 0xf9dcc1,
  wallButter: 0xfbe8b0,
  wallWhite: 0xfdf7ee,
  wallBlush: 0xf6d2c8,

  // ahşap
  wood: 0x9e6b3d,
  woodDark: 0x6f4526,
  woodLight: 0xc8925a,
  woodPale: 0xe3b77f,
  bark: 0x7c522f,

  // çatılar
  roofRed: 0xe2553e,
  roofCoral: 0xf07457,
  roofBlue: 0x3f84de,
  roofTeal: 0x2fa6a0,
  roofGreen: 0x5aa846,
  roofOrange: 0xf3933a,
  roofPurple: 0x8e5fd0,
  roofSlate: 0x6c6f86,
  roofBrown: 0x8a5a3c,

  // detay
  gold: 0xffc93d,
  goldDeep: 0xe5a21f,
  window: 0x34507f,
  windowLight: 0x5d7fb5,
  glow: 0xffd77a,
  door: 0x7b4a27,
  cloth: 0xd8343f,
  clothBlue: 0x2f6fd1,
  iron: 0x3c4048,
  rope: 0xd8bf8a,

  // doğa
  leaf: 0x5cae3c,
  leafDark: 0x40902e,
  leafLight: 0x86c94b,
  pine: 0x2f7d45,
  pineLight: 0x3f9655,
  trunk: 0x8a5a33,
  water: 0x4fb7ea,
  hay: 0xf0c75a,

  // çiçekler
  flowerRed: 0xff5a6a,
  flowerPink: 0xff97c0,
  flowerYellow: 0xffd640,
  flowerWhite: 0xfff8f0,
  flowerBlue: 0x86a8ff,
  flowerPurple: 0xb68cff,

  // köylüler
  skin: [0xf6d3b3, 0xeec09a, 0xd9a47c, 0xb97f57],
  hair: [0x3b2a20, 0x6b4428, 0x1f1a17, 0xb5773d, 0x8a8a8a],
  shirt: [0x3f84de, 0xe2553e, 0x5aa846, 0xf3933a, 0x8e5fd0, 0x2fa6a0, 0xf2c94c, 0xe36aa4],
};

export const ROOF_VARIANTS = [C.roofRed, C.roofBlue, C.roofTeal, C.roofOrange, C.roofCoral, C.roofGreen];
export const WALL_VARIANTS = [C.wall, C.wallWarm, C.wallButter, C.wallWhite, C.wallBlush];
export const FLOWER_COLORS = [C.flowerRed, C.flowerPink, C.flowerYellow, C.flowerWhite, C.flowerBlue, C.flowerPurple];

export function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

export function cssHex(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

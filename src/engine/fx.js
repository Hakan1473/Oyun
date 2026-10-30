// Parçacıklar: alev, kıvılcım, duman, toz, yonga, kara sis — iki çizim çağrısında
// (biri toplamalı: ateş ve ışıltı; biri normal: duman ve toz).

import * as THREE from 'three';

const MAX = 900;

const vert = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 pcolor;
  attribute float shape;
  attribute float rot;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vShape;
  varying float vRot;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uScale;
    vAlpha = alpha;
    vColor = pcolor;
    vShape = shape;
    vRot = rot;
  }
`;

const frag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vShape;
  varying float vRot;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    p.y = -p.y;
    float c = cos(vRot), s = sin(vRot);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float a;
    vec3 col = vColor;
    if (vShape < 0.5) {
      // yumuşak bulut
      float d = length(p);
      a = smoothstep(1.0, 0.1, d);
      col *= 1.0 - 0.25 * (p.y * -0.5 + 0.5);
    } else if (vShape < 1.5) {
      // alev: yukarı incelen damla
      vec2 f = p;
      f.x *= 1.0 + max(0.0, f.y) * 1.4;
      float d = length(f * vec2(1.0, 0.75) + vec2(0.0, 0.15));
      a = smoothstep(1.0, 0.0, d);
      col *= 1.0 + smoothstep(0.6, 0.0, d) * 1.2;
    } else if (vShape < 2.5) {
      // kıvılcım / ışıltı
      float d = length(p);
      a = smoothstep(1.0, 0.0, d);
      a *= a;
    } else {
      // yonga / yaprak
      a = step(abs(q.x), 0.8) * step(abs(q.y), 0.35);
    }
    if (a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(col * a * vAlpha, a * vAlpha);
  }
`;

// renkler parçacık başına değil, bir kez çevrilir
const linCache = new Map();
const lin = (hex, k = 1) => {
  const key = hex * 64 + k;
  let v = linCache.get(key);
  if (!v) {
    const c = new THREE.Color(hex);
    v = [c.r * k, c.g * k, c.b * k];
    linCache.set(key, v);
  }
  return v;
};

class Layer {
  constructor(stage, blending) {
    this.list = [];
    const geo = new THREE.BufferGeometry();
    this.buf = {
      position: new Float32Array(MAX * 3),
      size: new Float32Array(MAX),
      alpha: new Float32Array(MAX),
      pcolor: new Float32Array(MAX * 3),
      shape: new Float32Array(MAX),
      rot: new Float32Array(MAX),
    };
    for (const [k, arr] of Object.entries(this.buf)) {
      geo.setAttribute(k, new THREE.BufferAttribute(arr, k === 'position' || k === 'pcolor' ? 3 : 1).setUsage(THREE.DynamicDrawUsage));
    }
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: blending === 'add' ? THREE.AdditiveBlending : THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    if (blending === 'add') {
      this.material.blending = THREE.CustomBlending;
      this.material.blendSrc = THREE.OneFactor;
      this.material.blendDst = THREE.OneFactor;
    }
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = blending === 'add' ? 12 : 10;
    this.geo = geo;
    stage.scene.add(this.points);
  }

  spawn(p) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      x: p.x, y: p.y, z: p.z,
      vx: p.vx ?? 0, vy: p.vy ?? 0, vz: p.vz ?? 0,
      g: p.g ?? 0, drag: p.drag ?? 0, life: 0, max: p.life ?? 1,
      s0: p.s0 ?? 0.3, s1: p.s1 ?? p.s0 ?? 0.3, a0: p.a0 ?? 1, fadeIn: p.fadeIn ?? 0.1,
      c0: p.c0, c1: p.c1 ?? p.c0,
      shape: p.shape ?? 0, rot: p.rot ?? Math.random() * 6.28, spin: p.spin ?? 0,
      floor: p.floor ?? -Infinity, wob: p.wob ?? 0, ph: Math.random() * 6.28,
    });
  }

  update(dt, scale, t) {
    this.material.uniforms.uScale.value = scale;
    const L = this.list;
    const b = this.buf;
    let n = 0;
    for (let k = 0; k < L.length; k++) {
      const p = L[k];
      p.life += dt;
      if (p.life >= p.max) continue;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.g * dt;
      p.vz *= damp;
      p.x += (p.vx + (p.wob ? Math.sin(t * 6 + p.ph) * p.wob : 0)) * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < p.floor) {
        p.y = p.floor;
        p.vy = 0;
        p.vx *= 0.4;
        p.vz *= 0.4;
        p.spin *= 0.7;
      }
      p.rot += p.spin * dt;
      const u = p.life / p.max;
      L[n] = p;
      b.position[n * 3] = p.x;
      b.position[n * 3 + 1] = p.y;
      b.position[n * 3 + 2] = p.z;
      b.size[n] = p.s0 + (p.s1 - p.s0) * u;
      const fin = Math.min(1, p.life / Math.max(0.001, p.fadeIn));
      b.alpha[n] = p.a0 * fin * (u > 0.55 ? 1 - (u - 0.55) / 0.45 : 1);
      b.pcolor[n * 3] = p.c0[0] + (p.c1[0] - p.c0[0]) * u;
      b.pcolor[n * 3 + 1] = p.c0[1] + (p.c1[1] - p.c0[1]) * u;
      b.pcolor[n * 3 + 2] = p.c0[2] + (p.c1[2] - p.c0[2]) * u;
      b.shape[n] = p.shape;
      b.rot[n] = p.rot;
      n++;
    }
    L.length = n;
    this.geo.setDrawRange(0, n);
    for (const name of Object.keys(b)) {
      const attr = this.geo.attributes[name];
      attr.needsUpdate = true;
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, n * attr.itemSize);
    }
  }
}

export class FX {
  constructor(stage) {
    this.stage = stage;
    this.add = new Layer(stage, 'add');
    this.alpha = new Layer(stage, 'alpha');
  }

  flame(x, y, z, size = 1) {
    this.add.spawn({
      x: x + (Math.random() - 0.5) * 0.18 * size, y, z: z + (Math.random() - 0.5) * 0.18 * size,
      vx: (Math.random() - 0.5) * 0.1, vy: 0.9 + Math.random() * 0.6 * size, vz: (Math.random() - 0.5) * 0.1,
      drag: 1.2, life: 0.45 + Math.random() * 0.35, s0: 0.42 * size, s1: 0.08 * size, a0: 0.9,
      c0: lin(0xffc060, 3.2), c1: lin(0xff3a08, 1.6), shape: 1, fadeIn: 0.06, wob: 0.15,
    });
  }

  ember(x, y, z) {
    this.add.spawn({
      x, y, z, vx: (Math.random() - 0.5) * 0.5, vy: 1.2 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 0.5,
      g: -0.25, drag: 0.6, life: 1.2 + Math.random() * 1.4, s0: 0.06, s1: 0.025, a0: 1,
      c0: lin(0xffb050, 6), c1: lin(0xff4010, 3), shape: 2, fadeIn: 0.02, wob: 0.5,
    });
  }

  smoke(x, y, z, { scale = 1, dark = false } = {}) {
    this.alpha.spawn({
      x: x + (Math.random() - 0.5) * 0.1, y, z: z + (Math.random() - 0.5) * 0.1,
      vx: 0.06 + Math.random() * 0.05, vy: 0.35 + Math.random() * 0.15, vz: -0.03,
      drag: 0.35, life: 3 + Math.random() * 1.2, s0: 0.2 * scale, s1: 0.95 * scale, a0: dark ? 0.5 : 0.28,
      c0: lin(dark ? 0x1a1a1a : 0x8a8c8a), c1: lin(dark ? 0x101010 : 0x6c706e), shape: 0, fadeIn: 0.3,
    });
  }

  dust(x, z, radius = 1, count = 16, color = 0x6a5c4a) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const r = radius * (0.6 + Math.random() * 0.5);
      this.alpha.spawn({
        x: x + Math.cos(a) * r, y: 0.12, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * 1.1, vy: 0.4 + Math.random() * 0.4, vz: Math.sin(a) * 1.1,
        drag: 2.4, life: 1 + Math.random() * 0.5, s0: 0.35, s1: 0.9, a0: 0.45,
        c0: lin(color), c1: lin(color, 0.8), shape: 0, fadeIn: 0.03,
      });
    }
  }

  chips(x, y, z, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 1.4;
      this.alpha.spawn({
        x, y, z, vx: Math.cos(a) * sp, vy: 1.4 + Math.random() * 1.6, vz: Math.sin(a) * sp,
        g: -7, drag: 0.8, life: 0.9 + Math.random() * 0.4, s0: 0.07, s1: 0.06, a0: 1,
        c0: lin(0xd8b888), c1: lin(0xa88858), shape: 3, spin: (Math.random() - 0.5) * 16, floor: 0.02, fadeIn: 0.01,
      });
    }
  }

  leaves(x, y, z, count = 20) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.6;
      this.alpha.spawn({
        x: x + (Math.random() - 0.5), y: y + Math.random() * 1.5, z: z + (Math.random() - 0.5),
        vx: Math.cos(a) * sp, vy: 0.5 + Math.random(), vz: Math.sin(a) * sp,
        g: -2.5, drag: 1.6, life: 2 + Math.random(), s0: 0.1, s1: 0.09, a0: 1,
        c0: lin(Math.random() < 0.5 ? 0x2e4a26 : 0x5a5a2a), c1: lin(0x3a3a22), shape: 3, spin: (Math.random() - 0.5) * 8, floor: 0.02, fadeIn: 0.01, wob: 0.6,
      });
    }
  }

  // Gölge varlığının çevresindeki kara duman; ölünce dağılması
  shade(x, y, z, k = 1) {
    this.alpha.spawn({
      x: x + (Math.random() - 0.5) * 0.4, y, z: z + (Math.random() - 0.5) * 0.4,
      vx: (Math.random() - 0.5) * 0.3, vy: 0.2 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.3,
      drag: 0.8, life: 1.2 + Math.random(), s0: 0.3 * k, s1: 0.8 * k, a0: 0.55,
      c0: [0.006, 0.006, 0.008], c1: [0.002, 0.002, 0.003], shape: 0, fadeIn: 0.15,
    });
  }

  burst(x, y, z, count = 40) {
    for (let i = 0; i < count; i++) this.shade(x, y + Math.random() * 2, z, 1.4);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add.spawn({
        x, y: y + 1.5, z, vx: Math.cos(a) * 2, vy: Math.random() * 2, vz: Math.sin(a) * 2, drag: 2, life: 0.8,
        s0: 0.12, s1: 0.02, a0: 1, c0: lin(0xbfd4ff, 4), c1: lin(0x4060a0, 1), shape: 2, fadeIn: 0.01,
      });
    }
  }

  blood(x, y, z) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.alpha.spawn({
        x, y, z, vx: Math.cos(a) * 1.2, vy: 1 + Math.random(), vz: Math.sin(a) * 1.2, g: -8, drag: 1, life: 0.8,
        s0: 0.08, s1: 0.06, a0: 1, c0: lin(0x5a0606), c1: lin(0x2a0202), shape: 0, floor: 0.02, fadeIn: 0.01,
      });
    }
  }

  update(dt, ppu, dpr, t) {
    const s = ppu * dpr;
    this.add.update(dt, s, t);
    this.alpha.update(dt, s, t);
  }
}

// Parçacıklar: baca dumanı, toz, kıvılcım, yaprak, konfeti — hepsi tek çizim çağrısında.

import * as THREE from 'three';

const MAX = 700;

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
    float c = cos(vRot), s = sin(vRot);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float a;
    vec3 col = vColor;
    if (vShape < 0.5) {
      float d = length(p);
      a = smoothstep(1.0, 0.15, d);
      col *= 1.0 - 0.18 * (p.y + 0.4);   // üstten aydınlık bulut
    } else if (vShape < 1.5) {
      float d = pow(abs(q.x), 0.55) + pow(abs(q.y), 0.55);
      a = smoothstep(1.15, 0.75, d);
      col = mix(col, vec3(1.0), smoothstep(0.6, 0.0, length(p)) * 0.8);
    } else {
      a = step(abs(q.x), 0.75) * step(abs(q.y), 0.42);
    }
    if (a * vAlpha < 0.02) discard;
    gl_FragColor = vec4(col, a * vAlpha);
  }
`;

function rgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export class FX {
  constructor(stage) {
    this.stage = stage;
    this.list = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.color = new Float32Array(MAX * 3);
    this.shape = new Float32Array(MAX);
    this.rot = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.geo = geo;
    stage.scene.add(this.points);
  }

  spawn(p) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      x: p.x, y: p.y, z: p.z,
      vx: p.vx ?? 0, vy: p.vy ?? 0, vz: p.vz ?? 0,
      g: p.g ?? 0,
      drag: p.drag ?? 0,
      life: 0,
      max: p.life ?? 1,
      s0: p.s0 ?? 0.3,
      s1: p.s1 ?? p.s0 ?? 0.3,
      a0: p.a0 ?? 1,
      fadeIn: p.fadeIn ?? 0.1,
      c: rgb(p.color ?? 0xffffff),
      shape: p.shape ?? 0,
      rot: p.rot ?? Math.random() * 6.28,
      spin: p.spin ?? 0,
      floor: p.floor ?? -Infinity,
    });
  }

  smoke(x, y, z, scale = 1) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 0.05, y, z: z + (Math.random() - 0.5) * 0.05,
      vx: 0.05 + Math.random() * 0.06, vy: 0.38 + Math.random() * 0.12, vz: -0.03,
      drag: 0.4, life: 2.6 + Math.random(), s0: 0.14 * scale, s1: 0.55 * scale, a0: 0.65,
      color: 0xf4f1ee, shape: 0, fadeIn: 0.15,
    });
  }

  dust(x, z, radius = 1, count = 16) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const r = radius * (0.7 + Math.random() * 0.4);
      this.spawn({
        x: x + Math.cos(a) * r, y: 0.12, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * 1.1, vy: 0.5 + Math.random() * 0.5, vz: Math.sin(a) * 1.1,
        drag: 2.6, life: 0.9 + Math.random() * 0.4, s0: 0.3, s1: 0.75, a0: 0.75,
        color: 0xeadcc4, shape: 0, fadeIn: 0.02,
      });
    }
  }

  sparkle(x, y, z, count = 22, color = 0xffd34d) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 1.6;
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * sp, vy: 2.2 + Math.random() * 2.2, vz: Math.sin(a) * sp,
        g: -6, drag: 0.6, life: 0.9 + Math.random() * 0.6, s0: 0.24, s1: 0.04, a0: 1,
        color: Math.random() < 0.3 ? 0xffffff : color, shape: 1, spin: (Math.random() - 0.5) * 6, fadeIn: 0.01,
      });
    }
  }

  leaves(x, y, z, count = 18, color = 0x6dbb45) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 1.4;
      this.spawn({
        x, y: y + Math.random() * 0.4, z,
        vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 1.8, vz: Math.sin(a) * sp,
        g: -5, drag: 1.2, life: 1.3 + Math.random() * 0.6, s0: 0.16, s1: 0.12, a0: 1,
        color: Math.random() < 0.5 ? color : 0x4c9a33, shape: 2, spin: (Math.random() - 0.5) * 10,
        floor: 0.03, fadeIn: 0.01,
      });
    }
  }

  confetti(x, y, z, count = 70) {
    const colors = [0xff5a6a, 0xffd640, 0x3f84de, 0x5ac46a, 0xb68cff, 0xff97c0];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.6;
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * sp, vy: 4 + Math.random() * 3, vz: Math.sin(a) * sp,
        g: -7, drag: 1.4, life: 2 + Math.random(), s0: 0.2, s1: 0.18, a0: 1,
        color: colors[i % colors.length], shape: 2, spin: (Math.random() - 0.5) * 14, floor: 0.03, fadeIn: 0.01,
      });
    }
  }

  update(dt, ppu, dpr) {
    this.material.uniforms.uScale.value = ppu * dpr;
    const L = this.list;
    let n = 0;
    for (let k = 0; k < L.length; k++) {
      const p = L[k];
      p.life += dt;
      if (p.life >= p.max) continue;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.g * dt;
      p.vz *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < p.floor) {
        p.y = p.floor;
        p.vy = 0;
        p.vx *= 0.5;
        p.vz *= 0.5;
        p.spin *= 0.8;
      }
      p.rot += p.spin * dt;
      const t = p.life / p.max;
      L[n++] = p;
      const i = n - 1;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.size[i] = p.s0 + (p.s1 - p.s0) * t;
      const fin = Math.min(1, p.life / Math.max(0.001, p.fadeIn));
      this.alpha[i] = p.a0 * fin * (t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1);
      this.color[i * 3] = p.c[0];
      this.color[i * 3 + 1] = p.c[1];
      this.color[i * 3 + 2] = p.c[2];
      this.shape[i] = p.shape;
      this.rot[i] = p.rot;
    }
    L.length = n;
    this.geo.setDrawRange(0, n);
    for (const name of ['position', 'size', 'alpha', 'pcolor', 'shape', 'rot']) {
      const attr = this.geo.attributes[name];
      attr.needsUpdate = true;
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, n * attr.itemSize);
    }
  }
}

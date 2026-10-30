// Zemin: orman toprağı + patika toprağı + açıklık maskesi tek gölgelendiricide karışır.
// Üstünde rüzgârda salınan çimen, eğreltiler, kayalar, devrik kütükler, gece parlayan mantarlar.

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';
import { MAT } from '../engine/materials.js';
import { mulberry32 } from '../core/rng.js';
import { PATHS, CLEARING, pathDistance } from './layout.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const NOISE_GLSL = /* glsl */ `
  float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float gn(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(gh(i), gh(i + vec2(1.0, 0.0)), f.x), mix(gh(i + vec2(0.0, 1.0)), gh(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

export class Ground {
  constructor(stage, cfg, T) {
    this.stage = stage;
    this.half = cfg.grid.size / 2 + cfg.grid.border;
    this.T = T;
    this.time = { value: 0 };
    this.#mask();
    this.#mesh();
  }

  // R: patika, G: açıklık (açık alan), B: nem/koyuluk
  #mask() {
    const S = 1024;
    const H = this.half;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const k = S / (H * 2);
    const px = (x) => (x + H) * k;
    this.maskCanvas = cv;
    this.maskK = k;
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    // açıklık
    g.globalCompositeOperation = 'lighter';
    const grd = g.createRadialGradient(px(CLEARING.x), px(CLEARING.z), 0, px(CLEARING.x), px(CLEARING.z), CLEARING.r * 1.5 * k);
    grd.addColorStop(0, 'rgb(0,235,0)');
    grd.addColorStop(0.6, 'rgb(0,170,0)');
    grd.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    // patikalar (kenarları bulanık, gürültülü)
    const rng = mulberry32(5);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const p of PATHS) {
      for (const [w, blur, col] of [[p.width * 1.9, 1.4, 'rgb(70,40,0)'], [p.width, 0.5, 'rgb(190,30,0)']]) {
        g.save();
        g.filter = `blur(${blur * k}px)`;
        g.strokeStyle = col;
        g.lineWidth = w * k;
        g.beginPath();
        p.samples.forEach((s, i) => {
          const j = (rng() - 0.5) * 0.25 * k;
          if (i === 0) g.moveTo(px(s.x) + j, px(s.z) + j);
          else g.lineTo(px(s.x) + j, px(s.z) + j);
        });
        g.stroke();
        g.restore();
      }
    }
    // patika üzerindeki tekerlek izi benzeri iki ince koyu çizgi yok; yerine ayak izi lekeleri
    g.globalCompositeOperation = 'source-over';
    this.maskTex = new THREE.CanvasTexture(cv);
    this.maskTex.colorSpace = THREE.NoColorSpace;
    this.maskTex.minFilter = THREE.LinearFilter;
    this.maskTex.generateMipmaps = false;
  }

  // Ağaç kesilince açıklık büyür
  openArea(x, z, r = 1.6) {
    const g = this.maskCanvas.getContext('2d');
    const k = this.maskK;
    const H = this.half;
    g.globalCompositeOperation = 'lighter';
    const grd = g.createRadialGradient((x + H) * k, (z + H) * k, 0, (x + H) * k, (z + H) * k, r * k);
    grd.addColorStop(0, 'rgb(0,110,0)');
    grd.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = grd;
    g.fillRect((x + H - r) * k, (z + H - r) * k, r * 2 * k, r * 2 * k);
    g.globalCompositeOperation = 'source-over';
    this.maskTex.needsUpdate = true;
  }

  sampleMask(x, z) {
    if (!this._maskData) this._maskData = this.maskCanvas.getContext('2d').getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height).data;
    const S = this.maskCanvas.width;
    const i = Math.min(S - 1, Math.max(0, Math.floor((x + this.half) * this.maskK)));
    const j = Math.min(S - 1, Math.max(0, Math.floor((z + this.half) * this.maskK)));
    const o = (j * S + i) * 4;
    const d = this._maskData;
    return { path: d[o] / 255, open: d[o + 1] / 255 };
  }

  #mesh() {
    const H = this.half;
    const geo = new THREE.PlaneGeometry(H * 2, H * 2, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: this.T.floor, roughness: 0.97, metalness: 0 });
    const uniforms = {
      tMask: { value: this.maskTex },
      tDirt: { value: this.T.dirt },
      uHalf: { value: H },
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vWorldP;\nuniform sampler2D tMask;\nuniform sampler2D tDirt;\nuniform float uHalf;\n${NOISE_GLSL}`)
        .replace('#include <map_fragment>', /* glsl */ `
          vec2 wuv = vWorldP.xz;
          vec2 muv = vec2((wuv.x + uHalf) / (2.0 * uHalf), 1.0 - (wuv.y + uHalf) / (2.0 * uHalf));
          vec3 mk = texture2D(tMask, muv).rgb;
          float n1 = gn(wuv * 0.09);
          float n2 = gn(wuv * 0.9 + 7.3);
          vec3 f1 = texture2D(map, wuv / 4.4).rgb;
          vec3 f2 = texture2D(map, wuv / 10.7 + vec2(0.37, 0.61)).rgb;
          vec3 fl = mix(f1, f2, 0.25 + 0.5 * n1);
          vec3 dt = texture2D(tDirt, wuv / 2.6).rgb;
          float pathK = smoothstep(0.22, 0.62, mk.r + (n2 - 0.5) * 0.3);
          vec3 c = mix(fl, dt, pathK);
          float open = mk.g;
          c *= mix(0.62, 1.0, open);
          c = mix(c, c * vec3(0.92, 1.05, 0.86), open * (1.0 - pathK) * 0.45);
          c *= 0.9 + n1 * 0.2;
          diffuseColor.rgb *= c;
        `);
    };
    mat.customProgramCacheKey = () => 'ground-v1';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.stage.scene.add(mesh);
    this.mesh = mesh;
  }
}

// --- çimen -------------------------------------------------------------------------------

function grassClump(rng) {
  const pos = [];
  const col = [];
  const nor = [];
  const idx = [];
  const blades = 9;
  for (let b = 0; b < blades; b++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 0.18;
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const h = 0.16 + rng() * 0.24;
    const w = 0.022 + rng() * 0.016;
    const lean = 0.08 + rng() * 0.16;
    const ld = rng() * Math.PI * 2;
    const segs = 4;
    const base = pos.length / 3;
    const tone = rng();
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const ww = w * (1 - t * 0.92);
      const off = lean * t * t;
      const cx = bx + Math.cos(ld) * off;
      const cz = bz + Math.sin(ld) * off;
      const px = -Math.sin(ld) * ww;
      const pz = Math.cos(ld) * ww;
      pos.push(cx - px, h * t, cz - pz, cx + px, h * t, cz + pz);
      const k = 0.3 + t * 0.7;
      const c = [(0.11 + tone * 0.07) * k, (0.14 + tone * 0.05) * k, (0.06 + tone * 0.02) * k];
      col.push(...c, ...c);
      nor.push(Math.cos(ld) * 0.3, 1, Math.sin(ld) * 0.3, Math.cos(ld) * 0.3, 1, Math.sin(ld) * 0.3);
      if (s < segs) {
        const q = base + s * 2;
        idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function windMaterial(base, time, amount = 0.08) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', /* glsl */ `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float hk = max(0.0, position.y);
        float sw = sin(uTime * 1.7 + ip.x * 0.45 + ip.z * 0.3) * 0.6 + sin(uTime * 3.1 + ip.x * 1.3) * 0.25;
        transformed.x += sw * ${amount.toFixed(3)} * hk * hk * 4.0;
        transformed.z += sw * ${(amount * 0.6).toFixed(3)} * hk * hk * 4.0;
      `);
  };
  m.customProgramCacheKey = () => `wind-${amount}-${base.uuid}`;
  return m;
}

export class Flora {
  constructor(stage, cfg, ground, quality) {
    this.stage = stage;
    this.ground = ground;
    this.N = cfg.grid.size;
    this.half = ground.half;
    this.time = ground.time;
    this.sets = [];
    const rng = mulberry32(77);
    const dense = quality === 'high' ? 1 : quality === 'medium' ? 0.7 : 0.45;

    const grassMat = windMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }), this.time, 0.09);
    const clump = grassClump(rng);
    this.grass = this.#scatter(clump, grassMat, Math.round(2600 * dense), (x, z, m) => {
      if (m.path > 0.55) return 0;
      return 0.12 + m.open * 0.9 - m.path * 0.6;
    }, { scale: [0.7, 1.35], hideable: true });

    // Eğreltiler: 6 kartlık rozet
    const fernKit = new Kit();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng() * 0.3;
      fernKit.add(new THREE.PlaneGeometry(0.42, 0.9).translate(0, 0.45, 0), 0xffffff, {
        mat: 'fern', uv: 'native', ry: a, rx: -0.95 - rng() * 0.3, order: 'YXZ',
      });
    }
    const fernGeo = fernKit.geometry('fern');
    const fernMat = windMaterial(MAT.fern, this.time, 0.05);
    this.ferns = this.#scatter(fernGeo, fernMat, Math.round(900 * dense), (x, z, m) => (m.path > 0.3 ? 0 : 0.15 + (1 - m.open) * 0.6), { scale: [0.6, 1.3], hideable: true, shadow: false });

    // Kayalar
    const rockKit = new Kit();
    rockKit.rock(0.42, 0xffffff, { seed: 3, squash: 0.55 });
    rockKit.rock(0.22, 0xd8d8d0, { seed: 5, x: 0.42, z: 0.16, squash: 0.6 });
    this.rocks = this.#scatter(rockKit.geometry('rock'), MAT.rock, 90, (x, z, m) => (m.path > 0.3 ? 0 : 0.35 + (1 - m.open) * 0.2), { scale: [0.6, 1.8], hideable: true, shadow: true, avoidGrid: false });

    // Devrik kütükler (yosunlu)
    const logKit = new Kit();
    logKit.log(2.6, 0.22, { y: 0.18, color: 0xb8b0a0 });
    logKit.cyl(0.05, 0.03, 0.6, 6, 0xffffff, { mat: 'bark', uv: 'native', x: 0.4, y: 0.4, z: 0.1, rz: 0.9 });
    this.logs = this.#scatterKit(logKit, 26, (x, z, m) => (m.path > 0.2 || m.open > 0.5 ? 0 : 0.5), { scale: [0.8, 1.2], shadow: true, avoidGrid: true });

    // Gece hafifçe parlayan mantarlar
    const mushKit = new Kit();
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * 0.18;
      const h = 0.05 + rng() * 0.08;
      mushKit.cyl(0.012, 0.016, h, 8, 0xd8d6c8, { x: Math.cos(a) * r, y: h / 2, z: Math.sin(a) * r });
      mushKit.dome(0.03 + rng() * 0.025, 0x9fe8ff, { mat: 'cold', x: Math.cos(a) * r, y: h, z: Math.sin(a) * r, sy: 0.6 });
    }
    this.mushrooms = this.#scatterKit(mushKit, Math.round(140 * dense), (x, z, m) => (m.path > 0.3 ? 0 : 0.2 + (1 - m.open) * 0.6), { scale: [0.8, 1.6], shadow: false, avoidGrid: false });
  }

  #scatter(geo, mat, count, weight, { scale = [1, 1], hideable = false, shadow = false, avoidGrid = false } = {}) {
    const rng = mulberry32(count * 13 + 7);
    const list = [];
    let guard = 0;
    while (list.length < count && guard++ < count * 40) {
      const x = (rng() - 0.5) * this.half * 1.5;
      const z = (rng() - 0.5) * this.half * 1.5;
      if (avoidGrid && Math.abs(x) < this.N / 2 + 1 && Math.abs(z) < this.N / 2 + 1) continue;
      const m = this.ground.sampleMask(x, z);
      if (rng() > weight(x, z, m)) continue;
      list.push({ x, z, s: scale[0] + rng() * (scale[1] - scale[0]), r: rng() * Math.PI * 2 });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const d = new THREE.Object3D();
    const base = [];
    list.forEach((it, n) => {
      d.position.set(it.x, 0, it.z);
      d.rotation.set(0, it.r, 0);
      d.scale.setScalar(it.s);
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      base.push(d.matrix.clone());
    });
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    this.stage.scene.add(mesh);
    const set = { mesh, list, base, hideable };
    this.sets.push(set);
    return set;
  }

  #scatterKit(kit, count, weight, opts) {
    // Çok malzemeli kit için her malzemeye ayrı örnekli ağ
    const out = [];
    const seed = count * 31;
    for (const key of kit.slots.keys()) {
      const geo = kit.geometry(key);
      const rngState = seed;
      out.push(this.#scatterSeeded(geo, MAT[key], count, weight, opts, rngState));
    }
    return out;
  }

  #scatterSeeded(geo, mat, count, weight, opts, seed) {
    // Aynı tohum → farklı malzemeler aynı yerlere düşer
    const rng = mulberry32(seed);
    const list = [];
    let guard = 0;
    while (list.length < count && guard++ < count * 60) {
      const x = (rng() - 0.5) * this.half * 1.6;
      const z = (rng() - 0.5) * this.half * 1.6;
      const r1 = rng();
      const s = opts.scale[0] + rng() * (opts.scale[1] - opts.scale[0]);
      const rot = rng() * Math.PI * 2;
      if (opts.avoidGrid && Math.abs(x) < this.N / 2 + 1 && Math.abs(z) < this.N / 2 + 1) continue;
      const m = this.ground.sampleMask(x, z);
      if (r1 > weight(x, z, m)) continue;
      list.push({ x, z, s, r: rot });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const d = new THREE.Object3D();
    const base = [];
    list.forEach((it, n) => {
      d.position.set(it.x, 0, it.z);
      d.rotation.set(0, it.r, 0);
      d.scale.setScalar(it.s);
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      base.push(d.matrix.clone());
    });
    mesh.castShadow = !!opts.shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    this.stage.scene.add(mesh);
    const set = { mesh, list, base, hideable: !opts.avoidGrid };
    this.sets.push(set);
    return set;
  }

  // Dolu karolardaki bitkileri gizle
  sync(grid) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const set of this.sets) {
      if (!set.hideable) continue;
      let changed = false;
      set.list.forEach((it, n) => {
        const t = grid.tileAt(it.x, it.z);
        const occ = grid.inside(t.i, t.j) && grid.at(t.i, t.j) > 0;
        if (occ !== !!it.hidden) {
          it.hidden = occ;
          set.mesh.setMatrixAt(n, occ ? zero : set.base[n]);
          changed = true;
        }
      });
      if (changed) set.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(dt) {
    this.time.value += dt;
  }
}

export { pathDistance, smooth };

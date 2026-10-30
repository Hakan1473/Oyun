// Prosedürel iskeletler: insan ve gölge varlığı. Her uzuv ayrı bir ağdır; animasyon
// eklem açılarıyla kodda yapılır (yürüme, balta, korku, topallama, ölüm).

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';
import { MAT } from '../engine/materials.js';

const xray = new THREE.MeshBasicMaterial({
  color: 0x6a7c90, transparent: true, opacity: 0.22, depthFunc: THREE.GreaterDepth, depthWrite: false,
  // kendi yüzeyiyle çakışmasın: siluet yalnızca gerçekten bir şeyin arkasındayken görünür
  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -40,
});

function part(build, { xr = true } = {}) {
  const k = new Kit();
  build(k);
  const g = new THREE.Group();
  const mesh = k.build();
  mesh.castShadow = false;
  g.add(mesh);
  if (xr) {
    const x = new THREE.Mesh(mesh.geometry, xray);
    x.renderOrder = 20;
    g.add(x);
  }
  return g;
}

export class HumanRig {
  constructor(look) {
    const L = look;
    this.root = new THREE.Group();
    this.hips = new THREE.Group();
    this.hips.position.y = 0.9;
    this.root.add(this.hips);
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    this.torso.add(part((k) => {
      k.capsule(0.15, 0.32, L.jacket, { mat: 'cloth', y: 0.27, sx: 1.18, sz: 0.78, uv: 'native', uvRepeat: [2, 2] });
      k.box(0.32, 0.12, 0.2, L.pants, { mat: 'cloth', y: 0.02, r: 0.05 });
      if (L.hood) k.torus(0.1, 0.045, L.jacket, { mat: 'cloth', y: 0.56, z: -0.05, rx: 1.2 });
      else k.cyl(0.07, 0.08, 0.08, 12, L.jacket, { mat: 'cloth', y: 0.56 });
      if (L.pack) {
        k.box(0.3, 0.38, 0.16, 0x3c3a30, { mat: 'cloth', y: 0.3, z: -0.17, r: 0.05 });
        k.cyl(0.05, 0.05, 0.3, 10, 0x2a3a2a, { mat: 'cloth', y: 0.5, z: -0.17, rz: Math.PI / 2 });
      }
    }));
    this.head = new THREE.Group();
    this.head.position.y = 0.66;
    this.torso.add(this.head);
    this.head.add(part((k) => {
      k.sphere(0.112, L.skin, { y: 0.02, sy: 1.1, sz: 0.96 });
      k.sphere(0.07, L.skin, { y: -0.045, z: 0.03, sx: 1.05, sy: 0.8 });
      // göz çukuru gölgesi, gözler, kaşlar
      for (const sx of [-1, 1]) {
        k.sphere(0.026, 0x3a2620, { x: sx * 0.041, y: 0.036, z: 0.088, sy: 0.7, ws: 10, hs: 8 });
        k.sphere(0.014, 0xe8e4dc, { x: sx * 0.041, y: 0.036, z: 0.1, ws: 10, hs: 8 });
        k.sphere(0.0085, 0x15100c, { x: sx * 0.041, y: 0.036, z: 0.111, ws: 8, hs: 6 });
        k.box(0.036, 0.009, 0.012, L.hair, { x: sx * 0.042, y: 0.068, z: 0.104, rz: sx * -0.12, r: 0.004 });
        k.sphere(0.022, L.skin, { x: sx * 0.111, y: 0.015, z: -0.005, sx: 0.45, ws: 10, hs: 8 });
      }
      k.capsule(0.013, 0.03, L.skin, { y: 0.006, z: 0.112, rx: 0.25 });
      k.box(0.034, 0.006, 0.01, 0x6a3a32, { y: -0.04, z: 0.1, r: 0.003 });
      if (L.beanie) {
        k.dome(0.122, L.beanie, { mat: 'cloth', y: 0.035 });
        k.cyl(0.123, 0.123, 0.04, 18, L.beanie, { mat: 'cloth', y: 0.045 });
      } else {
        k.dome(0.12, L.hair, { y: 0.03, z: -0.01, sy: 0.95 });
      }
      if (L.hair2 === 'long') k.capsule(0.09, 0.18, L.hair, { y: -0.08, z: -0.07, sx: 1.25, sz: 0.6 });
      if (L.hair2 === 'bob') k.sphere(0.125, L.hair, { y: -0.01, z: -0.03, sy: 0.85, sx: 1.05 });
      if (L.hood) k.dome(0.15, L.jacket, { mat: 'cloth', y: -0.02, z: -0.04, rx: -0.5, sy: 1.1 });
    }));
    const arm = (s) => {
      const g = new THREE.Group();
      g.position.set(s * 0.21, 0.5, 0);
      g.add(part((k) => {
        k.capsule(0.052, 0.42, L.jacket, { mat: 'cloth', y: -0.27, uv: 'native', uvRepeat: [1, 2] });
        k.sphere(0.045, L.skin, { y: -0.56, ws: 10, hs: 8 });
      }));
      this.torso.add(g);
      return g;
    };
    this.armL = arm(-1);
    this.armR = arm(1);
    const leg = (s) => {
      const g = new THREE.Group();
      g.position.set(s * 0.09, 0, 0);
      g.add(part((k) => {
        k.capsule(0.068, 0.7, L.pants, { mat: 'cloth', y: -0.43, uv: 'native', uvRepeat: [1, 3] });
        k.box(0.1, 0.07, 0.22, L.shoes, { y: -0.87, z: 0.04, r: 0.03 });
      }));
      this.hips.add(g);
      return g;
    };
    this.legL = leg(-1);
    this.legR = leg(1);
    // El feneri ve hüzme
    this.flash = new THREE.Group();
    this.flash.position.set(0, -0.55, 0.06);
    this.armR.add(this.flash);
    this.flash.add(part((k) => {
      k.cyl(0.022, 0.026, 0.16, 10, 0x2a2a2a, { mat: 'metal', rx: Math.PI / 2 });
      k.cyl(0.03, 0.03, 0.02, 10, 0xfff0c8, { mat: 'glow', z: 0.085, rx: Math.PI / 2 });
    }, { xr: false }));
    this.axe = new THREE.Group();
    this.axe.position.set(0, -0.56, 0);
    this.armR.add(this.axe);
    this.axe.add(part((k) => {
      k.cyl(0.018, 0.02, 0.62, 8, 0xa88860, { mat: 'wood', y: -0.18 });
      k.box(0.03, 0.12, 0.17, 0x6a6a6a, { mat: 'metal', y: -0.46, z: 0.07 });
    }, { xr: false }));
    this.axe.visible = false;
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75).rotateX(-Math.PI / 2), null);
    this.phase = Math.random() * 6;
  }

  setTool(tool) {
    this.axe.visible = tool === 'axe' || tool === 'hammer';
    this.axe.scale.setScalar(tool === 'hammer' ? 0.6 : 1);
  }

  // Poz: m = { walk(0..1 hız), work: 'chop'|'build'|null, scared, hurt, dead(0..1), aim (açı farkı), t }
  pose(dt, m) {
    const s = m.walk ?? 0;
    this.phase += dt * (5 + s * 6.5) * (m.hurt ? 0.7 : 1);
    const p = this.phase;
    const sw = Math.sin(p) * 0.55 * s;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.8;
    this.armR.rotation.x = sw * 0.8;
    this.armL.rotation.z = -0.08;
    this.armR.rotation.z = 0.08;
    this.hips.position.y = 0.9 + Math.abs(Math.cos(p)) * 0.035 * s - (m.hurt ? 0.05 : 0);
    this.torso.rotation.x = 0.06 * s + (m.hurt ? 0.25 : 0) + (m.scared ? 0.28 : 0);
    this.torso.rotation.z = Math.sin(p) * 0.03 * s;
    this.head.rotation.set(m.scared ? -0.2 : 0, m.look ?? 0, 0);
    if (s < 0.05 && !m.work) {
      // nefes
      this.torso.rotation.x += Math.sin(m.t * 1.6) * 0.02;
      this.armL.rotation.z = -0.1 - Math.sin(m.t * 1.6) * 0.02;
    }
    if (m.work === 'chop' || m.work === 'build') {
      const k = m.work === 'chop' ? 4.2 : 6.5;
      const c = Math.sin(m.t * k);
      const up = Math.max(0, c);
      this.armR.rotation.x = -2.4 * up - 0.3 + Math.max(0, -c) * 0.9;
      this.armL.rotation.x = this.armR.rotation.x * (m.work === 'chop' ? 0.95 : 0.2);
      this.armL.rotation.z = m.work === 'chop' ? 0.25 : -0.1;
      this.torso.rotation.x = 0.15 + Math.max(0, -c) * 0.25;
      this.legL.rotation.x = 0.18;
      this.legR.rotation.x = -0.12;
    }
    if (m.flash) {
      this.armR.rotation.x = -1.35 + (m.aimPitch ?? 0);
      this.armR.rotation.z = 0.05;
    }
    if (m.scared && s < 0.05) {
      this.armL.rotation.x = -0.9;
      this.legL.rotation.x = 0.35;
      this.legR.rotation.x = 0.35;
      this.hips.position.y = 0.8;
    }
    if (m.dead > 0) {
      const d = Math.min(1, m.dead);
      this.root.rotation.x = -d * d * 1.45;
      this.root.position.y = d * 0.12;
      this.armL.rotation.x = -d * 2.2;
      this.armR.rotation.x = -d * 1.8;
    } else {
      this.root.rotation.x = 0;
    }
  }
}

// Gölge: uzun, ince, yüzsüz. Kollar dizlerin altına iner. Yalnızca iki soluk göz parlar.
const shadeMat = () => MAT.shade ?? MAT.plain;
export class ShadeRig {
  constructor(seed = 1) {
    const dark = 0x0a0a0c;
    this.root = new THREE.Group();
    this.hips = new THREE.Group();
    this.hips.position.y = 1.32;
    this.root.add(this.hips);
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const p = (fn) => {
      const k = new Kit();
      fn(k);
      const m = k.build();
      m.castShadow = false;
      m.material = Array.isArray(m.material) ? m.material.map((x) => (x === MAT.glow ? x : shadeMat())) : (m.material === MAT.glow ? m.material : shadeMat());
      const g = new THREE.Group();
      g.add(m);
      return g;
    };
    this.torso.add(p((k) => {
      k.capsule(0.12, 0.62, dark, { y: 0.42, sx: 1.25, sz: 0.7, rx: 0.12 });
      k.capsule(0.06, 0.22, dark, { y: 0.92, z: 0.04, rx: 0.5 });
    }));
    this.head = new THREE.Group();
    this.head.position.set(0, 1.05, 0.12);
    this.torso.add(this.head);
    this.head.add(p((k) => {
      k.sphere(0.1, dark, { y: 0.06, sy: 1.6, sz: 0.85 });
      k.sphere(0.017, 0xd8e8ff, { mat: 'glow', x: -0.038, y: 0.1, z: 0.075, ws: 8, hs: 6 });
      k.sphere(0.017, 0xd8e8ff, { mat: 'glow', x: 0.038, y: 0.1, z: 0.075, ws: 8, hs: 6 });
    }));
    const arm = (s) => {
      const g = new THREE.Group();
      g.position.set(s * 0.2, 0.82, 0);
      g.add(p((k) => {
        k.capsule(0.04, 0.6, dark, { y: -0.36 });
        k.capsule(0.032, 0.62, dark, { y: -1.0, z: 0.05, rx: -0.15 });
        for (let f = 0; f < 4; f++) k.capsule(0.009, 0.16, dark, { x: (f - 1.5) * 0.018, y: -1.42, z: 0.08, rx: -0.3 });
      }));
      this.torso.add(g);
      return g;
    };
    this.armL = arm(-1);
    this.armR = arm(1);
    const leg = (s) => {
      const g = new THREE.Group();
      g.position.set(s * 0.08, 0, 0);
      g.add(p((k) => {
        k.capsule(0.05, 1.1, dark, { y: -0.62 });
      }));
      this.hips.add(g);
      return g;
    };
    this.legL = leg(-1);
    this.legR = leg(1);
    this.phase = seed;
    this.twitch = 0;
  }

  pose(dt, m) {
    const s = m.walk ?? 0;
    this.phase += dt * (2.2 + s * 3.2);
    const p = this.phase;
    const sw = Math.sin(p) * 0.35 * s;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -0.12 + Math.sin(p * 0.5 + 1) * 0.12;
    this.armR.rotation.x = -0.08 + Math.sin(p * 0.5) * 0.14;
    this.armL.rotation.z = -0.06 + Math.sin(p * 0.7) * 0.05;
    this.armR.rotation.z = 0.06 - Math.sin(p * 0.6) * 0.05;
    this.torso.rotation.x = 0.22 + Math.sin(p * 0.5) * 0.04;
    this.torso.rotation.z = Math.sin(p) * 0.06 * s;
    this.twitch -= dt;
    if (this.twitch < 0 && Math.random() < dt * 0.6) this.twitch = 0.25;
    this.head.rotation.z = this.twitch > 0 ? Math.sin(this.twitch * 60) * 0.35 : 0.18;
    if (m.lit > 0) {
      // ışıkta kıvranma: kollar yüzü kapatır
      const k = Math.min(1, m.lit);
      this.armL.rotation.x = -2.2 * k;
      this.armR.rotation.x = -2.0 * k;
      this.armL.rotation.z = 0.4 * k;
      this.armR.rotation.z = -0.4 * k;
      this.torso.rotation.x = 0.5 * k + Math.sin(m.t * 30) * 0.05 * k;
    }
    if (m.attack > 0) {
      const a = Math.sin((1 - m.attack) * Math.PI);
      this.armL.rotation.x = -1.6 * a;
      this.armR.rotation.x = -1.8 * a;
      this.torso.rotation.x = 0.22 + 0.4 * a;
    }
  }
}

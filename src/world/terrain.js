// Arazi: dama desenli çimen, orman kuşağı, nehir, çimen tutamları ve inşa ızgarası.

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';
import { C, cssHex } from '../engine/palette.js';
import { MATERIALS } from '../engine/materials.js';
import { mulberry32 } from '../core/rng.js';
import { roundTree, pineTree, bush, rockPile, flowers, grassTuft } from './nature.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Terrain {
  constructor(stage, cfg) {
    this.stage = stage;
    this.N = cfg.grid.size;
    this.B = cfg.grid.border;
    this.M = this.N + this.B * 2;
    this.rng = mulberry32(7);
    this.time = 0;

    this.river = (z) => -this.N / 2 - this.B * 0.5 + 2.1 * Math.sin(z * 0.16) + 1.3 * Math.sin(z * 0.065 + 1.3);
    this.riverW = (z) => 3.1 + 0.7 * Math.sin(z * 0.27 + 0.4);

    this.#ground();
    this.#water();
    this.#forest();
    this.#meadow();
    this.#gridOverlay();
  }

  inRiver(x, z, pad = 0) {
    return Math.abs(x - this.river(z)) < this.riverW(z) / 2 + pad;
  }

  // --- zemin dokusu --------------------------------------------------------

  #ground() {
    const { N, M } = this;
    const S = 2048;
    const k = S / M; // piksel / birim
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const rng = mulberry32(11);
    const toPx = (w) => (w + M / 2) * k;

    // Taban: dışarı doğru koyulaşan çimen
    g.fillStyle = cssHex(C.grassOuter);
    g.fillRect(0, 0, S, S);
    const fade = 7 * k;
    const edgeCol = cssHex(C.forestFloor);
    for (const [x0, y0, x1, y1] of [[0, 0, fade, 0], [S, 0, S - fade, 0], [0, 0, 0, fade], [0, S, 0, S - fade]]) {
      const grd = g.createLinearGradient(x0, y0, x1, y1);
      grd.addColorStop(0, edgeCol);
      grd.addColorStop(1, 'rgba(79,154,53,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
    }

    // İnşa alanını çevreleyen açık çayır halkası
    const a0 = toPx(-N / 2);
    const a1 = toPx(N / 2);
    g.save();
    g.filter = `blur(${3 * k}px)`;
    g.fillStyle = cssHex(C.grassEdge);
    g.beginPath();
    g.roundRect(a0 - 3 * k, a0 - 3 * k, a1 - a0 + 6 * k, a1 - a0 + 6 * k, 4 * k);
    g.fill();
    g.restore();

    // Nehir kıyısı (kum)
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [col, extra, blur] of [[C.sand, 1.5, 1.2], [0xd9c084, 0.5, 0.5]]) {
      g.filter = `blur(${blur * k}px)`;
      g.strokeStyle = cssHex(col);
      for (let z = -M / 2 - 2; z < M / 2 + 2; z += 0.5) {
        g.lineWidth = (this.riverW(z) + extra * 2) * k;
        g.beginPath();
        g.moveTo(toPx(this.river(z)), toPx(z));
        g.lineTo(toPx(this.river(z + 0.5)), toPx(z + 0.5));
        g.stroke();
      }
    }
    g.restore();

    // Dama desenli inşa alanı
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        g.fillStyle = cssHex((i + j) % 2 ? C.grassA : C.grassB);
        g.fillRect(a0 + i * k, a0 + j * k, k + 0.5, k + 0.5);
      }
    }
    // Alan kenarında yumuşak geçiş
    g.save();
    g.filter = `blur(${1.2 * k}px)`;
    g.strokeStyle = 'rgba(70,140,40,0.35)';
    g.lineWidth = 1.4 * k;
    g.strokeRect(a0, a0, a1 - a0, a1 - a0);
    g.restore();

    // Geniş, yumuşak renk lekeleri: çayırı tekdüzelikten kurtarır
    g.save();
    for (let n = 0; n < 220; n++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = (1.5 + rng() * 4) * k;
      const warm = rng() < 0.5;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const c = warm ? '200,220,90' : '40,110,40';
      const a = warm ? 0.1 + rng() * 0.08 : 0.08 + rng() * 0.08;
      grd.addColorStop(0, `rgba(${c},${a})`);
      grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();

    // Doku: ışık ve gölge benekleri, ince çimen çizgileri
    for (let n = 0; n < 52000; n++) {
      const x = rng() * S;
      const y = rng() * S;
      const light = rng() < 0.5;
      g.fillStyle = light ? `rgba(255,255,200,${0.05 + rng() * 0.07})` : `rgba(30,80,20,${0.05 + rng() * 0.07})`;
      const r = 0.6 + rng() * 2.2;
      g.fillRect(x, y, r, r * (0.6 + rng()));
    }
    g.lineWidth = 1;
    for (let n = 0; n < 14000; n++) {
      const x = rng() * S;
      const y = rng() * S;
      g.strokeStyle = rng() < 0.5 ? 'rgba(190,240,120,0.22)' : 'rgba(40,100,30,0.2)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 3, y - 2 - rng() * 4);
      g.stroke();
    }
    // Birkaç toprak lekesi dış alanda
    for (let n = 0; n < 26; n++) {
      const wx = (rng() - 0.5) * M;
      const wz = (rng() - 0.5) * M;
      if (Math.abs(wx) < N / 2 + 2 && Math.abs(wz) < N / 2 + 2) continue;
      if (this.inRiver(wx, wz, 2)) continue;
      g.save();
      g.filter = `blur(${0.5 * k}px)`;
      g.fillStyle = 'rgba(160,120,70,0.35)';
      g.beginPath();
      g.ellipse(toPx(wx), toPx(wz), (0.6 + rng()) * k, (0.4 + rng() * 0.6) * k, rng() * 3, 0, 6.29);
      g.fill();
      g.restore();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.stage.renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;

    const geo = new THREE.PlaneGeometry(M, M);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }));
    mesh.receiveShadow = true;
    this.stage.scene.add(mesh);
    this.ground = mesh;

    const outerGeo = new THREE.PlaneGeometry(400, 400);
    outerGeo.rotateX(-Math.PI / 2);
    const outer = new THREE.Mesh(outerGeo, new THREE.MeshStandardMaterial({ color: C.forestFloor, roughness: 1 }));
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.stage.scene.add(outer);
  }

  // --- nehir ----------------------------------------------------------------

  #water() {
    const R = this.M / 2 + 12;
    const steps = 160;
    const pos = [];
    const uv = [];
    const idx = [];
    let len = 0;
    let prev = null;
    for (let s = 0; s <= steps; s++) {
      const z = -R + (2 * R * s) / steps;
      const cx = this.river(z);
      const w = this.riverW(z);
      if (prev) len += Math.hypot(cx - prev.x, z - prev.z);
      prev = { x: cx, z };
      pos.push(cx - w / 2, 0.035, z, cx + w / 2, 0.035, z);
      uv.push(0, len / 3, 1, len / 3);
      if (s > 0) {
        const a = (s - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          float edge = min(vUv.x, 1.0 - vUv.x);
          vec3 shallow = vec3(0.47, 0.82, 0.96);
          vec3 deep = vec3(0.18, 0.56, 0.86);
          vec3 col = mix(shallow, deep, smoothstep(0.02, 0.42, edge));
          float w = sin(vUv.y * 5.0 - uTime * 1.5 + sin(vUv.x * 7.0 + uTime * 0.4) * 1.6);
          float w2 = sin(vUv.y * 2.1 + uTime * 0.8 + vUv.x * 5.0);
          col += smoothstep(0.82, 1.0, w * w2) * 0.22;
          float foam = smoothstep(0.07, 0.0, edge - 0.015 * sin(vUv.y * 9.0 + uTime * 2.2));
          col = mix(col, vec3(0.97, 0.99, 1.0), foam * 0.9);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, this.waterMat);
    this.stage.scene.add(mesh);
  }

  // --- orman -----------------------------------------------------------------

  #forest() {
    const { N, M } = this;
    const rng = mulberry32(23);
    const kRound = new Kit();
    kRound.cyl(0.07, 0.11, 0.6, 6, C.trunk, { y: 0.3 });
    kRound.blob(0.46, C.leaf, { y: 0.9, sy: 0.92 });
    kRound.blob(0.32, C.leafLight, { x: 0.16, y: 1.16, z: 0.12 });
    kRound.blob(0.3, C.leafDark, { x: -0.22, y: 0.8, z: -0.14 });
    const kPine = new Kit();
    pineTree(kPine, mulberry32(3));

    const inner = N / 2 + 1.6;
    const R = M / 2 + 9;
    const items = { round: [], pine: [] };
    const step = 1.55;
    for (let x = -R; x <= R; x += step) {
      for (let z = -R; z <= R; z += step) {
        const px = x + (rng() - 0.5) * step * 0.8;
        const pz = z + (rng() - 0.5) * step * 0.8;
        const d = Math.max(Math.abs(px), Math.abs(pz)) - inner;
        if (d < 0) continue;
        if (this.inRiver(px, pz, 0.9)) continue;
        const p = 0.12 + 0.8 * smooth(0, 7, d);
        if (rng() > p) continue;
        const s = 0.85 + rng() * 0.5 + smooth(2, 14, d) * 0.5;
        items[rng() < 0.55 ? 'round' : 'pine'].push({ x: px, z: pz, s, r: rng() * 6.28, t: rng() });
      }
    }

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    const make = (kit, list, tints) => {
      const mesh = new THREE.InstancedMesh(kit.geometry(), MATERIALS[0], list.length);
      list.forEach((it, n) => {
        dummy.position.set(it.x, 0, it.z);
        dummy.rotation.set(0, it.r, 0);
        dummy.scale.setScalar(it.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        tint.setRGB(...tints(it.t));
        mesh.setColorAt(n, tint);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      this.stage.scene.add(mesh);
      return mesh;
    };
    make(kRound, items.round, (t) => [0.9 + t * 0.2, 0.92 + t * 0.12, 0.85 + t * 0.15]);
    make(kPine, items.pine, (t) => [0.85 + t * 0.2, 0.9 + t * 0.15, 0.9 + t * 0.1]);
  }

  // --- çayır: çimen tutamları, çiçekler, kayalar ------------------------------

  #meadow() {
    const { N, M } = this;
    const rng = mulberry32(31);
    const kTuft = new Kit();
    grassTuft(kTuft, rng);
    const kFlower = new Kit();
    flowers(kFlower, rng, { count: 5, radius: 0.28 });
    const kRock = new Kit();
    rockPile(kRock, rng, { s: 0.8 });
    const kBush = new Kit();
    bush(kBush, rng, { s: 1.1, berries: true });

    const dummy = new THREE.Object3D();
    const place = (kit, count, where, scale = [0.8, 1.3], cast = false) => {
      const list = [];
      let guard = 0;
      while (list.length < count && guard++ < count * 30) {
        const x = (rng() - 0.5) * (M - 2);
        const z = (rng() - 0.5) * (M - 2);
        if (!where(x, z)) continue;
        list.push({ x, z });
      }
      const mesh = new THREE.InstancedMesh(kit.geometry(), MATERIALS[0], list.length);
      list.forEach((it, n) => {
        dummy.position.set(it.x, 0, it.z);
        dummy.rotation.set(0, rng() * 6.28, 0);
        dummy.scale.setScalar(scale[0] + rng() * (scale[1] - scale[0]));
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
      });
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      this.stage.scene.add(mesh);
      return { mesh, list, base: list.map((_, n) => {
        const m = new THREE.Matrix4();
        mesh.getMatrixAt(n, m);
        return m;
      }) };
    };

    const inside = (x, z) => Math.abs(x) < N / 2 - 0.3 && Math.abs(z) < N / 2 - 0.3;
    const fringe = (x, z) => !inside(x, z) && Math.max(Math.abs(x), Math.abs(z)) < N / 2 + 5 && !this.inRiver(x, z, 0.4);
    const bank = (x, z) => this.inRiver(x, z, 1.1) && !this.inRiver(x, z, 0.2);

    // İnşa alanındaki tutamlar binaların altında gizlenir
    this.tufts = place(kTuft, 360, inside, [0.75, 1.25]);
    place(kTuft, 420, (x, z) => fringe(x, z) || bank(x, z), [0.9, 1.6]);
    this.innerFlowers = place(kFlower, 40, inside, [0.8, 1.1]);
    place(kFlower, 70, fringe, [0.9, 1.3]);
    place(kRock, 22, (x, z) => fringe(x, z) || bank(x, z), [0.6, 1.2], true);
    place(kBush, 24, fringe, [0.8, 1.2], true);
  }

  // Bir karo dolduğunda üzerindeki tutam/çiçekleri gizle
  syncGrass(grid) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const set of [this.tufts, this.innerFlowers]) {
      set.list.forEach((it, n) => {
        const t = grid.tileAt(it.x, it.z);
        const occupied = grid.at(t.i, t.j) > 0;
        set.mesh.setMatrixAt(n, occupied ? zero : set.base[n]);
      });
      set.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // --- inşa ızgarası (yalnızca yerleştirirken görünür) -------------------------

  #gridOverlay() {
    const { N } = this;
    const px = 32;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N * px;
    const g = cv.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.5;
    for (let i = 0; i <= N; i++) {
      g.beginPath();
      g.moveTo(i * px, 0);
      g.lineTo(i * px, N * px);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * px);
      g.lineTo(N * px, i * px);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(N, N);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, toneMapped: false,
    });
    this.grid = new THREE.Mesh(geo, mat);
    this.grid.position.y = 0.012;
    this.grid.renderOrder = 1;
    this.grid.visible = false;
    this.gridGoal = 0;
    this.stage.scene.add(this.grid);
  }

  showGrid(on) {
    this.gridGoal = on ? 0.42 : 0;
    if (on) this.grid.visible = true;
  }

  update(dt) {
    this.time += dt;
    this.waterMat.uniforms.uTime.value = this.time;
    const m = this.grid.material;
    m.opacity += (this.gridGoal - m.opacity) * Math.min(1, dt * 10);
    if (this.gridGoal === 0 && m.opacity < 0.01) this.grid.visible = false;
  }
}

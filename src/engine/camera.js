// Sabit açılı izometrik kamera: parmakla kaydır, iki parmakla/tekerlekle yakınlaştır.
// Yakınlık "ppu" (dünya birimi başına CSS pikseli) ile ifade edilir; her ekranda aynı his.

import * as THREE from 'three';

const DEG = Math.PI / 180;
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const look = new THREE.Vector3();

export class CameraRig {
  constructor(stage, cfg) {
    this.stage = stage;
    this.camera = stage.camera;
    this.cfg = cfg.camera;
    this.limit = cfg.grid.size / 2 + 4;
    this.worldHalf = cfg.grid.size / 2 + cfg.grid.border;

    const el = this.cfg.elevation * DEG;
    const az = this.cfg.azimuth * DEG;
    this.dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));

    this.target = new THREE.Vector3(0, 0, 0);
    this.ppu = this.cfg.ppu;
    this.ppuGoal = this.ppu;
    this.anchor = null; // yakınlaştırma odağı (ekran koordinatı)
    this.vel = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.panning = null;
    this.tween = null;
    this.shake = 0;
    this.apply();
  }

  get minPpu() {
    // Dünyanın kenarı görünmesin diye en uzak yakınlık ekrana göre sınırlanır.
    const w = this.stage.width;
    const h = this.stage.height;
    const span = this.worldHalf * 2 * 0.98;
    return Math.max(this.cfg.ppuMin, w / span, h / (span * 0.62));
  }

  clampPpu(v) {
    return THREE.MathUtils.clamp(v, this.minPpu, this.cfg.ppuMax);
  }

  apply() {
    const cam = this.camera;
    const hw = this.stage.width / 2 / this.ppu;
    const hh = this.stage.height / 2 / this.ppu;
    cam.left = -hw;
    cam.right = hw;
    cam.top = hh;
    cam.bottom = -hh;
    cam.updateProjectionMatrix();
    look.copy(this.target);
    if (this.shake > 0) {
      look.x += (Math.random() - 0.5) * this.shake;
      look.z += (Math.random() - 0.5) * this.shake;
    }
    cam.position.copy(look).addScaledVector(this.dir, 120);
    cam.lookAt(look);
    cam.updateMatrixWorld();
  }

  ray(x, y) {
    ndc.set((x / this.stage.width) * 2 - 1, -(y / this.stage.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray;
  }

  groundAt(x, y, out = new THREE.Vector3()) {
    return this.ray(x, y).intersectPlane(ground, out) ?? out.set(0, 0, 0);
  }

  worldToScreen(v, out = { x: 0, y: 0, visible: true }) {
    tmp2.copy(v).project(this.camera);
    out.x = (tmp2.x + 1) * 0.5 * this.stage.width;
    out.y = (1 - tmp2.y) * 0.5 * this.stage.height;
    out.visible = tmp2.x > -1.2 && tmp2.x < 1.2 && tmp2.y > -1.2 && tmp2.y < 1.3;
    return out;
  }

  clampTarget() {
    const L = this.limit;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -L, L);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -L, L);
  }

  // --- kaydırma -----------------------------------------------------------

  beginPan(x, y) {
    this.tween = null;
    this.vel.set(0, 0);
    this.panning = { grab: this.groundAt(x, y), lastT: performance.now(), last: this.target.clone() };
  }

  pan(x, y) {
    if (!this.panning) this.beginPan(x, y);
    const now = performance.now();
    const p = this.groundAt(x, y, tmp);
    this.target.x += this.panning.grab.x - p.x;
    this.target.z += this.panning.grab.z - p.z;
    this.clampTarget();
    this.apply();
    const dt = Math.max(1, now - this.panning.lastT) / 1000;
    const vx = (this.target.x - this.panning.last.x) / dt;
    const vz = (this.target.z - this.panning.last.z) / dt;
    this.vel.set(this.vel.x * 0.5 + vx * 0.5, this.vel.y * 0.5 + vz * 0.5);
    this.panning.last.copy(this.target);
    this.panning.lastT = now;
  }

  endPan() {
    if (!this.panning) return;
    if (performance.now() - this.panning.lastT > 80) this.vel.set(0, 0);
    const max = 60;
    if (this.vel.length() > max) this.vel.setLength(max);
    this.panning = null;
  }

  // Ekran piksel kadar kaydırma (klavye, kenar kaydırması)
  nudge(dx, dy) {
    const a = this.groundAt(this.stage.width / 2, this.stage.height / 2);
    const b = this.groundAt(this.stage.width / 2 + dx, this.stage.height / 2 + dy, tmp);
    this.target.x += b.x - a.x;
    this.target.z += b.z - a.z;
    this.clampTarget();
    this.apply();
  }

  // --- yakınlaştırma -------------------------------------------------------

  beginPinch(x, y, dist) {
    this.tween = null;
    this.vel.set(0, 0);
    this.panning = null;
    this.pinch = { ppu0: this.ppu, d0: Math.max(10, dist), grab: this.groundAt(x, y) };
  }

  pinchMove(x, y, dist) {
    if (!this.pinch) return;
    this.ppu = this.clampPpu(this.pinch.ppu0 * (dist / this.pinch.d0));
    this.ppuGoal = this.ppu;
    this.apply();
    const p = this.groundAt(x, y, tmp);
    this.target.x += this.pinch.grab.x - p.x;
    this.target.z += this.pinch.grab.z - p.z;
    this.clampTarget();
    this.apply();
  }

  endPinch() {
    this.pinch = null;
  }

  zoomAt(x, y, factor) {
    this.tween = null;
    this.ppuGoal = this.clampPpu(this.ppuGoal * factor);
    this.anchor = { x, y };
  }

  // Yumuşak kamera geçişi (giriş sahnesi, görev odaklama)
  flyTo({ x, z, ppu }, duration = 1.2) {
    this.vel.set(0, 0);
    this.tween = {
      t: 0,
      d: duration,
      fx: this.target.x,
      fz: this.target.z,
      fp: this.ppu,
      tx: x ?? this.target.x,
      tz: z ?? this.target.z,
      tp: ppu ? this.clampPpu(ppu) : this.ppu,
    };
  }

  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.d);
      const e = 1 - Math.pow(1 - k, 3);
      this.target.x = tw.fx + (tw.tx - tw.fx) * e;
      this.target.z = tw.fz + (tw.tz - tw.fz) * e;
      this.ppu = tw.fp + (tw.tp - tw.fp) * e;
      this.ppuGoal = this.ppu;
      if (k >= 1) this.tween = null;
      this.apply();
      return true;
    }

    let moved = false;
    if (!this.panning && this.vel.lengthSq() > 1e-4) {
      this.target.x += this.vel.x * dt;
      this.target.z += this.vel.y * dt;
      this.vel.multiplyScalar(Math.exp(-dt * 5.5));
      this.clampTarget();
      moved = true;
    }

    const goal = this.clampPpu(this.ppuGoal);
    if (Math.abs(goal - this.ppu) > 0.01) {
      const a = this.anchor ?? { x: this.stage.width / 2, y: this.stage.height / 2 };
      const before = this.groundAt(a.x, a.y);
      this.ppu += (goal - this.ppu) * Math.min(1, dt * 14);
      this.apply();
      const after = this.groundAt(a.x, a.y, tmp);
      this.target.x += before.x - after.x;
      this.target.z += before.z - after.z;
      this.clampTarget();
      moved = true;
    } else {
      this.anchor = null;
    }

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 0.6);
      moved = true;
    }
    if (moved) this.apply();
    return moved;
  }
}

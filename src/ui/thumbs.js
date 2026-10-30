// Mağaza kartları için binaların gerçek 3B modelinden küçük resimler üretir.
// Ayrı, küçük bir çizici kullanılır; sonuçlar önbelleğe alınır.

import * as THREE from 'three';
import { getDef } from '../buildings/index.js';
import { buildModel } from '../game/models.js';

const DEG = Math.PI / 180;

export class Thumbs {
  constructor(cfg) {
    this.cache = new Map();
    this.size = 220;
    this.cfg = cfg;
    this.queue = Promise.resolve();
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      this.renderer = null;
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(1);
    r.setSize(this.size, this.size, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x6f8f4a, 1.9));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.set(-34, 62, 14);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfeaff, 0.5);
    fill.position.set(30, 20, 30);
    this.scene.add(fill);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const el = cfg.camera.elevation * DEG;
    const az = cfg.camera.azimuth * DEG;
    this.dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  }

  get(id, level = 1, variant = 0) {
    const key = `${id}:${level}:${variant}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const url = this.#render(getDef(id), level, variant);
    this.cache.set(key, url);
    return url;
  }

  #render(def, level, variant) {
    if (!this.renderer || !def) return '';
    const model = buildModel(def, { level, variant });
    for (const d of model.dynamics) d.update(0.6);
    this.scene.add(model.root);
    const box = new THREE.Box3().setFromObject(model.root);
    const center = box.getCenter(new THREE.Vector3());
    const cam = this.camera;
    cam.position.copy(center).addScaledVector(this.dir, 60);
    cam.lookAt(center);
    cam.updateMatrixWorld();
    // Kutunun köşelerini kamera uzayına izdüşürüp çerçeveyi sığdır
    let mx = 0;
    let my = 0;
    const p = new THREE.Vector3();
    for (let k = 0; k < 8; k++) {
      p.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z);
      p.applyMatrix4(cam.matrixWorldInverse);
      mx = Math.max(mx, Math.abs(p.x));
      my = Math.max(my, Math.abs(p.y));
    }
    const half = Math.max(mx, my) * 1.08;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
    this.renderer.render(this.scene, cam);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(model.root);
    model.dispose();
    return url;
  }
}

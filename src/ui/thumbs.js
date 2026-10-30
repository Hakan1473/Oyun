// Mağaza kartları ve diyalog portreleri için gerçek 3B modellerden küçük resimler.
// Ayrı, küçük bir çizici kullanılır; sonuçlar önbelleğe alınır.

import * as THREE from 'three';
import { getDef } from '../buildings/index.js';
import { buildModel } from '../game/models.js';
import { HumanRig } from '../world/rigs.js';

const DEG = Math.PI / 180;

export class Thumbs {
  constructor(cfg) {
    this.cache = new Map();
    this.cfg = cfg;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      this.renderer = null;
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0x9aa8b4, 0x1a1c18, 1.6));
    this.key = new THREE.DirectionalLight(0xffd2a0, 2.6);
    this.key.position.set(-30, 40, 30);
    this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0x8aa8ff, 1.6);
    this.rim.position.set(30, 20, -30);
    this.scene.add(this.rim);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.persp = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
    const el = cfg.camera.elevation * DEG;
    const az = cfg.camera.azimuth * DEG;
    this.dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  }

  get(id, level = 1, variant = 0) {
    const key = `${id}:${level}:${variant}`;
    if (!this.cache.has(key)) this.cache.set(key, this.#building(getDef(id), level, variant));
    return this.cache.get(key);
  }

  #building(def, level, variant) {
    if (!this.renderer || !def) return '';
    this.renderer.setSize(220, 220, false);
    const model = buildModel(def, { level, variant });
    this.scene.add(model.root);
    const box = new THREE.Box3().setFromObject(model.root);
    const center = box.getCenter(new THREE.Vector3());
    const cam = this.ortho;
    cam.position.copy(center).addScaledVector(this.dir, 60);
    cam.lookAt(center);
    cam.updateMatrixWorld();
    let mx = 0;
    let my = 0;
    const p = new THREE.Vector3();
    for (let k = 0; k < 8; k++) {
      p.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z);
      p.applyMatrix4(cam.matrixWorldInverse);
      mx = Math.max(mx, Math.abs(p.x));
      my = Math.max(my, Math.abs(p.y));
    }
    const half = Math.max(mx, my) * 1.06;
    Object.assign(cam, { left: -half, right: half, top: half, bottom: -half });
    cam.updateProjectionMatrix();
    this.renderer.render(this.scene, cam);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(model.root);
    model.dispose();
    return url;
  }

  // Omuz hizasından, ateş ışığında yüz portresi
  portrait(def) {
    const key = `p:${def.id}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (!this.renderer || !def.look) return '';
    this.renderer.setSize(256, 256, false);
    const rig = new HumanRig(def.look);
    rig.pose(0.016, { t: 0 });
    for (const o of [rig.flash, rig.axe]) o.visible = false;
    rig.root.traverse((o) => {
      if (o.material?.depthFunc === THREE.GreaterDepth) o.visible = false;
    });
    this.scene.add(rig.root);
    rig.root.updateMatrixWorld(true);
    const head = new THREE.Vector3();
    rig.head.getWorldPosition(head);
    const cam = this.persp;
    cam.position.set(head.x + 0.32, head.y + 0.02, head.z + 0.9);
    cam.lookAt(head.x, head.y - 0.08, head.z);
    // ateş ışığı aşağıdan-yandan, soğuk ay ışığı arkadan
    this.key.position.set(-2.2, -0.4, 2.4);
    this.key.color.set(0xff9a50);
    this.key.intensity = 3.4;
    this.rim.position.set(2, 2.5, -2);
    this.rim.intensity = 2.4;
    this.renderer.render(this.scene, cam);
    this.key.position.set(-30, 40, 30);
    this.key.color.set(0xffd2a0);
    this.key.intensity = 2.6;
    this.rim.position.set(30, 20, -30);
    this.rim.intensity = 1.6;
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(rig.root);
    this.cache.set(key, url);
    return url;
  }
}

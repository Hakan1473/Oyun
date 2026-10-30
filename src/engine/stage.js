// Sahne, ışıklar, gölgeler ve çizici. Kamera açısı sabittir; yalnızca kaydırma ve yakınlaştırma vardır.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C } from './palette.js';

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export class Stage {
  constructor(canvas, cfg) {
    this.cfg = cfg;
    this.canvas = canvas;
    this.isTouch = coarse;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.maxDpr = Math.min(window.devicePixelRatio || 1, coarse ? 2 : 2);
    this.dpr = this.maxDpr;
    renderer.setPixelRatio(this.dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.localClippingEnabled = true;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.forestFloor);
    this.scene = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.32;
    pmrem.dispose();

    // Gökyüzünden yumuşak dolgu + sıcak güneş
    this.hemi = new THREE.HemisphereLight(0xd8ecff, 0x557f36, 1.0);
    scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(0xffeed2, 2.9);
    sun.castShadow = true;
    const half = cfg.grid.size / 2 + cfg.grid.border + 2;
    const maxTex = renderer.capabilities.maxTextureSize;
    const size = Math.min(coarse ? 2048 : 4096, maxTex);
    sun.shadow.mapSize.set(size, size);
    const sc = sun.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 3;
    // Işık ekranın sol üstünden gelir: sol yüzler aydınlık, gölgeler sağa düşer.
    sun.position.set(-34, 62, 14);
    sun.target.position.set(0, 0, 0);
    scene.add(sun, sun.target);
    this.sun = sun;

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 400);
    this.width = w;
    this.height = h;

    this._frameTimes = [];
    this._lastDprChange = 0;
    this.shadowsDirty = true;
  }

  markShadows() {
    this.shadowsDirty = true;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
  }

  // Kare süresi uzun kalırsa çözünürlüğü kademeli düşürür.
  adapt(dt, now) {
    const ft = this._frameTimes;
    ft.push(dt);
    if (ft.length < 90) return;
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    ft.length = 0;
    if (now - this._lastDprChange < 3000) return;
    if (avg > 0.024 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
    } else if (avg < 0.0135 && this.dpr < this.maxDpr) {
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
    } else {
      return;
    }
    this._lastDprChange = now;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
  }

  render() {
    if (this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

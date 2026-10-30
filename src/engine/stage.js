// Sahne, çizici, ışıklar ve görüntü hattı. Kamera açısı sabittir; yalnızca kaydırma ve yakınlaştırma vardır.

import * as THREE from 'three';
import { Post } from './post.js';

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const cores = navigator.hardwareConcurrency || 4;

export function detectQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  if (coarse) return cores >= 6 ? 'medium' : 'low';
  return 'high';
}

export class Stage {
  constructor(canvas, cfg, quality = detectQuality()) {
    this.cfg = cfg;
    this.canvas = canvas;
    this.isTouch = coarse;
    this.quality = quality;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    const devDpr = window.devicePixelRatio || 1;
    this.maxDpr = Math.min(devDpr, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1.15);
    this.minDpr = Math.min(this.maxDpr, quality === 'low' ? 0.8 : 1);
    this.dpr = this.maxDpr;
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.localClippingEnabled = true;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d0c);
    this.scene = scene;

    this.hemi = new THREE.HemisphereLight(0x8c9aa4, 0x20251a, 1.0);
    scene.add(this.hemi);

    // Ana ışık: gündüz bulut arkası güneş, gece ay. Yönü sabit kalır; gölgeler önbellekte durur.
    const key = new THREE.DirectionalLight(0xdcd6c8, 1.4);
    key.castShadow = true;
    const half = cfg.grid.size / 2 + 9;
    const size = Math.min(quality === 'low' ? 1024 : 2048, renderer.capabilities.maxTextureSize);
    key.shadow.mapSize.set(size, size);
    const sc = key.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = 140;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 4;
    key.position.set(-30, 52, 18);
    key.target.position.set(0, 0, 0);
    scene.add(key, key.target);
    this.key = key;

    // Sabit sayıda nokta ışık: ateşler, meşaleler ve fenerler en yakın olanlara atanır.
    // Sayı değişmediği için gölgelendiriciler yeniden derlenmez.
    this.points = Array.from({ length: quality === 'low' ? 4 : 6 }, () => {
      const l = new THREE.PointLight(0xff9a50, 0, 9, 1.6);
      scene.add(l);
      return l;
    });
    this.spots = Array.from({ length: quality === 'low' ? 1 : 2 }, () => {
      const l = new THREE.SpotLight(0xfff0dc, 0, 11, 0.42, 0.75, 1.2);
      scene.add(l, l.target);
      return l;
    });

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 1, 320);
    this.width = w;
    this.height = h;

    this.post = new Post(renderer, { msaa: quality !== 'low' });
    this.msaa = this.post.samples > 0;

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
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, this.dpr);
  }

  // Kare süresi uzun kalırsa çözünürlüğü kademeli düşürür
  adapt(dt, now) {
    const ft = this._frameTimes;
    ft.push(dt);
    if (ft.length < 90) return;
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    ft.length = 0;
    if (now - this._lastDprChange < 2500) return;
    let next = this.dpr;
    if (avg > 0.026) next = Math.max(this.minDpr, this.dpr - 0.2);
    else if (avg < 0.0135) next = Math.min(this.maxDpr, this.dpr + 0.1);
    if (Math.abs(next - this.dpr) < 0.01) return;
    this.dpr = next;
    this._lastDprChange = now;
    this.resize(this.width, this.height);
  }

  render(time) {
    if (this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    this.post.render(this.scene, this.camera, time);
  }
}

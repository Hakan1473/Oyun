// Sahne, çizici, ışıklar ve görüntü hattı. Kamera açısı sabittir; yalnızca kaydırma ve yakınlaştırma vardır.

import * as THREE from 'three';
import { Post } from './post.js';

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const cores = navigator.hardwareConcurrency || 4;
const ua = navigator.userAgent || '';
export const IS_IOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_MOBILE = coarse || IS_IOS || /Android|Mobile|HarmonyOS/i.test(ua);

// Kalite kademeleri. Telefon ve tabletler "orta" ile başlar: daha ucuz ışık modeli, daha az ışık,
// MSAA yerine FXAA, daha seyrek bitki örtüsü ve sadeleştirilmiş sis. Görünüm aynı kalır.
export const PROFILES = {
  high: {
    dprStart: 2, dprMax: 2, dprMin: 1, maxPixels: 3.7e6, msaa: true, fxaa: false, points: 6, spots: 2, shadow: 2048, softShadow: true,
    lambert: false, fogOctaves: 4, bloomLevels: 4, softChain: true, flora: 1, forestStep: 2.15, lodDist: 30, shadowNear: 34,
  },
  medium: {
    dprStart: 1.5, dprMax: 2, dprMin: 1, maxPixels: 1.4e6, msaa: false, fxaa: true, points: 4, spots: 1, shadow: 2048, softShadow: false,
    lambert: true, fogOctaves: 3, bloomLevels: 3, softChain: false, flora: 0.55, forestStep: 2.3, lodDist: 22, shadowNear: 26,
  },
  low: {
    dprStart: 1.15, dprMax: 1.4, dprMin: 0.9, maxPixels: 0.8e6, msaa: false, fxaa: true, points: 3, spots: 1, shadow: 1024, softShadow: false,
    lambert: true, fogOctaves: 2, bloomLevels: 3, softChain: false, flora: 0.35, forestStep: 2.6, lodDist: 18, shadowNear: 22,
  },
};

function storedQuality() {
  try {
    const v = JSON.parse(localStorage.getItem('kuytu.pref.quality') ?? 'null');
    return v === 'low' || v === 'medium' || v === 'high' ? v : null;
  } catch {
    return null;
  }
}

export function detectQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  const saved = storedQuality();
  if (saved) return saved;
  if (!IS_MOBILE) return 'high';
  if (IS_IOS) return 'medium';
  const mem = navigator.deviceMemory;
  return (mem && mem <= 3) || cores <= 4 ? 'low' : 'medium';
}

// WebGL 2 bağlamı: önce yüksek başarım, olmazsa varsayılan ayarlarla yeniden dener.
function createRenderer(canvas) {
  const tries = [
    { powerPreference: 'high-performance' },
    { powerPreference: 'default' },
    { powerPreference: 'low-power' },
  ];
  let last = null;
  for (const t of tries) {
    try {
      return new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, depth: true, alpha: false, premultipliedAlpha: true, ...t });
    } catch (err) {
      last = err;
    }
  }
  throw last ?? new Error('WebGL 2 bağlamı açılamadı');
}

export class Stage {
  constructor(canvas, cfg, quality = detectQuality()) {
    this.cfg = cfg;
    this.canvas = canvas;
    this.isTouch = coarse;
    this.isMobile = IS_MOBILE;
    this.quality = quality;
    const P = PROFILES[quality];
    this.profile = P;

    const renderer = createRenderer(canvas);
    const devDpr = window.devicePixelRatio || 1;
    // temkinli başla; kareler hızlıysa adapt() çözünürlüğü kademeli yükseltir
    this.maxDpr = Math.min(devDpr, P.dprMax);
    this.minDpr = Math.min(this.maxDpr, P.dprMin);
    this.dpr = Math.min(this.maxDpr, P.dprStart);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = P.softShadow ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
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
    const size = Math.min(P.shadow, renderer.capabilities.maxTextureSize);
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
    this.points = Array.from({ length: P.points }, () => {
      const l = new THREE.PointLight(0xff9a50, 0, 9, 1.6);
      scene.add(l);
      return l;
    });
    this.spots = Array.from({ length: P.spots }, () => {
      const l = new THREE.SpotLight(0xfff0dc, 0, 11, 0.42, 0.75, 1.2);
      scene.add(l, l.target);
      return l;
    });

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 1, 320);
    this.width = w;
    this.height = h;

    this.post = new Post(renderer, P);
    this.msaa = this.post.samples > 0;
    // telefonun daha iri pikselinde gren kumlu görünmesin
    if (P.fxaa) this.post.params.uGrain.value = 0.018;

    this._frameTimes = [];
    this._lastDprChange = 0;
    this._fastWindows = 0;
    this._lastDrop = -1e9;
    this.shadowsDirty = true;

    // Bellek baskısında (özellikle iOS) tarayıcı bağlamı geri alabilir; sayfa çökmeden bekler
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.onLost?.();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.post.setSize(this.width, this.height, this.renderDpr ?? this.dpr, true);
      this.markShadows();
      this.onRestored?.();
    });
  }

  markShadows() {
    this.shadowsDirty = true;
  }

  // Büyük tablet ekranlarında piksel sayısı patlamasın: toplam piksel kademe sınırını aşmaz
  resize(w, h) {
    this.width = w;
    this.height = h;
    const cap = Math.sqrt(this.profile.maxPixels / Math.max(1, w * h));
    const dpr = Math.max(0.5, Math.min(this.dpr, cap));
    this.renderDpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, dpr);
  }

  // Kare süresine göre çözünürlüğü ayarlar. Ortanca kullanılır (tek tük takılmalar karar
  // vermez); düşürme hızlı, yükseltme temkinlidir; her değişiklik hedefleri yeniden kurduğu
  // için seyrek yapılır. En düşük çözünürlükte hâlâ yavaşsa pahalı son işlem adımları kapanır.
  adapt(dt, now) {
    if (document.hidden) {
      this._frameTimes.length = 0;
      return;
    }
    const ft = this._frameTimes;
    ft.push(dt);
    if (ft.length < 120) return;
    const med = [...ft].sort((a, b) => a - b)[ft.length >> 1];
    ft.length = 0;
    if (now - this._lastDprChange < 4000) return;
    // piksel sınırı zaten devredeyse istenen değeri gerçek değere çek (boşuna yeniden kurulmasın)
    this.dpr = Math.min(this.dpr, this.renderDpr ?? this.dpr);
    let next = this.dpr;
    if (med > 0.024) {
      this._fastWindows = 0;
      if (this.dpr > this.minDpr + 0.01) {
        next = Math.max(this.minDpr, this.dpr - 0.25);
        this._lastDrop = now;
      } else if (!this.post.lite) {
        this.post.lite = true;
        this._lastDprChange = now;
        return;
      }
    } else if (med < 0.0125) {
      this._fastWindows++;
      if (this._fastWindows >= 3 && now - this._lastDrop > 20000) {
        next = Math.min(this.maxDpr, this.dpr + 0.15);
        this._fastWindows = 0;
      }
    } else {
      this._fastWindows = 0;
    }
    if (Math.abs(next - this.dpr) < 0.01) return;
    const before = this.renderDpr;
    this.dpr = next;
    this._lastDprChange = now;
    const cap = Math.sqrt(this.profile.maxPixels / Math.max(1, this.width * this.height));
    if (Math.abs(Math.min(next, cap) - before) < 0.01) return;
    this.resize(this.width, this.height);
  }

  render(time) {
    if (this.lost) return;
    if (this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    this.post.render(this.scene, this.camera, time);
  }
}

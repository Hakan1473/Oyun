// Görüntü işleme hattı:
//   sahne (HDR + derinlik) → atmosfer (yere çöken, hareketli sis + ışık saçılması)
//   → bloom (parlayan ateşler, gözler) + yumuşak kopya (kenar bulanıklığı)
//   → son geçiş (ton eşleme, renk derecelendirme, vinyet, gren, sinematik bant)

import * as THREE from 'three';

const MAX_GLOW = 6;

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const NOISE = /* glsl */ `
  float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
  float vn(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }
`;

const atmosFrag = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform mat4 uProjInv;
  uniform mat4 uCamWorld;
  uniform vec3 uFogColor;
  uniform vec3 uFogLight;
  uniform float uDensity;
  uniform float uHeightK;
  uniform float uTime;
  uniform float uClearR;
  uniform vec2 uCenter;
  uniform vec3 uGlowPos[${MAX_GLOW}];
  uniform vec3 uGlowCol[${MAX_GLOW}];
  uniform float uGlowRad[${MAX_GLOW}];
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec3 col = max(texture2D(tColor, vUv).rgb, 0.0);
    float d = texture2D(tDepth, vUv).r;
    vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    v /= v.w;
    vec3 wp = (uCamWorld * v).xyz;
    bool sky = d > 0.99999;
    if (sky) wp.y = 0.0;

    float r = length(wp.xz - uCenter);
    float radial = smoothstep(uClearR, uClearR + 24.0, r);
    vec3 q = vec3(wp.xz * 0.11 + vec2(uTime * 0.018, uTime * 0.011), uTime * 0.025);
    float n = fbm(q);
    float n2 = fbm(vec3(wp.xz * 0.42 - uTime * 0.04, wp.y * 0.6 + uTime * 0.05));
    float hf = exp(-max(wp.y, 0.0) * uHeightK);
    float mist = uDensity * hf * (0.1 + radial * 0.9) * (0.25 + n * 1.25 + n2 * 0.45);
    float haze = uDensity * pow(radial, 1.6) * (0.55 + n * 0.5);
    float fog = sky ? 1.0 : 1.0 - exp(-(mist + haze) * 2.4);

    // Işık kaynaklarının sise saçılması (sahte hacimsel ışık)
    vec3 glow = vec3(0.0);
    for (int i = 0; i < ${MAX_GLOW}; i++) {
      vec3 dp = wp - uGlowPos[i];
      dp.y *= 0.6;
      float k = exp(-dot(dp, dp) / max(0.001, uGlowRad[i] * uGlowRad[i]));
      glow += uGlowCol[i] * k;
    }
    vec3 fogC = uFogColor * (0.85 + n * 0.3) + uFogLight * (1.0 - hf) * 0.2;
    col = mix(col, fogC + glow * 0.35, fog);
    col += glow * 0.06 * (1.0 - fog);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const prefilterFrag = /* glsl */ `
  uniform sampler2D tColor;
  uniform vec2 uTexel;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + uTexel * vec2(1.0, -1.0)).rgb
           + texture2D(tColor, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    c *= 0.25;
    float l = max(c.r, max(c.g, c.b));
    float soft = clamp(l - uThreshold + 0.5, 0.0, 1.0);
    soft = soft * soft * 0.5;
    float w = max(soft, l - uThreshold) / max(l, 1e-4);
    gl_FragColor = vec4(c * w, 1.0);
  }
`;

const downFrag = /* glsl */ `
  uniform sampler2D tColor;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec2 h = uTexel * 0.5;
    vec3 s = texture2D(tColor, vUv).rgb * 4.0;
    s += texture2D(tColor, vUv - h).rgb;
    s += texture2D(tColor, vUv + h).rgb;
    s += texture2D(tColor, vUv + vec2(h.x, -h.y)).rgb;
    s += texture2D(tColor, vUv - vec2(h.x, -h.y)).rgb;
    gl_FragColor = vec4(s / 8.0, 1.0);
  }
`;

const upFrag = /* glsl */ `
  uniform sampler2D tColor;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec2 h = uTexel * 0.5;
    vec3 s = texture2D(tColor, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
    s += texture2D(tColor, vUv + vec2(-h.x, h.y)).rgb * 2.0;
    s += texture2D(tColor, vUv + vec2(0.0, h.y * 2.0)).rgb;
    s += texture2D(tColor, vUv + vec2(h.x, h.y)).rgb * 2.0;
    s += texture2D(tColor, vUv + vec2(h.x * 2.0, 0.0)).rgb;
    s += texture2D(tColor, vUv + vec2(h.x, -h.y)).rgb * 2.0;
    s += texture2D(tColor, vUv + vec2(0.0, -h.y * 2.0)).rgb;
    s += texture2D(tColor, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
    gl_FragColor = vec4(s / 12.0, 1.0);
  }
`;

const finalFrag = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tBloom;
  uniform sampler2D tSoft;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uBloom;
  uniform float uExposure;
  uniform float uSat;
  uniform float uContrast;
  uniform vec3 uTint;
  uniform vec3 uLift;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uBlur;
  uniform float uAberr;
  uniform float uLetter;
  uniform float uFade;
  uniform float uDamage;
  uniform float uFear;
  varying vec2 vUv;

  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float e = length(p * vec2(min(1.0, 1.0 / aspect) * 1.05, 1.15));
    float edge = smoothstep(0.32, 0.95, e);
    vec2 dir = uv - 0.5;
    float ca = (uAberr + uFear * 0.004) * edge;
    vec3 sharp = vec3(texture2D(tColor, uv - dir * ca).r, texture2D(tColor, uv).g, texture2D(tColor, uv + dir * ca).b);
    vec3 soft = texture2D(tSoft, uv).rgb;
    vec3 col = mix(sharp, soft, clamp(edge * uBlur, 0.0, 1.0));
    col += texture2D(tBloom, uv).rgb * uBloom;
    col *= uExposure;
    col = aces(col);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSat);
    col = col * uTint + uLift;
    col = (col - 0.5) * uContrast + 0.5;
    float vig = smoothstep(0.2, 1.1, e);
    col *= 1.0 - uVignette * vig;
    col = mix(col, vec3(0.24, 0.0, 0.015), clamp(uDamage * (0.06 + edge * 0.95), 0.0, 0.6));
    float g = hash(uv * uRes + fract(uTime * 7.13) * 91.7) - 0.5;
    col += g * uGrain * (0.35 + 0.65 * smoothstep(0.0, 0.5, l));
    float bar = smoothstep(uLetter, uLetter - 0.004, uv.y) + smoothstep(1.0 - uLetter, 1.0 - uLetter + 0.004, uv.y);
    col *= 1.0 - clamp(bar, 0.0, 1.0) * step(0.001, uLetter);
    col *= 1.0 - uFade;
    gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
  }
`;

function rt(w, h, type, opts = {}) {
  const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, ...opts,
  });
  t.texture.generateMipmaps = false;
  return t;
}

export class Post {
  constructor(renderer, { msaa = true } = {}) {
    this.renderer = renderer;
    const gl = renderer.getContext();
    const isGL2 = renderer.capabilities.isWebGL2;
    const half = isGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    this.type = half ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.samples = msaa && isGL2 ? Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0) : 0;
    this.enabled = true;

    this.scene = new THREE.Scene();
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(tri);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.atmos = mk(atmosFrag, {
      tColor: { value: null }, tDepth: { value: null },
      uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uFogColor: { value: new THREE.Color(0x6f7a77) }, uFogLight: { value: new THREE.Color(0x000000) },
      uDensity: { value: 0.6 }, uHeightK: { value: 0.55 }, uTime: { value: 0 }, uClearR: { value: 8 },
      uCenter: { value: new THREE.Vector2() },
      uGlowPos: { value: Array.from({ length: MAX_GLOW }, () => new THREE.Vector3(0, -99, 0)) },
      uGlowCol: { value: Array.from({ length: MAX_GLOW }, () => new THREE.Color(0, 0, 0)) },
      uGlowRad: { value: new Array(MAX_GLOW).fill(1) },
    });
    this.prefilter = mk(prefilterFrag, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 } });
    this.down = mk(downFrag, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = mk(upFrag, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.final = mk(finalFrag, {
      tColor: { value: null }, tBloom: { value: null }, tSoft: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
      uBloom: { value: 0.9 }, uExposure: { value: 1 }, uSat: { value: 0.8 }, uContrast: { value: 1.05 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uLift: { value: new THREE.Color(0, 0, 0) },
      uVignette: { value: 0.45 }, uGrain: { value: 0.028 }, uBlur: { value: 1 }, uAberr: { value: 0.0025 },
      uLetter: { value: 0 }, uFade: { value: 0 }, uDamage: { value: 0 }, uFear: { value: 0 },
    });
    this.params = this.final.uniforms;
    this.fog = this.atmos.uniforms;
  }

  setSize(w, h, dpr) {
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (this.W === W && this.H === H) return;
    this.W = W;
    this.H = H;
    this.dispose();
    const depthTexture = new THREE.DepthTexture(W, H);
    depthTexture.type = THREE.UnsignedIntType;
    this.rtScene = new THREE.WebGLRenderTarget(W, H, {
      type: this.type, samples: this.samples, depthBuffer: true, depthTexture,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    this.rtScene.texture.generateMipmaps = false;
    this.rtAtmos = rt(W, H, this.type);
    const s = (k) => [Math.ceil(W / k), Math.ceil(H / k)];
    this.bloomDown = [4, 8, 16, 32].map((k) => rt(...s(k), this.type));
    this.bloomUp = [16, 8, 4].map((k) => rt(...s(k), this.type));
    this.softDown = [2, 4, 8, 16].map((k) => rt(...s(k), this.type));
    this.softUp = [8, 4, 2].map((k) => rt(...s(k), this.type));
    this.params.uRes.value.set(W, H);
  }

  dispose() {
    for (const t of [this.rtScene, this.rtAtmos, ...(this.bloomDown ?? []), ...(this.bloomUp ?? []), ...(this.softDown ?? []), ...(this.softUp ?? [])]) t?.dispose();
    this.rtScene?.depthTexture?.dispose();
  }

  #pass(mat, src, dst) {
    if (mat.uniforms.tColor) mat.uniforms.tColor.value = src?.texture ?? null;
    if (mat.uniforms.uTexel && src) mat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
    this.quad.material = mat;
    this.renderer.setRenderTarget(dst);
    this.renderer.render(this.scene, this.cam);
  }

  #chain(src, downs, ups, first) {
    this.#pass(first, src, downs[0]);
    for (let i = 1; i < downs.length; i++) this.#pass(this.down, downs[i - 1], downs[i]);
    let prev = downs[downs.length - 1];
    for (let i = 0; i < ups.length; i++) {
      this.#pass(this.up, prev, ups[i]);
      prev = ups[i];
    }
    return prev;
  }

  render(scene, camera, time) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);

    const a = this.atmos.uniforms;
    a.tDepth.value = this.rtScene.depthTexture;
    a.uProjInv.value.copy(camera.projectionMatrixInverse);
    a.uCamWorld.value.copy(camera.matrixWorld);
    a.uTime.value = time;
    this.#pass(this.atmos, this.rtScene, this.rtAtmos);

    const bloom = this.#chain(this.rtAtmos, this.bloomDown, this.bloomUp, this.prefilter);
    const soft = this.#chain(this.rtAtmos, this.softDown, this.softUp, this.down);

    const f = this.final.uniforms;
    f.tBloom.value = bloom.texture;
    f.tSoft.value = soft.texture;
    f.uTime.value = time;
    this.#pass(this.final, this.rtAtmos, null);
  }

  setGlows(list) {
    const a = this.atmos.uniforms;
    for (let i = 0; i < MAX_GLOW; i++) {
      const g = list[i];
      if (g) {
        a.uGlowPos.value[i].copy(g.pos);
        a.uGlowCol.value[i].copy(g.color).multiplyScalar(g.strength);
        a.uGlowRad.value[i] = g.radius;
      } else {
        a.uGlowCol.value[i].setRGB(0, 0, 0);
        a.uGlowPos.value[i].set(0, -99, 0);
      }
    }
  }
}

export const GLOW_SLOTS = MAX_GLOW;


// =====================================================================
//  World layout
// =====================================================================
const WORLD = 440, HALF = WORLD / 2;
const RES = IS_MOBILE ? 192 : 256, V = RES + 1, STEP = WORLD / RES;
const nA = makeSimplex(101), nB = makeSimplex(202), nC = makeSimplex(303);

const CAMP = { x: 6, z: 104 };
const LIGHTHOUSE = { x: -16, z: -114 };
const SHRINES = [
  { id: 'cayir', name: 'Çayır Sunağı', x: -64, z: 54, color: '#ffd27a' },
  { id: 'orman', name: 'Orman Sunağı', x: 66, z: 44, color: '#8dffb4' },
  { id: 'kiyi', name: 'Kıyı Sunağı', x: -112, z: -12, color: '#7fd8ff' },
  { id: 'zirve', name: 'Zirve Sunağı', x: 72, z: -60, color: '#ff9ed8' },
  { id: 'harabe', name: 'Harabe Sunağı', x: -50, z: -64, color: '#c7a4ff' },
];
const FLATS = [];

function islandMask(x, z) {
  const d = Math.hypot(x * 0.96, z) / 170;
  const n = nA(x * 0.0065, z * 0.0065) * 0.2 + nB(x * 0.021, z * 0.021) * 0.05;
  return 1 - smooth(0.58, 1.0, d + n);
}
function shapedHeight(x, z) {
  const m = islandMask(x, z);
  let h = 6 + fbm(nB, x * 0.011, z * 0.011, 4) * 9;
  const dx = x - 76, dz = z + 64;
  const mt = Math.exp(-(dx * dx + dz * dz) / (2 * 34 * 34));
  const ridge = 1 - Math.abs(fbm(nC, x * 0.017, z * 0.017, 3));
  h += mt * (33 + ridge * ridge * 15);
  const dx2 = x + 40, dz2 = z + 92;
  h += Math.exp(-(dx2 * dx2 + dz2 * dz2) / (2 * 30 * 30)) * 9;
  h = h * m - (1 - m) * 16;
  if (h < 2.5) { const t = h - 2.5; h = 2.5 + (t > -7 ? t * 0.4 : -2.8 + (t + 7)); }
  return h;
}
function addFlat(p, r0, r1, minH) {
  const h = Math.max(shapedHeight(p.x, p.z), minH);
  FLATS.push({ x: p.x, z: p.z, r0, r1, h });
  return h;
}
function height(x, z) {
  let h = shapedHeight(x, z);
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r1) h = lerp(h, f.h, 1 - smooth(f.r0, f.r1, d));
  }
  return h;
}
function flatInfluence(x, z) {
  let v = 0;
  for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); v = Math.max(v, 1 - smooth(f.r0 * 0.7, f.r0 * 1.05, d)); }
  return v;
}
function forestMask(x, z) {
  let f = smooth(-0.1, 0.45, nA(x * 0.011 + 40, z * 0.011 - 20));
  const s = SHRINES[1];
  f = Math.max(f, Math.exp(-((x - s.x) ** 2 + (z - s.z) ** 2) / (2 * 32 * 32)) * 1.1 - 0.1);
  const m = SHRINES[0];
  f *= 1 - Math.exp(-((x - m.x) ** 2 + (z - m.z) ** 2) / (2 * 26 * 26)) * 0.9;
  return clamp(f, 0, 1);
}

CAMP.h = addFlat(CAMP, 10, 20, 3.0);
for (const s of SHRINES) s.h = addFlat(s, 9, 18, 3.5);
LIGHTHOUSE.h = addFlat(LIGHTHOUSE, 12, 26, 14);

const PATHS = [
  [CAMP, { x: -18, z: 90 }, { x: -42, z: 70 }, SHRINES[0]],
  [CAMP, { x: 30, z: 86 }, { x: 50, z: 62 }, SHRINES[1]],
  [SHRINES[0], { x: -88, z: 30 }, { x: -104, z: 8 }, SHRINES[2]],
  [SHRINES[0], { x: -62, z: 18 }, { x: -56, z: -26 }, SHRINES[4]],
  [SHRINES[4], { x: -34, z: -90 }, LIGHTHOUSE],
  [SHRINES[1], { x: 76, z: 12 }, { x: 84, z: -22 }, { x: 80, z: -44 }, SHRINES[3]],
  [SHRINES[1], { x: 22, z: 18 }, { x: -18, z: -14 }, SHRINES[4]],
];
const PATH_SEGS = [];
(function buildPathSegs() {
  let seed = 0;
  for (const path of PATHS) {
    seed += 13.7;
    const pts = [];
    for (let k = 0; k < path.length - 1; k++) {
      const a = path[k], b = path[k + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.ceil(len / 4));
      const px = -(b.z - a.z) / len, pz = (b.x - a.x) / len;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const fade = Math.min(1, Math.min(t + k, path.length - 1 - k - t) * 1.5);
        const w = nA(seed + (k + t) * 1.3, 0.5) * 6 * Math.min(1, fade);
        pts.push({ x: lerp(a.x, b.x, t) + px * w, z: lerp(a.z, b.z, t) + pz * w });
      }
    }
    pts.push(path[path.length - 1]);
    for (let i = 0; i < pts.length - 1; i++) PATH_SEGS.push([pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z]);
  }
})();

// =====================================================================
//  Terrain fields
// =====================================================================
const H = new Float32Array(V * V), NX = new Float32Array(V * V), NY = new Float32Array(V * V), NZ = new Float32Array(V * V);
const PD = new Float32Array(V * V).fill(99), GD = new Float32Array(V * V), TCOL = new Float32Array(V * V * 3);
const gx = (i) => -HALF + i * STEP;

function genHeights() {
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) H[j * V + i] = height(gx(i), gx(j));
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const hl = H[j * V + Math.max(i - 1, 0)], hr = H[j * V + Math.min(i + 1, RES)];
    const hu = H[Math.max(j - 1, 0) * V + i], hd = H[Math.min(j + 1, RES) * V + i];
    const nx = (hl - hr) / (2 * STEP), nz = (hu - hd) / (2 * STEP);
    const l = Math.sqrt(nx * nx + 1 + nz * nz);
    NX[j * V + i] = nx / l; NY[j * V + i] = 1 / l; NZ[j * V + i] = nz / l;
  }
  for (const [ax, az, bx, bz] of PATH_SEGS) {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - 5 + HALF) / STEP)), i1 = Math.min(RES, Math.ceil((Math.max(ax, bx) + 5 + HALF) / STEP));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - 5 + HALF) / STEP)), j1 = Math.min(RES, Math.ceil((Math.max(az, bz) + 5 + HALF) / STEP));
    const dx = bx - ax, dz = bz - az, ll = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = gx(i), z = gx(j);
      const t = clamp(((x - ax) * dx + (z - az) * dz) / ll, 0, 1);
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < PD[j * V + i]) PD[j * V + i] = d;
    }
  }
}

const TC = {
  sand: col('#d8c39a'), wetSand: col('#9a8261'), seabed: col('#6f8a76'),
  grassA: col('#557f35'), grassB: col('#88a446'), grassDry: col('#a89e5a'), forest: col('#3a5a28'),
  rock: col('#8c8378'), rock2: col('#5e5852'), snow: col('#eef1f5'), dirt: col('#7c6a54'), plaza: col('#958a78'),
};
function genColors() {
  const c = new THREE.Color(), g = new THREE.Color(), r = new THREE.Color();
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const k = j * V + i, x = gx(i), z = gx(j), h = H[k], ny = NY[k], pd = PD[k];
    const n1 = nB(x * 0.045, z * 0.045), n2 = nC(x * 0.18, z * 0.18);
    c.copy(TC.sand);
    if (h < 1.0) c.lerp(TC.wetSand, smooth(1.0, 0.15, h));
    if (h < -0.4) c.lerp(TC.seabed, smooth(-0.4, -5, h));
    g.copy(TC.grassA).lerp(TC.grassB, smooth(-0.6, 0.6, n1)).lerp(TC.grassDry, smooth(0.2, 0.8, nA(x * 0.013 + 7, z * 0.013)) * 0.7);
    g.lerp(TC.forest, forestMask(x, z) * 0.7);
    const gT = smooth(1.7, 3.0, h + n2 * 0.5);
    c.lerp(g, gT);
    const rockT = Math.max(smooth(0.86, 0.7, ny + n2 * 0.03), smooth(27, 40, h + n1 * 5) * 0.75);
    r.copy(TC.rock).lerp(TC.rock2, smooth(-0.5, 0.5, n2));
    c.lerp(r, rockT);
    const snowT = smooth(45, 51, h + n1 * 4) * smooth(0.55, 0.8, ny);
    c.lerp(TC.snow, snowT);
    const pT = (1 - smooth(1.2, 2.7, pd + n2 * 0.4)) * (1 - rockT) * smooth(1.4, 2.4, h);
    c.lerp(TC.dirt, pT * 0.8);
    const fl = flatInfluence(x, z);
    c.lerp(TC.plaza, fl * 0.55);
    const v = 0.94 + n2 * 0.06;
    TCOL[k * 3] = c.r * v; TCOL[k * 3 + 1] = c.g * v; TCOL[k * 3 + 2] = c.b * v;
    GD[k] = gT * (1 - rockT) * (1 - snowT) * (1 - pT) * (1 - fl) * smooth(1.9, 2.8, h) * (0.5 + 0.5 * smooth(-0.5, 0.4, n1)) * (h < 38 ? 1 : 0);
  }
}

function sampleGrid(arr, x, z) {
  const fx = clamp((x + HALF) / STEP, 0, RES - 0.001), fz = clamp((z + HALF) / STEP, 0, RES - 0.001);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const a = arr[j * V + i], b = arr[j * V + i + 1], c = arr[(j + 1) * V + i], d = arr[(j + 1) * V + i + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
// Exact height on the rendered triangle mesh
function terrainHeight(x, z) {
  const fx = (x + HALF) / STEP, fz = (z + HALF) / STEP;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= RES || j >= RES) return -14;
  const tx = fx - i, tz = fz - j;
  const ha = H[j * V + i], hb = H[(j + 1) * V + i], hc = H[(j + 1) * V + i + 1], hd = H[j * V + i + 1];
  if (tx + tz <= 1) return ha + (hd - ha) * tx + (hb - ha) * tz;
  return hc + (hb - hc) * (1 - tx) + (hd - hc) * (1 - tz);
}
const PLATFORMS = [];
function groundAt(x, z) {
  let h = terrainHeight(x, z);
  for (const p of PLATFORMS) {
    if (p.top <= h) continue;
    if (p.r !== undefined) { if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) h = p.top; }
    else if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) h = p.top;
  }
  return h;
}

// =====================================================================
//  Colliders (spatial hash)
// =====================================================================
const COLS = new Map();
const CELL = 8;
function addCollider(x, z, r) {
  const c = { x, z, r };
  const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = i * 10007 + j;
    if (!COLS.has(k)) COLS.set(k, []);
    COLS.get(k).push(c);
  }
}
function collidersAt(x, z) { return COLS.get(Math.floor(x / CELL) * 10007 + Math.floor(z / CELL)) || []; }
function blocked(x, z, r) {
  for (const c of collidersAt(x, z)) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return true;
  return false;
}

// =====================================================================
//  Terrain mesh
// =====================================================================
let HEIGHT_TEX;
const TERRAIN_U = { uMacro: { value: null }, uCaus: { value: null }, uTime: G.time };
function buildTerrain() {
  const pos = new Float32Array(V * V * 3), nrm = new Float32Array(V * V * 3), uv = new Float32Array(V * V * 2);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const k = j * V + i, x = gx(i), z = gx(j);
    pos[k * 3] = x; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = z;
    nrm[k * 3] = NX[k]; nrm[k * 3 + 1] = NY[k]; nrm[k * 3 + 2] = NZ[k];
    uv[k * 2] = x * 0.22; uv[k * 2 + 1] = z * 0.22;
  }
  const idx = new Uint32Array(RES * RES * 6);
  let n = 0;
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const a = j * V + i, b = (j + 1) * V + i, c = (j + 1) * V + i + 1, d = j * V + i + 1;
    idx[n++] = a; idx[n++] = b; idx[n++] = d; idx[n++] = b; idx[n++] = c; idx[n++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(TCOL, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  TERRAIN_U.uMacro.value = TEX.macro; TERRAIN_U.uCaus.value = TEX.caustic;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.groundC, normalMap: TEX.groundN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.93, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TERRAIN_U);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP; uniform sampler2D uMacro; uniform sampler2D uCaus; uniform float uTime;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float mac = texture2D(uMacro, vWP.xz * 0.0045).r;
        float mac2 = texture2D(uMacro, vWP.xz * 0.033 + 0.37).r;
        diffuseColor.rgb *= (0.8 + mac * 0.38) * (0.9 + mac2 * 0.2);
        float uw = smoothstep(0.25, -0.7, vWP.y);
        if (uw > 0.0) {
          float c1 = texture2D(uCaus, vWP.xz * 0.085 + vec2(uTime * 0.031, uTime * 0.017)).r;
          float c2 = texture2D(uCaus, vWP.xz * 0.11 - vec2(uTime * 0.022, -uTime * 0.026)).r;
          float depthFade = 1.0 - smoothstep(-0.5, -8.0, vWP.y) * 0.8;
          diffuseColor.rgb = diffuseColor.rgb * mix(1.0, 0.72, uw) + min(c1, c2) * 1.4 * uw * depthFade * vec3(0.75, 0.95, 1.0);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= mix(1.0, 0.35, smoothstep(1.1, 0.25, vWP.y) * step(-0.2, vWP.y));`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Height + grass density texture for GPU-side placement (grass, fireflies, water depth)
  const hd = new Uint16Array(V * V * 4);
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let k = 0; k < V * V; k++) { hd[k * 4] = toHalf(H[k]); hd[k * 4 + 1] = toHalf(GD[k]); hd[k * 4 + 2] = 0; hd[k * 4 + 3] = toHalf(1); }
  HEIGHT_TEX = new THREE.DataTexture(hd, V, V, THREE.RGBAFormat, THREE.HalfFloatType);
  HEIGHT_TEX.minFilter = HEIGHT_TEX.magFilter = THREE.LinearFilter;
  HEIGHT_TEX.needsUpdate = true;
  return mesh;
}
const HT_U = () => ({ uHeight: { value: HEIGHT_TEX }, uMin: { value: new THREE.Vector2(-HALF, -HALF) }, uStep: { value: STEP }, uTexSize: { value: V } });
const HT_GLSL = `uniform sampler2D uHeight; uniform vec2 uMin; uniform float uStep; uniform float uTexSize;
vec4 hSample(vec2 p) { return texture2D(uHeight, ((p - uMin) / uStep + 0.5) / uTexSize); }`;

// =====================================================================
//  Water
// =====================================================================
const WATER_U = {
  uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
  uSkyCol: { value: new THREE.Color() }, uHorCol: { value: new THREE.Color() },
  uDeep: { value: col('#0d3a4a') }, uShallow: { value: col('#2f9c9a') },
};
function buildWater() {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNormal: { value: TEX.waterN } }]),
    transparent: true, fog: true, depthWrite: false,
    vertexShader: `varying vec3 vWP;
      #include <fog_pars_vertex>
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vWP; uniform float uTime; uniform sampler2D uNormal;
      uniform vec3 uSunDir, uSunCol, uSkyCol, uHorCol, uDeep, uShallow;
      ${HT_GLSL}
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vWP.xz;
        vec3 n1 = texture2D(uNormal, p * 0.031 + vec2(uTime * 0.011, uTime * 0.007)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormal, p * 0.083 + vec2(-uTime * 0.019, uTime * 0.013)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(uNormal, p * 0.009 + vec2(uTime * 0.003, -uTime * 0.005)).xyz * 2.0 - 1.0;
        vec3 tn = vec3(n1.xy + n2.xy * 0.6 + n3.xy * 0.9, 1.0);
        vec3 V = normalize(cameraPosition - vWP);
        float dist = length(cameraPosition - vWP);
        tn.xy *= 0.32 * (1.0 - smoothstep(60.0, 400.0, dist) * 0.7);
        vec3 N = normalize(vec3(tn.x, tn.z, tn.y));
        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 Rf = reflect(-V, N);
        vec3 sky = mix(uHorCol, uSkyCol, smoothstep(0.0, 0.45, Rf.y));
        float sd = max(dot(Rf, uSunDir), 0.0);
        vec3 spec = uSunCol * (pow(sd, 600.0) * 9.0 + pow(sd, 60.0) * 0.35);
        float th = hSample(p).r;
        float depth = max(-th, 0.0);
        vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 7.0, depth));
        float sss = pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.25;
        water += uShallow * sss;
        vec3 colr = mix(water * (0.35 + 0.65 * max(uSunDir.y, 0.2)), sky, fres) + spec;
        float fn = texture2D(uNormal, p * 0.21 + uTime * 0.025).r;
        float shore = 1.0 - smoothstep(0.0, 1.6, depth);
        float waves = sin(depth * 5.0 - uTime * 1.6 + fn * 5.0) * 0.5 + 0.5;
        float foam = shore * smoothstep(0.62, 0.95, waves * 0.7 + fn * 0.5) + smoothstep(0.3, 0.0, depth) * (0.6 + 0.4 * fn);
        foam = clamp(foam, 0.0, 1.0);
        colr = mix(colr, vec3(0.95, 0.97, 1.0) * (0.45 + 0.55 * max(uSunDir.y, 0.25)), foam * 0.85);
        float alpha = mix(0.45, 0.95, smoothstep(0.0, 3.5, depth));
        alpha = max(max(alpha, fres), foam);
        gl_FragColor = vec4(colr, alpha);
        #include <fog_fragment>
      }`,
  });
  Object.assign(mat.uniforms, WATER_U, HT_U(), { uTime: G.time });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800, 1, 1), mat);
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 2;
  scene.add(water);
  return water;
}

// =====================================================================
//  Sky, sun & atmosphere
// =====================================================================
const sky = new Sky();
sky.scale.setScalar(1200);
scene.add(sky);
const SKY_U = sky.material.uniforms;
SKY_U.uFogColor = { value: new THREE.Color() };
SKY_U.uFogAmt = { value: 1 };
SKY_U.uCloud = { value: null };
SKY_U.uCloudAmt = { value: 0.6 };
SKY_U.uSkyGain = { value: 1 };
SKY_U.uGlowCol = { value: new THREE.Color() };
SKY_U.uTime = G.time;
sky.material.fragmentShader = sky.material.fragmentShader
  .replace('void main() {', 'uniform vec3 uFogColor; uniform float uFogAmt; uniform sampler2D uCloud; uniform float uTime; uniform float uCloudAmt; uniform float uSkyGain; uniform vec3 uGlowCol;\nvoid main() {')
  .replace('gl_FragColor = vec4( retColor, 1.0 );', `
    if (direction.y > 0.0) {
      vec2 cuv = direction.xz / (direction.y + 0.12) * 0.2;
      float c1 = texture2D(uCloud, cuv + vec2(uTime * 0.0035, uTime * 0.0018)).r;
      float c2 = texture2D(uCloud, cuv * 2.9 - vec2(uTime * 0.006, 0.0)).r;
      float cd = smoothstep(0.5, 0.8, c1 * 0.78 + c2 * 0.32) * uCloudAmt * smoothstep(0.0, 0.16, direction.y);
      float lum = dot(retColor, vec3(0.3, 0.5, 0.2));
      float fwd = pow(max(dot(direction, vSunDirection), 0.0), 5.0);
      vec3 shade = vec3(lum) * 0.6 + retColor * 0.2;
      vec3 lit = retColor * 1.15 + vec3(1.0, 0.62, 0.36) * fwd * (0.6 + lum);
      vec3 cloudCol = mix(shade, lit, smoothstep(0.35, 0.75, c2));
      retColor = mix(retColor, cloudCol, cd);
    }
    retColor *= uSkyGain;
    float hz = 1.0 - smoothstep(-0.03, 0.2, direction.y);
    float glowAmt = pow(max(dot(normalize(vec3(direction.x, 0.0, direction.z)), normalize(vec3(vSunDirection.x, 0.0, vSunDirection.z))), 0.0), 6.0);
    vec3 hzCol = uFogColor + uGlowCol * glowAmt * (1.0 - smoothstep(0.0, 0.35, abs(direction.y)));
    retColor += uGlowCol * glowAmt * 0.6 * (1.0 - smoothstep(0.0, 0.3, direction.y)) * uFogAmt;
    retColor = mix(retColor, hzCol, hz * uFogAmt);
    gl_FragColor = vec4( retColor, 1.0 );`);

const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.6);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -42; sunLight.shadow.camera.right = 42;
sunLight.shadow.camera.top = 42; sunLight.shadow.camera.bottom = -42;
sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 320;
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.05;
scene.add(sunLight, sunLight.target);

const ATM = [
  { skyG: 0.42, elev: 3, fog: 0.0135, mist: 0.55, fogCol: '#5f6084', sun: '#ff9862', sunI: 2.2, sky: '#6f78a8', gnd: '#3a3024', hemiI: 0.75, expo: 1.15, cloud: 0.75, sat: 0.9, turb: 6, ray: 2.6 },
  { skyG: 0.46, elev: 5, fog: 0.0115, mist: 0.46, fogCol: '#6d6a8a', sun: '#ffa36a', sunI: 2.4, sky: '#7a82ae', gnd: '#3c3226', hemiI: 0.78, expo: 1.1, cloud: 0.7, sat: 0.94, turb: 5.5, ray: 2.4 },
  { skyG: 0.48, elev: 8, fog: 0.0096, mist: 0.38, fogCol: '#857f9c', sun: '#ffb27a', sunI: 2.6, sky: '#8790b6', gnd: '#40362a', hemiI: 0.8, expo: 1.03, cloud: 0.65, sat: 0.98, turb: 5, ray: 2.2 },
  { skyG: 0.5, elev: 12, fog: 0.0079, mist: 0.3, fogCol: '#a097aa', sun: '#ffc48e', sunI: 2.8, sky: '#93a3c4', gnd: '#463b2d', hemiI: 0.82, expo: 0.97, cloud: 0.6, sat: 1.0, turb: 4.5, ray: 2.0 },
  { skyG: 0.5, elev: 17, fog: 0.0063, mist: 0.18, fogCol: '#a7a9b6', sun: '#ffd6a6', sunI: 3.0, sky: '#9fb4d2', gnd: '#4a3f30', hemiI: 0.85, expo: 0.86, cloud: 0.55, sat: 1.02, turb: 4, ray: 1.8 },
  { skyG: 0.48, elev: 23, fog: 0.0048, mist: 0.1, fogCol: '#a6b4c2', sun: '#ffe4c0', sunI: 3.2, sky: '#a9c2de', gnd: '#4e4332', hemiI: 0.88, expo: 0.8, cloud: 0.5, sat: 1.04, turb: 3.5, ray: 1.6 },
  { skyG: 0.46, elev: 32, fog: 0.0032, mist: 0.04, fogCol: '#a3b9cc', sun: '#fff0dc', sunI: 3.4, sky: '#b3cde8', gnd: '#524634', hemiI: 0.9, expo: 0.74, cloud: 0.45, sat: 1.06, turb: 3, ray: 1.4 },
].map((s) => ({ ...s, fogCol: col(s.fogCol), sun: col(s.sun), sky: col(s.sky), gnd: col(s.gnd) }));
const atm = { t: 0, target: 0, envT: -99, envTimer: 0, cur: { fogCol: new THREE.Color(), sun: new THREE.Color(), sky: new THREE.Color(), gnd: new THREE.Color() } };
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new THREE.Mesh(sky.geometry, sky.material);
envSky.scale.setScalar(100);
envScene.add(envSky);
let envRT = null;
function updateEnv() {
  const rt = pmrem.fromScene(envScene, 0, 0.1, 1000);
  if (envRT) envRT.dispose();
  envRT = rt;
  scene.environment = rt.texture;
}
scene.environmentIntensity = 0.55;
const GRADE = { sat: 1, expo: 1 };
function applyAtmosphere(dt) {
  atm.t = damp(atm.t, atm.target, 0.6, dt);
  if (Math.abs(atm.t - atm.target) < 0.002) atm.t = atm.target;
  const i0 = Math.floor(atm.t), i1 = Math.min(i0 + 1, ATM.length - 1), f = atm.t - i0;
  const a = ATM[i0], b = ATM[i1], c = atm.cur;
  const L = (k) => lerp(a[k], b[k], f);
  const elev = L('elev'), az = 208;
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(az));
  lightDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(elev, 20)), THREE.MathUtils.degToRad(az));
  SKY_U.sunPosition.value.copy(sunDir);
  SKY_U.turbidity.value = L('turb'); SKY_U.rayleigh.value = L('ray');
  SKY_U.mieCoefficient.value = 0.0038; SKY_U.mieDirectionalG.value = 0.8;
  SKY_U.uCloudAmt.value = L('cloud');
  SKY_U.uSkyGain.value = L('skyG');
  SKY_U.uGlowCol.value.copy(c.sun).multiplyScalar(clamp(0.55 - L('elev') / 60, 0.05, 0.5));
  c.fogCol.copy(a.fogCol).lerp(b.fogCol, f);
  c.sun.copy(a.sun).lerp(b.sun, f);
  c.sky.copy(a.sky).lerp(b.sky, f);
  c.gnd.copy(a.gnd).lerp(b.gnd, f);
  scene.fog.color.copy(c.fogCol);
  scene.fog.near = L('fog');
  scene.fog.far = L('mist');
  SKY_U.uFogColor.value.copy(c.fogCol);
  SKY_U.uFogAmt.value = clamp(L('fog') * 75, 0.25, 1);
  hemi.color.copy(c.sky); hemi.groundColor.copy(c.gnd); hemi.intensity = L('hemiI');
  sunLight.color.copy(c.sun); sunLight.intensity = L('sunI');
  renderer.toneMappingExposure = L('expo');
  GRADE.sat = L('sat');
  WATER_U.uSunDir.value.copy(sunDir);
  WATER_U.uSunCol.value.copy(c.sun).multiplyScalar(L('sunI') * 0.6);
  WATER_U.uSkyCol.value.copy(c.sky).multiplyScalar(0.9);
  WATER_U.uHorCol.value.copy(c.fogCol);
  atm.envTimer -= dt;
  if (Math.abs(atm.t - atm.envT) > 0.04 && atm.envTimer <= 0) { updateEnv(); atm.envT = atm.t; atm.envTimer = 0.5; }
}

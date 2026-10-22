
// =====================================================================
//  Geometry helpers
// =====================================================================
function paint(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const arr = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(c, p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0, i);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function strip(geo, keepUv = false) {
  if (!keepUv) geo.deleteAttribute('uv');
  if (geo.attributes.uv1) geo.deleteAttribute('uv1');
  return geo.index ? geo : mergeVertices(geo);
}
function blob(radius, detail, seed, amp) {
  let g = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + (fbm3(x * 1.6 / radius + seed, y * 1.6 / radius, z * 1.6 / radius, seed | 0, 3) - 0.5) * amp;
    p.setXYZ(i, x * d, y * d, z * d);
  }
  g.computeVertexNormals();
  return g;
}

// Wind sway injected into standard + depth materials; foliage also gets leaf-cluster detail
// and a dithered cut-out where it sits between the camera and the player.
const OCCLUDE_U = { uFocus: { value: new THREE.Vector3(0, -999, 0) } };
const BAYER_GLSL = `float bayer4(vec2 p) { ivec2 i = ivec2(mod(p, 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[i.x + i.y * 4] + 0.5) / 16.0; }
float occlusionFade(vec3 wp, vec3 focus) {
  if (focus.y < -500.0) return 1.0;
  vec3 toP = focus - cameraPosition; float L = length(toP); vec3 dir = toP / max(L, 1e-3);
  vec3 rel = wp - cameraPosition; float t = dot(rel, dir);
  if (t <= 0.0 || t >= L - 0.6) return 1.0;
  return smoothstep(0.9, 2.6, length(rel - dir * t));
}
`;
function windPatch(mat, k, key, leaf = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = G.time;
    sh.uniforms.uLeaf = { value: TEX.leaf };
    sh.uniforms.uFocus = OCCLUDE_U.uFocus;
    sh.vertexShader = 'uniform float uTime; varying vec3 vObjP; varying vec3 vObjN; varying vec3 vOccW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vObjP = position; vObjN = normal;
      {
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float hh = max(position.y - 1.0, 0.0);
        float ph = ip.x * 0.071 + ip.z * 0.053;
        float w = sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.7) * 0.25 + sin(uTime * 6.0 + position.x * 3.0 + position.z * 2.0) * 0.05;
        transformed.x += w * hh * hh * ${k.toFixed(5)};
        transformed.z += cos(uTime * 1.1 + ph * 1.3) * 0.45 * hh * hh * ${k.toFixed(5)};
        vec4 ow = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          ow = instanceMatrix * ow;
        #endif
        vOccW = (modelMatrix * ow).xyz;
      }`);
    if (leaf && sh.fragmentShader.includes('#include <color_fragment>')) {
      sh.fragmentShader = 'uniform sampler2D uLeaf; uniform vec3 uFocus; varying vec3 vObjP; varying vec3 vObjN; varying vec3 vOccW;\n' + BAYER_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if (occlusionFade(vOccW, uFocus) < bayer4(gl_FragCoord.xy)) discard;
        {
          vec3 bl = pow(abs(vObjN), vec3(3.0)); bl /= dot(bl, vec3(1.0));
          vec3 lp = vObjP * 0.9;
          float lf = texture2D(uLeaf, lp.yz).r * bl.x + texture2D(uLeaf, lp.xz).r * bl.y + texture2D(uLeaf, lp.xy).r * bl.z;
          float lf2 = texture2D(uLeaf, vObjP.xz * 0.23 + vObjP.y * 0.11).r;
          float trunkMask = smoothstep(1.6, 2.6, vObjP.y);
          diffuseColor.rgb *= mix(1.0, (0.35 + lf * 1.05) * (0.85 + lf2 * 0.3), trunkMask);
        }`);
    }
  };
  mat.customProgramCacheKey = () => key + (leaf ? 'L' : '');
  return mat;
}
function windDepth(k, key) {
  return windPatch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), k, key + '-d');
}

// Triplanar stone (world-space) with moss on upward faces
function stoneMaterial(color, { moss = 0.6, scale = 0.35, rough = 0.9 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, vertexColors: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uStone = { value: TEX.stoneC };
    sh.uniforms.uMacro = { value: TEX.macro };
    sh.vertexShader = 'varying vec3 vTP; varying vec3 vTN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 tp = vec4(transformed, 1.0);
        vec3 tnn = objectNormal;
        #ifdef USE_INSTANCING
          tp = instanceMatrix * tp; tnn = mat3(instanceMatrix) * tnn;
        #endif
        vTP = (modelMatrix * tp).xyz; vTN = normalize(mat3(modelMatrix) * tnn);
      }`);
    sh.fragmentShader = 'varying vec3 vTP; varying vec3 vTN; uniform sampler2D uStone; uniform sampler2D uMacro;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      {
        vec3 bl = pow(abs(vTN), vec3(4.0)); bl /= dot(bl, vec3(1.0));
        float s = ${scale.toFixed(3)};
        vec3 tx = texture2D(uStone, vTP.yz * s).rgb * bl.x + texture2D(uStone, vTP.xz * s).rgb * bl.y + texture2D(uStone, vTP.xy * s).rgb * bl.z;
        diffuseColor.rgb *= tx * 1.25;
        float mn = texture2D(uMacro, vTP.xz * 0.08).r;
        float mossT = smoothstep(0.45, 0.85, vTN.y + (mn - 0.5) * 0.6) * ${moss.toFixed(2)};
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.27, 0.1) * (0.7 + mn * 0.6), mossT);
      }`);
  };
  m.customProgramCacheKey = () => 'stone' + scale + moss;
  return m;
}

function instanced(geo, mat, list, { cast = true, recv = true, depth = null } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const d = new THREE.Object3D();
  list.forEach((t, i) => {
    d.position.set(t.x, t.y, t.z);
    d.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
    if (t.sx !== undefined) d.scale.set(t.sx, t.sy, t.sz); else d.scale.setScalar(t.s || 1);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
    if (t.c) m.setColorAt(i, t.c);
  });
  m.count = list.length;
  m.castShadow = cast; m.receiveShadow = recv;
  if (depth) m.customDepthMaterial = depth;
  m.computeBoundingSphere();
  scene.add(m);
  return m;
}

// =====================================================================
//  Trees & plants
// =====================================================================
function pineGeo(seed) {
  const r = mulberry32(seed);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.09, 0.27, 3.6, 7, 3);
  trunk.translate(0, 1.8, 0);
  const brown = col('#4b3424');
  parts.push(paint(strip(trunk), (c, x, y) => c.copy(brown).multiplyScalar(0.7 + y * 0.08)));
  const dark = col('#173d26'), mid = col('#2e5a33'), tip = col('#5b8243');
  const tiers = 5;
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1);
    const rad = lerp(2.4, 0.75, t) * (0.9 + r() * 0.2), hh = lerp(2.3, 1.5, t), y = 1.5 + k * 1.05;
    const cone = new THREE.ConeGeometry(rad, hh, 12, 3, false);
    const p = cone.attributes.position;
    for (let v = 0; v < p.count; v++) {
      let x = p.getX(v), yy = p.getY(v), z = p.getZ(v);
      const rr = Math.hypot(x, z);
      if (rr > 0.01) {
        const a = Math.atan2(z, x);
        const jag = 1 + 0.2 * Math.sin(a * 5 + k * 1.7) + 0.09 * Math.sin(a * 13 + yy * 3 + k);
        x *= jag; z *= jag;
        if (yy < 0) yy -= rr * 0.22;
      }
      p.setXYZ(v, x, yy, z);
    }
    cone.translate(0, y + hh / 2, 0);
    cone.computeVertexNormals();
    paint(strip(cone), (c, x, yy, z) => {
      const rr = Math.hypot(x, z) / rad;
      const local = clamp((yy - y) / hh, 0, 1);
      c.copy(dark).lerp(mid, clamp(rr * 0.9 + local * 0.3, 0, 1)).lerp(tip, clamp(rr - 0.55, 0, 1) * 0.8 + t * 0.15);
    });
    parts.push(cone);
  }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}
function broadleafGeo(seed, pal) {
  const r = mulberry32(seed);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.17, 0.36, 3.2, 8, 5);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setX(i, tp.getX(i) + Math.sin(tp.getY(i) * 0.9 + seed) * 0.12);
  trunk.translate(0, 1.6, 0);
  trunk.computeVertexNormals();
  const bark = col(pal.bark);
  parts.push(paint(strip(trunk), (c, x, y) => c.copy(bark).multiplyScalar(0.65 + y * 0.08)));
  for (let b = 0; b < 3; b++) {
    const br = new THREE.CylinderGeometry(0.05, 0.12, 1.7, 5, 1);
    br.translate(0, 0.85, 0);
    br.rotateZ(0.85 + r() * 0.3);
    br.rotateY((b / 3) * TAU + r());
    br.translate(0, 2.5 + r() * 0.4, 0);
    parts.push(paint(strip(br), (c) => c.copy(bark).multiplyScalar(0.8)));
  }
  const dark = col(pal.dark), light = col(pal.light), center = new THREE.Vector3(0, 4.4, 0);
  const n = 6 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + r() * 0.5, d = k === 0 ? 0 : 1.1 + r() * 0.5;
    const rad = k === 0 ? 1.9 : 1.15 + r() * 0.5;
    const g = blob(rad, 2, seed * 7 + k * 3.1, 0.55);
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 4.3 + (k === 0 ? 0.6 : (r() - 0.4) * 1.2);
    g.translate(cx, cy, cz);
    const p = g.attributes.position, nn = g.attributes.normal, v3 = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v3.set(p.getX(i), p.getY(i), p.getZ(i)).sub(center).normalize();
      nv.set(nn.getX(i), nn.getY(i), nn.getZ(i)).lerp(v3, 0.8).normalize();
      nn.setXYZ(i, nv.x, nv.y, nv.z);
    }
    paint(g, (c, x, y, z) => {
      const up = clamp((y - 3.0) / 3.2, 0, 1);
      const out = clamp(Math.hypot(x, z) / 3.0, 0, 1);
      const jit = hash3(Math.floor(x * 4), Math.floor(y * 4), Math.floor(z * 4), seed) * 0.25;
      c.copy(dark).lerp(light, clamp(up * 0.7 + out * 0.35 + jit - 0.1, 0, 1));
    });
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}
function bushGeo(seed) {
  const r = mulberry32(seed);
  const parts = [], dark = col('#24451f'), light = col('#6b8f3e');
  for (let k = 0; k < 4; k++) {
    const rad = 0.55 + r() * 0.35;
    const g = blob(rad, 1, seed * 3 + k, 0.5);
    g.translate((r() - 0.5) * 1.1, rad * 0.6, (r() - 0.5) * 1.1);
    paint(g, (c, x, y) => c.copy(dark).lerp(light, clamp(y / 1.3, 0, 1)));
    parts.push(g);
  }
  return mergeGeometries(parts);
}
function rockGeo(seed, detail = 3) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const r = mulberry32(seed);
  const planes = [];
  for (let k = 0; k < 7; k++) {
    const v = new THREE.Vector3(r() - 0.5, (r() - 0.3) * 0.8, r() - 0.5).normalize();
    planes.push([v, 0.62 + r() * 0.22]);
  }
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const n = fbm3(v.x * 1.5 + seed, v.y * 1.5, v.z * 1.5, seed, 4);
    v.multiplyScalar(0.72 + n * 0.55);
    for (const [pn, pd] of planes) { const d = v.dot(pn); if (d > pd) v.addScaledVector(pn, (pd - d) * 0.85); }
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.25;
    p.setXYZ(i, v.x * 1.25, v.y * 0.85, v.z);
  }
  g.computeVertexNormals();
  paint(g, (c, x, y, z) => {
    const ao = 0.62 + 0.38 * fbm3(x * 2 + 9, y * 2, z * 2, seed + 5, 2) + clamp(y, -0.3, 0.6) * 0.25;
    c.setRGB(ao, ao, ao);
  });
  return g;
}
function flowerGeo() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.007, 0.01, 0.2, 3, 1);
  stem.translate(0, 0.1, 0);
  parts.push(paint(strip(stem), (c) => c.set('#355f22')));
  for (let k = 0; k < 5; k++) {
    const pet = new THREE.CircleGeometry(0.06, 6);
    pet.scale(0.75, 1.2, 1);
    pet.translate(0, 0.065, 0);
    pet.rotateX(-1.2);
    pet.rotateY((k / 5) * TAU);
    pet.translate(0, 0.2, 0);
    parts.push(paint(strip(pet), (c) => c.setRGB(1, 1, 1)));
  }
  const ctr = new THREE.SphereGeometry(0.028, 6, 4);
  ctr.translate(0, 0.21, 0);
  parts.push(paint(strip(ctr), (c) => c.set('#ffd34d')));
  return mergeGeometries(parts);
}

const NEAR_POIS = () => [CAMP, LIGHTHOUSE, ...SHRINES];
function nearPOI(x, z, extra) {
  for (const p of NEAR_POIS()) { const r = (p === LIGHTHOUSE ? 16 : p === CAMP ? 14 : 11) + extra; if ((x - p.x) ** 2 + (z - p.z) ** 2 < r * r) return true; }
  return false;
}

function buildVegetation() {
  const k = IS_MOBILE ? 0.65 : 1;
  const pines = [], oaks = [], blossoms = [], bushes = [], rocks = [[], [], []], flowers = [];
  const tint = (base, v) => new THREE.Color(base).multiplyScalar(1 - v / 2 + rnd() * v);
  let tries = 0;
  while (tries++ < 30000 && (pines.length < 280 * k || oaks.length < 170 * k)) {
    const x = R(-190, 190), z = R(-190, 190);
    const h = terrainHeight(x, z), ny = sampleGrid(NY, x, z), pd = sampleGrid(PD, x, z);
    if (h < 2.8 || h > 43 || ny < 0.8 || pd < 3.4 || nearPOI(x, z, 0)) continue;
    const fm = forestMask(x, z);
    if (rnd() > 0.1 + fm * 0.9) continue;
    const pine = h > 20 || (fm > 0.5 && rnd() < 0.65) || rnd() < 0.25;
    const s = R(0.8, 1.35) * (pine ? 1 : 1.05);
    if (blocked(x, z, 1.6 * s)) continue;
    const t = { x, y: h - 0.15, z, ry: R(0, TAU), s, c: tint(0xffffff, 0.25), variant: Math.floor(rnd() * 2) };
    if (pine) { if (pines.length < 280 * k) { pines.push(t); addCollider(x, z, 0.35 * s); } }
    else if (oaks.length < 170 * k) { oaks.push(t); addCollider(x, z, 0.4 * s); }
  }
  // Blossom trees as landmarks around shrines and camp
  for (const p of [CAMP, ...SHRINES]) {
    for (let n = 0; n < 4; n++) {
      const a = R(0, TAU), d = R(12, 17), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const h = terrainHeight(x, z);
      if (h < 2.5 || sampleGrid(PD, x, z) < 3 || blocked(x, z, 2)) continue;
      blossoms.push({ x, y: h - 0.15, z, ry: R(0, TAU), s: R(0.85, 1.1), c: tint(0xffffff, 0.15) });
      addCollider(x, z, 0.4);
    }
  }
  tries = 0;
  while (tries++ < 9000 && bushes.length < 300 * k) {
    const x = R(-185, 185), z = R(-185, 185);
    const h = terrainHeight(x, z);
    if (h < 2.4 || h > 36 || sampleGrid(NY, x, z) < 0.8 || sampleGrid(PD, x, z) < 2.2 || nearPOI(x, z, -4) || blocked(x, z, 0.8)) continue;
    if (rnd() > 0.25 + forestMask(x, z) * 0.75) continue;
    bushes.push({ x, y: h - 0.1, z, ry: R(0, TAU), s: R(0.6, 1.2), c: tint(0xffffff, 0.35) });
  }
  tries = 0;
  while (tries++ < 9000 && rocks[0].length + rocks[1].length + rocks[2].length < 150 * k) {
    const x = R(-195, 195), z = R(-195, 195);
    const h = terrainHeight(x, z), ny = sampleGrid(NY, x, z);
    if (h < -3 || sampleGrid(PD, x, z) < 2.5 || nearPOI(x, z, -3)) continue;
    const want = (1 - ny) * 3 + (h > 22 ? 0.5 : 0) + (h < 1.5 ? 0.25 : 0.05);
    if (rnd() > want) continue;
    const s = R(0.5, 1.6) * (h > 22 ? 1.6 : 1);
    if (blocked(x, z, s)) continue;
    rocks[Math.floor(rnd() * 3)].push({ x, y: h - 0.2 * s, z, ry: R(0, TAU), rx: R(-0.15, 0.15), sx: s * R(0.8, 1.3), sy: s * R(0.7, 1.1), sz: s * R(0.8, 1.2) });
    addCollider(x, z, s * 0.95);
  }
  // Sea stacks
  for (let n = 0; n < 14; n++) {
    const a = R(0, TAU);
    for (let d = 140; d < 230; d += 2) {
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (terrainHeight(x, z) < -3.5) { const s = R(2.5, 5); rocks[n % 3].push({ x, y: terrainHeight(x, z) + s * 0.4, z, ry: R(0, TAU), sx: s, sy: s * R(1.2, 2.2), sz: s }); break; }
    }
  }
  tries = 0;
  const fcol = ['#ffffff', '#ffd84a', '#f59ac2', '#b892ff', '#7fb2ff', '#ff8b5c'].map(col);
  while (tries++ < 20000 && flowers.length < 1600 * k) {
    const x = R(-180, 180), z = R(-180, 180);
    const gd = sampleGrid(GD, x, z);
    if (gd < 0.35 || rnd() > gd * (1 - forestMask(x, z) * 0.8)) continue;
    const cl = fcol[Math.floor((nA(x * 0.05, z * 0.05) * 0.5 + 0.5) * fcol.length) % fcol.length];
    flowers.push({ x, y: terrainHeight(x, z) - 0.02, z, ry: R(0, TAU), s: R(0.7, 1.3), c: cl.clone().multiplyScalar(R(0.8, 1.1)) });
  }

  const pineMat = windPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), 0.0035, 'pine', true);
  const oakMat = windPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }), 0.006, 'oak', true);
  const bushMat = windPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), 0.0, 'bush', true);
  const pineGeos = [pineGeo(1), pineGeo(2)];
  const oakGeos = [broadleafGeo(3, { bark: '#4f3b2c', dark: '#1d3f1f', light: '#6c9a3c' }), broadleafGeo(4, { bark: '#5a4636', dark: '#26461c', light: '#86a042' })];
  const blossomGeo = broadleafGeo(5, { bark: '#3e2c26', dark: '#b8657e', light: '#ffd3e2' });
  [0, 1].forEach((v) => {
    instanced(pineGeos[v], pineMat, pines.filter((t) => t.variant === v), { depth: windDepth(0.0035, 'pine') });
    instanced(oakGeos[v], oakMat, oaks.filter((t) => t.variant === v), { depth: windDepth(0.006, 'oak') });
  });
  instanced(blossomGeo, oakMat, blossoms, { depth: windDepth(0.006, 'oak') });
  instanced(bushGeo(9), bushMat, bushes, { cast: true });
  const stone = stoneMaterial(col('#8f877c'), { moss: 0.75, scale: 0.5 });
  stone.vertexColors = true;
  const rgeos = [rockGeo(11), rockGeo(12), rockGeo(13)];
  rocks.forEach((list, i) => instanced(rgeos[i], stone, list));
  const fm = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  instanced(flowerGeo(), fm, flowers, { cast: false });
  return { blossoms };
}

// =====================================================================
//  GPU grass that follows the player
// =====================================================================
const GRASS_U = { uPlayer: { value: new THREE.Vector3() }, uR: { value: GRASS_R }, uTime: G.time, uBase: { value: col('#3d6528') }, uTip: { value: col('#a2c65a') }, uDry: { value: col('#b9b26a') } };
let grassMesh;
function buildGrass() {
  const seg = 4, w = 0.05;
  const pos = [], uvs = [], idx = [];
  for (let s = 0; s < seg; s++) {
    const y = s / seg, hw = w * Math.pow(1 - y, 0.75);
    pos.push(-hw, y, y * y * 0.18, hw, y, y * y * 0.18);
    uvs.push(0, y, 1, y);
  }
  pos.push(0, 1, 0.18); uvs.push(0.5, 1);
  for (let s = 0; s < seg - 1; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  idx.push((seg - 1) * 2, (seg - 1) * 2 + 1, seg * 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(idx);
  const off = new Float32Array(GRASS_MAX * 4);
  const r = mulberry32(777);
  for (let i = 0; i < GRASS_MAX; i++) {
    off[i * 4] = (r() * 2 - 1) * GRASS_R; off[i * 4 + 1] = (r() * 2 - 1) * GRASS_R;
    off[i * 4 + 2] = r(); off[i * 4 + 3] = r();
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = Math.floor(GRASS_MAX * Q.grass);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GRASS_U, HT_U());
    sh.vertexShader = `attribute vec4 aOff; uniform vec3 uPlayer; uniform float uR; uniform float uTime;
      ${HT_GLSL}
      varying float vGT; varying float vGV;
      ` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
        vec2 rel = mod(aOff.xy - uPlayer.xz + uR, 2.0 * uR) - uR;
        vec2 wp = uPlayer.xz + rel;
        vec4 hs = hSample(wp);
        float dens = hs.g;
        float edge = 1.0 - smoothstep(0.72, 1.0, length(rel) / uR);
        float sc = step(aOff.z * 0.85, dens) * edge * (0.3 + aOff.w * 0.36) * (0.6 + dens * 0.45);
        float ang = aOff.z * 51.0;
        float ca = cos(ang), sa = sin(ang);
        vec3 p = position;
        p.y *= sc; p.xz *= mix(0.0, 1.0, step(0.001, sc)) * (0.8 + aOff.w * 0.6);
        vec3 bp = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);
        float t = uv.y;
        float gust = sin(uTime * 1.7 + wp.x * 0.12 + wp.y * 0.09) * 0.5 + sin(uTime * 3.1 + wp.x * 0.3) * 0.2 + 0.25;
        bp.x += gust * t * t * 0.32 * sc;
        bp.z += sin(uTime * 2.3 + wp.y * 0.2 + aOff.w * 6.0) * t * t * 0.12 * sc;
        vec2 away = wp - uPlayer.xz; float ad = length(away);
        float push = (1.0 - smoothstep(0.2, 1.4, ad)) * t;
        bp.xz += (away / max(ad, 0.001)) * push * 0.55;
        bp.y -= push * 0.25 * sc;
        vec3 transformed = vec3(wp.x, hs.r - 0.04, wp.y) + bp;
        vGT = t; vGV = aOff.w;
      `);
    sh.fragmentShader = `uniform vec3 uBase; uniform vec3 uTip; uniform vec3 uDry; varying float vGT; varying float vGV;\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 tipc = mix(uTip, uDry, smoothstep(0.75, 1.0, vGV) * 0.5);
        diffuseColor.rgb = mix(uBase, tipc, smoothstep(0.0, 0.9, vGT)) * (0.88 + vGV * 0.24);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vGT * 0.12;`);
  };
  grassMesh = new THREE.Mesh(geo, mat);
  grassMesh.frustumCulled = false;
  grassMesh.receiveShadow = true;
  scene.add(grassMesh);
}

// =====================================================================
//  Structures
// =====================================================================
const MATS = {};
function buildMaterials() {
  MATS.stone = stoneMaterial(col('#b3aa9c'), { moss: 0.55, scale: 0.4 });
  MATS.darkStone = stoneMaterial(col('#7d766e'), { moss: 0.35, scale: 0.4 });
  MATS.wood = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.85, color: col('#c9a27a') });
  MATS.bark = new THREE.MeshStandardMaterial({ map: TEX.barkC, normalMap: TEX.barkN, roughness: 0.9, color: col('#8a6a50') });
  MATS.metal = new THREE.MeshStandardMaterial({ color: col('#3b3633'), metalness: 0.8, roughness: 0.38 });
  MATS.redMetal = new THREE.MeshStandardMaterial({ color: col('#7a1f1c'), metalness: 0.6, roughness: 0.42 });
  MATS.canvas = new THREE.MeshStandardMaterial({ color: col('#d8c8a2'), roughness: 0.9, normalMap: TEX.fabricN, side: THREE.DoubleSide });
  MATS.roof = new THREE.MeshStandardMaterial({ color: col('#b0715c'), roughness: 0.7, map: TEX.wood });
}
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function columnGeo(h, broken, seed) {
  const pts = [[0, 0], [0.62, 0], [0.62, 0.18], [0.52, 0.26], [0.46, 0.38], [0.43, h * 0.5], [0.41, h - 0.42], [0.5, h - 0.3], [0.62, h - 0.16], [0.62, h], [0, h]]
    .map(([a, b]) => new THREE.Vector2(a, b));
  const g = new THREE.LatheGeometry(pts, 16);
  if (broken) {
    const p = g.attributes.position, r = mulberry32(seed);
    for (let i = 0; i < p.count; i++) if (p.getY(i) > h - 0.5) p.setY(i, p.getY(i) - r() * 0.9 - (p.getX(i) > 0 ? 0.4 : 0));
    g.computeVertexNormals();
  }
  return g;
}
const BEAM_MAT = (color, flip = 0) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: col(color) }, uTime: G.time, uI: { value: 0 }, uFlip: { value: flip } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; varying float vF;
    void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vec3 n = normalize(mat3(modelMatrix) * normal);
      vF = abs(dot(n, normalize(cameraPosition - wp.xyz))); gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `varying vec2 vUv; varying float vF; uniform vec3 uColor; uniform float uTime; uniform float uI; uniform float uFlip;
    void main() { float y = mix(vUv.y, 1.0 - vUv.y, uFlip);
      float a = pow(vF, 2.0) * pow(1.0 - y, 1.6) * smoothstep(0.0, 0.02, y);
      a *= 0.75 + 0.25 * sin(y * 60.0 - uTime * 4.0);
      gl_FragColor = vec4(uColor * a * uI, 1.0); }`,
});

const shrineObjs = [];
function buildShrine(s, idx) {
  const g = new THREE.Group();
  g.position.set(s.x, s.h, s.z);
  scene.add(g);
  mesh(new THREE.CylinderGeometry(7.3, 7.8, 0.9, 48, 1), MATS.darkStone, 0, -0.15, 0, g);
  mesh(new THREE.CylinderGeometry(6.3, 6.6, 0.9, 48, 1), MATS.stone, 0, 0.15, 0, g);
  PLATFORMS.push({ x: s.x, z: s.z, r: 7.6, top: s.h + 0.3 }, { x: s.x, z: s.z, r: 6.45, top: s.h + 0.6 });
  const r = mulberry32(idx * 31 + 5);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + idx;
    const broken = k % 3 === 1;
    const h = broken ? 2.0 + r() * 0.8 : 3.4;
    const c = mesh(columnGeo(h, broken, idx * 10 + k), MATS.stone, Math.cos(a) * 5.4, 0.6, Math.sin(a) * 5.4, g);
    c.rotation.z = broken ? (r() - 0.5) * 0.12 : 0;
    addCollider(s.x + Math.cos(a) * 5.4, s.z + Math.sin(a) * 5.4, 0.65);
  }
  for (let k = 0; k < 4; k++) { // fallen blocks
    const a = r() * TAU, d = 8.6 + r() * 2.5;
    const b = mesh(new RoundedBoxGeometry(1.2, 0.6, 0.7, 2, 0.08), MATS.stone, Math.cos(a) * d, terrainHeight(s.x + Math.cos(a) * d, s.z + Math.sin(a) * d) - s.h + 0.2, Math.sin(a) * d, g);
    b.rotation.set(r() * 0.3, r() * TAU, r() * 0.3);
    addCollider(s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, 0.7);
  }
  mesh(new THREE.LatheGeometry([[0, 0], [0.95, 0], [0.95, 0.2], [0.6, 0.35], [0.5, 1.0], [0.75, 1.15], [0.75, 1.3], [0, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)), 20), MATS.stone, 0, 0.6, 0, g);
  addCollider(s.x, s.z, 1.0);
  const rune = new THREE.Mesh(new THREE.CircleGeometry(5.6, 64), new THREE.MeshBasicMaterial({ map: TEX.rune, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: col('#4a4166') }));
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.62;
  g.add(rune);
  const crystalMat = new THREE.MeshStandardMaterial({ color: col('#6b6a86'), emissive: col(s.color), emissiveIntensity: 0.08, roughness: 0.12, metalness: 0.3, flatShading: true });
  const crystal = mesh(new THREE.OctahedronGeometry(0.55, 0), crystalMat, 0, 3.1, 0, g);
  crystal.scale.set(1, 1.8, 1);
  const orbit = new THREE.Group(); orbit.position.y = 3.1; g.add(orbit);
  const rg = rockGeo(idx + 40, 1);
  for (let k = 0; k < 4; k++) {
    const m = mesh(rg, MATS.stone, Math.cos((k / 4) * TAU) * 1.4, Math.sin(k * 2) * 0.3, Math.sin((k / 4) * TAU) * 1.4, orbit);
    m.scale.setScalar(0.18 + (k % 2) * 0.06);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 2.2, 160, 20, 1, true), BEAM_MAT(s.color));
  beam.position.y = 80.6;
  beam.visible = false;
  g.add(beam);
  const o = { s, idx, g, rune, crystal, crystalMat, orbit, beam, lit: false, glow: 0, pulse: 0 };
  shrineObjs.push(o);
  return o;
}

const LH = {};
function buildLighthouse() {
  const L = LIGHTHOUSE, g = new THREE.Group();
  g.position.set(L.x, L.h, L.z);
  scene.add(g);
  mesh(new THREE.CylinderGeometry(5.4, 5.8, 1.4, 40), MATS.darkStone, 0, 0.2, 0, g);
  PLATFORMS.push({ x: L.x, z: L.z, r: 5.7, top: L.h + 0.9 });
  const towerMat = new THREE.MeshStandardMaterial({ map: TEX.lighthouse, roughness: 0.78 });
  mesh(new THREE.CylinderGeometry(2.9, 3.9, 21, 40, 6, true), towerMat, 0, 11.4, 0, g);
  mesh(new THREE.CylinderGeometry(3.9, 3.3, 0.6, 40), MATS.stone, 0, 22.1, 0, g);
  const rail = new THREE.TorusGeometry(3.75, 0.05, 6, 48); rail.rotateX(Math.PI / 2);
  mesh(rail, MATS.metal, 0, 23.3, 0, g);
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 4), MATS.metal, Math.cos(a) * 3.75, 22.85, Math.sin(a) * 3.75, g); }
  mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.5, 24), MATS.redMetal, 0, 22.65, 0, g);
  const glassMat = new THREE.MeshStandardMaterial({ color: col('#1c2430'), roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.45, emissive: col('#ffcf7a'), emissiveIntensity: 0.0 });
  const glass = mesh(new THREE.CylinderGeometry(1.9, 1.9, 2.4, 16, 1, true), glassMat, 0, 24.1, 0, g);
  glass.castShadow = false;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), MATS.redMetal, Math.cos(a) * 1.9, 24.1, Math.sin(a) * 1.9, g); }
  mesh(new THREE.ConeGeometry(2.55, 1.9, 24), MATS.redMetal, 0, 26.25, 0, g);
  mesh(new THREE.SphereGeometry(0.28, 12, 8), MATS.metal, 0, 27.3, 0, g);
  mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4, 4), MATS.metal, 0, 28.0, 0, g);
  const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.2, 0.15) });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), lensMat);
  lens.position.y = 24.1; g.add(lens);
  // door + windows facing south (+z)
  const doorMat = new THREE.MeshStandardMaterial({ color: col('#2a1d16'), roughness: 0.9, emissive: col('#ffb85c'), emissiveIntensity: 0 });
  mesh(new THREE.BoxGeometry(1.6, 2.6, 0.3), doorMat, 0, 2.2, 3.82, g);
  mesh(new THREE.BoxGeometry(2.1, 0.35, 0.5), MATS.stone, 0, 3.6, 3.85, g);
  for (const y of [8, 13.5, 18.5]) { const w = mesh(new THREE.BoxGeometry(0.7, 1.1, 0.2), new THREE.MeshStandardMaterial({ color: col('#141a22'), roughness: 0.2, metalness: 0.5 }), 0, y, 3.9 - (y - 0.9) / 21 + 0.06, g); w.rotation.x = -0.048; }
  addCollider(L.x, L.z, 4.4);
  // beams (revealed in finale)
  const beamGroup = new THREE.Group(); beamGroup.position.y = 24.1; g.add(beamGroup);
  const bm = BEAM_MAT('#ffe2a6', 1);
  for (const s of [1, -1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 110, 24, 1, true), bm);
    cone.rotation.z = (s * Math.PI) / 2;
    cone.position.x = s * 55;
    beamGroup.add(cone);
  }
  beamGroup.visible = false;
  // keeper's cottage
  const cx = L.x + 9, cz = L.z + 5, ch = terrainHeight(cx, cz);
  const cottage = new THREE.Group(); cottage.position.set(cx, ch, cz); cottage.rotation.y = -0.4; scene.add(cottage);
  mesh(new RoundedBoxGeometry(6, 3.2, 4.6, 2, 0.15), MATS.stone, 0, 1.4, 0, cottage);
  const roofShape = new THREE.Shape([new THREE.Vector2(-3.6, 0), new THREE.Vector2(3.6, 0), new THREE.Vector2(0, 2.3)]);
  const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 5.4, bevelEnabled: false });
  roof.translate(0, 0, -2.7); roof.rotateY(Math.PI / 2);
  mesh(roof, MATS.roof, 0, 3.0, 0, cottage);
  const winM = new THREE.MeshStandardMaterial({ color: col('#20160f'), emissive: col('#ffae55'), emissiveIntensity: 0.0 });
  const win = mesh(new THREE.BoxGeometry(0.9, 0.8, 0.1), winM, 3.02, 1.8, 0.8, cottage); win.rotation.y = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), MATS.stone, -1.8, 4.4, 0.8, cottage);
  addCollider(cx, cz, 3.4);
  Object.assign(LH, { g, glassMat, lensMat, doorMat, beamGroup, beamMat: bm, winM, lit: 0, door: new THREE.Vector3(L.x, L.h, L.z + 6.2) });
}

const CAMPFIRE = {};
function buildCamp() {
  const C = CAMP, h = C.h;
  // tent
  const tentShape = new THREE.Shape([new THREE.Vector2(-1.7, 0), new THREE.Vector2(1.7, 0), new THREE.Vector2(0, 2.3)]);
  const tentGeo = new THREE.ExtrudeGeometry(tentShape, { depth: 3.4, bevelEnabled: false });
  tentGeo.translate(0, 0, -1.7);
  const tent = mesh(tentGeo, MATS.canvas, C.x - 5, h, C.z - 3);
  tent.rotation.y = 0.5;
  addCollider(C.x - 5, C.z - 3, 2.0);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.0, 5), MATS.wood, C.x - 5, h + 2.3, C.z - 3).rotation.set(Math.PI / 2, 0, 0.5);
  // fire: logs + stones
  const fire = new THREE.Group(); fire.position.set(C.x, h, C.z); scene.add(fire);
  for (let k = 0; k < 5; k++) {
    const l = mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6), MATS.bark, 0, 0.3, 0, fire);
    l.rotation.set(0.75, (k / 5) * TAU, 0);
    l.position.set(Math.cos((k / 5) * TAU) * 0.22, 0.25, Math.sin((k / 5) * TAU) * 0.22);
  }
  const sg = rockGeo(77, 1);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; const st = mesh(sg, MATS.darkStone, Math.cos(a) * 0.85, 0.05, Math.sin(a) * 0.85, fire); st.scale.set(0.24, 0.2, 0.2); st.rotation.y = a; }
  addCollider(C.x, C.z, 1.0);
  const emb = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.7, 0.15) }));
  emb.rotation.x = -Math.PI / 2; emb.position.y = 0.06; fire.add(emb);
  const light = new THREE.PointLight(0xff8a3c, 18, 22, 1.6);
  light.position.set(C.x, h + 1.2, C.z);
  scene.add(light);
  // log benches
  for (const [dx, dz, ry] of [[2.6, 0.6, 1.4], [-0.6, 2.7, 0.2]]) {
    const b = mesh(new THREE.CylinderGeometry(0.28, 0.3, 2.2, 10), MATS.bark, C.x + dx, h + 0.25, C.z + dz);
    b.rotation.set(0, ry, Math.PI / 2);
    addCollider(C.x + dx, C.z + dz, 0.6);
  }
  // crates & barrel
  const crate = new RoundedBoxGeometry(0.9, 0.9, 0.9, 2, 0.05);
  [[-2.4, -5.6, 0.2], [-1.6, -5.9, 0.9], [-2.0, -5.7, 0, 0.9]].forEach(([dx, dz, ry, y = 0]) => { const c = mesh(crate, MATS.wood, C.x + dx, h + 0.45 + y, C.z + dz); c.rotation.y = ry; });
  addCollider(C.x - 2, C.z - 5.7, 1.1);
  const barrel = new THREE.LatheGeometry([[0, 0], [0.38, 0], [0.45, 0.25], [0.48, 0.5], [0.45, 0.75], [0.38, 1.0], [0, 1.0]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
  mesh(barrel, MATS.wood, C.x + 3.2, h, C.z - 3.2);
  addCollider(C.x + 3.2, C.z - 3.2, 0.55);
  // lamp posts along the camp path
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.8, 0.7) });
  for (const [dx, dz] of [[-4.5, -8], [4.0, 7.5], [10, -6]]) {
    const x = C.x + dx, z = C.z + dz, y = terrainHeight(x, z);
    mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), MATS.wood, x, y + 1.2, z);
    mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), MATS.metal, x, y + 2.5, z);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lampMat); bulb.position.set(x, y + 2.48, z); scene.add(bulb);
    addCollider(x, z, 0.25);
  }
  // pier: find shoreline south of camp
  const px = C.x + 7;
  let zs = C.z;
  while (zs < 200 && terrainHeight(px, zs) > -0.3) zs += 0.5;
  const z0 = zs - 7, z1 = zs + 16, deckY = 0.95;
  const pier = new THREE.Group(); scene.add(pier);
  for (let z = z0; z < z1; z += 0.55) {
    const p = mesh(new THREE.BoxGeometry(2.4, 0.12, 0.48), MATS.wood, px + (hash3(z * 10 | 0, 1, 2, 3) - 0.5) * 0.06, deckY, z, pier);
    p.rotation.y = (hash3(z * 10 | 0, 4, 5, 6) - 0.5) * 0.04;
  }
  for (let z = z0 + 1; z < z1; z += 3) for (const sx of [-1.1, 1.1]) {
    const gh = terrainHeight(px + sx, z);
    const ph = deckY + 0.3 - gh + 0.5;
    mesh(new THREE.CylinderGeometry(0.12, 0.14, ph, 7), MATS.bark, px + sx, gh - 0.5 + ph / 2, z, pier);
    addCollider(px + sx, z, 0.15);
  }
  PLATFORMS.push({ x0: px - 1.2, x1: px + 1.2, z0: z0 - 0.3, z1: z1 - 0.2, top: deckY + 0.06 });
  // boat
  const hull = new THREE.SphereGeometry(1, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2);
  const boat = new THREE.Group(); boat.position.set(px + 2.6, 0.1, z1 - 3); scene.add(boat);
  const hm = new THREE.MeshStandardMaterial({ map: TEX.wood, color: col('#b88a62'), roughness: 0.8, side: THREE.DoubleSide });
  const hullM = mesh(hull, hm, 0, 0.35, 0, boat); hullM.scale.set(0.85, 0.55, 2.3);
  mesh(new THREE.BoxGeometry(1.5, 0.08, 0.35), MATS.wood, 0, 0.25, 0.3, boat);
  mesh(new THREE.BoxGeometry(1.4, 0.08, 0.3), MATS.wood, 0, 0.25, -1.0, boat);
  Object.assign(CAMPFIRE, { pos: new THREE.Vector3(C.x, h + 0.3, C.z), light, boat, pierStart: new THREE.Vector3(px, deckY, z0 + 1), pierEnd: new THREE.Vector3(px, deckY, z1 - 2) });
}

function buildRuins() {
  const s = SHRINES[4];
  const blocks = [];
  const r = mulberry32(404);
  const wall = (x0, z0, x1, z1, maxH) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 1.25), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t);
      const hh = Math.floor(maxH * (0.3 + 0.7 * Math.abs(Math.sin(i * 0.9 + r() * 2))) * (r() > 0.15 ? 1 : 0));
      const gy = terrainHeight(x, z);
      for (let k = 0; k < hh; k++) blocks.push({ x: x + (r() - 0.5) * 0.1, y: gy + 0.3 + k * 0.62, z: z + (r() - 0.5) * 0.1, ry: ry + (r() - 0.5) * 0.08 + (k % 2) * 0.02, s: 1, c: new THREE.Color().setScalar(0.8 + r() * 0.3) });
      if (hh > 0) addCollider(x, z, 0.75);
    }
  };
  const ox = s.x, oz = s.z;
  wall(ox - 14, oz - 12, ox + 6, oz - 15, 5);
  wall(ox - 15, oz - 10, ox - 17, oz + 9, 4);
  wall(ox + 12, oz - 8, ox + 15, oz + 4, 3);
  wall(ox - 8, oz + 14, ox + 4, oz + 15, 2);
  for (let i = 0; i < 26; i++) { const a = r() * TAU, d = 9 + r() * 12, x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d; blocks.push({ x, y: terrainHeight(x, z) + 0.15, z, ry: r() * TAU, rx: (r() - 0.5) * 0.4, rz: (r() - 0.5) * 0.4, s: 1, c: new THREE.Color().setScalar(0.75 + r() * 0.3) }); }
  instanced(new RoundedBoxGeometry(1.2, 0.6, 0.62, 2, 0.06), MATS.stone, blocks);
  // arch
  const ax = ox + 2, az = oz + 14.5, ay = terrainHeight(ax, az);
  for (const dx of [-2, 2]) { mesh(columnGeo(4.2, false, 0), MATS.stone, ax + dx, ay, az); addCollider(ax + dx, az, 0.65); }
  mesh(new RoundedBoxGeometry(5.6, 0.7, 1.1, 2, 0.08), MATS.stone, ax, ay + 4.5, az);
}

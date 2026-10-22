
// =====================================================================
//  Particles
// =====================================================================
const PART_U = { uScale: { value: 400 }, uFogD: { value: 0.01 }, uFogC: { value: new THREE.Color() } };
class Pool {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.additive = additive;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aA = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('color', this.aC); g.setAttribute('aSize', this.aS); g.setAttribute('aAlpha', this.aA);
    const mat = new THREE.ShaderMaterial({
      uniforms: PART_U, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 color; uniform float uScale; uniform float uFogD;
        varying vec3 vC; varying float vA; varying float vFog;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(-mv.z, 0.1); vC = color; vA = aAlpha;
          float d = -mv.z; vFog = 1.0 - exp(-uFogD * uFogD * d * d); }`,
      fragmentShader: `varying vec3 vC; varying float vA; varying float vFog; uniform vec3 uFogC;
        void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a * vA;
          ${additive ? 'gl_FragColor = vec4(vC * a * (1.0 - vFog), 1.0);' : 'gl_FragColor = vec4(mix(vC, uFogC, vFog), a);'} }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a = 1, grav = 0, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b;
    this.life[i] = this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    const P = this.p, Vv = this.v;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { P[i * 3 + k] = P[j * 3 + k]; Vv[i * 3 + k] = Vv[j * 3 + k]; this.c[i * 3 + k] = this.c[j * 3 + k]; }
          this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
          this.a0[i] = this.a0[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
        }
        i--; continue;
      }
      const dr = Math.exp(-this.drag[i] * dt);
      Vv[i * 3] *= dr; Vv[i * 3 + 1] = Vv[i * 3 + 1] * dr - this.grav[i] * dt; Vv[i * 3 + 2] *= dr;
      P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = lerp(this.s0[i], this.s1[i], t);
      this.alpha[i] = this.a0[i] * Math.min(1, t * 10) * (1 - t * t);
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aP.needsUpdate = this.aC.needsUpdate = this.aS.needsUpdate = this.aA.needsUpdate = true;
  }
}
let glow, smoke;
function sparkBurst(pos, n, color, speed = 4, up = 1, life = 0.9, size = 0.25) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, e = rnd() * 2 - 1, s = speed * (0.4 + rnd() * 0.8);
    const ce = Math.sqrt(1 - e * e);
    glow.spawn(pos.x, pos.y, pos.z, Math.cos(a) * ce * s, e * s * 0.6 + up * rnd() * speed * 0.5, Math.sin(a) * ce * s, life * (0.6 + rnd() * 0.6), size, size * 0.2, color.r, color.g, color.b, 1, 2.5, 2.2);
  }
}

// Fireflies & pollen drifting around the player (GPU-wrapped)
const FLY_U = { uPlayer: { value: new THREE.Vector3() }, uAmt: { value: 1 }, uCol: { value: new THREE.Color(2.4, 1.9, 0.7) } };
function buildFireflies() {
  const N = IS_MOBILE ? 220 : 420, R2 = 36;
  const off = new Float32Array(N * 4), r = mulberry32(55);
  for (let i = 0; i < N; i++) { off[i * 4] = (r() * 2 - 1) * R2; off[i * 4 + 1] = (r() * 2 - 1) * R2; off[i * 4 + 2] = 0.4 + r() * 3.5; off[i * 4 + 3] = r(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aOff', new THREE.BufferAttribute(off, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uTime: G.time, uR: { value: R2 } }, FLY_U, PART_U, HT_U()),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aOff; uniform float uTime; uniform float uR; uniform vec3 uPlayer; uniform float uScale; uniform float uAmt;
      ${HT_GLSL}
      varying float vA;
      void main() {
        vec2 rel = mod(aOff.xy - uPlayer.xz + uR, 2.0 * uR) - uR;
        vec2 wp = uPlayer.xz + rel + vec2(sin(uTime * 0.31 + aOff.w * 7.0), cos(uTime * 0.27 + aOff.w * 5.0)) * 1.6;
        float h = hSample(wp).r;
        vec3 p = vec3(wp.x, max(h, 0.3) + aOff.z + sin(uTime * 0.8 + aOff.w * 9.0) * 0.4, wp.y);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * (1.5 + aOff.w * 2.5) + aOff.w * 40.0);
        float edge = 1.0 - smoothstep(0.7, 1.0, length(rel) / uR);
        vA = tw * tw * edge * uAmt * (1.0 - smoothstep(30.0, 60.0, -mv.z));
        gl_PointSize = (0.16 + aOff.w * 0.1) * uScale / max(-mv.z, 0.5);
      }`,
    fragmentShader: `varying float vA; uniform vec3 uCol;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uCol * a * a * vA, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  scene.add(pts);
}

// Expanding light ring used for the lantern burst
const rings = [];
function buildRingPool() {
  const geo = new THREE.RingGeometry(0.86, 1.0, 72, 1);
  geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color(3, 2.2, 1.1) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uA; uniform vec3 uC; void main(){ gl_FragColor = vec4(uC * uA, 1.0); }',
    }));
    m.visible = false;
    m.renderOrder = 7;
    scene.add(m);
    rings.push({ m, t: 1, dur: 0.5, max: 8 });
  }
}
function spawnRing(pos, max, color, dur = 0.5) {
  const r = rings.find((q) => q.t >= 1) || rings[0];
  r.t = 0; r.dur = dur; r.max = max;
  r.m.position.copy(pos);
  r.m.material.uniforms.uC.value.copy(color);
  r.m.visible = true;
}
function updateRings(dt) {
  for (const r of rings) {
    if (r.t >= 1) continue;
    r.t = Math.min(1, r.t + dt / r.dur);
    const e = 1 - Math.pow(1 - r.t, 3);
    r.m.scale.setScalar(0.5 + e * r.max);
    r.m.material.uniforms.uA.value = (1 - r.t) * 1.2;
    if (r.t >= 1) r.m.visible = false;
  }
}

// =====================================================================
//  Characters
// =====================================================================
function capsule(r, len) { const g = new THREE.CapsuleGeometry(r, len, 6, 12); g.translate(0, -(len / 2 + r * 0.6), 0); return g; }
function buildHuman(p) {
  const fab = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.88, normalMap: TEX.fabricN, normalScale: new THREE.Vector2(0.5, 0.5), ...extra });
  const M = {
    skin: new THREE.MeshStandardMaterial({ color: col(p.skin), roughness: 0.55 }),
    cloth: fab(p.cloth), pants: fab(p.pants), scarf: fab(p.scarf || '#8a2a2a'),
    leather: new THREE.MeshStandardMaterial({ color: col(p.leather), roughness: 0.62 }),
    hair: new THREE.MeshStandardMaterial({ color: col(p.hair), roughness: 0.65 }),
    trim: new THREE.MeshStandardMaterial({ color: col('#c9a14a'), roughness: 0.35, metalness: 0.85 }),
    eye: new THREE.MeshStandardMaterial({ color: col('#1b120d'), roughness: 0.15 }),
  };
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const bottom = p.robe ? -0.82 : -0.3;
  const prof = [[0, bottom], [p.robe ? 0.36 : 0.27, bottom], [p.robe ? 0.3 : 0.25, bottom + 0.12], [0.2, 0.0], [0.19, 0.12], [0.215, 0.3], [0.22, 0.43], [0.17, 0.53], [0.07, 0.58], [0, 0.59]]
    .map(([a, b]) => new THREE.Vector2(a, b));
  add(new THREE.LatheGeometry(prof, 22), M.cloth, spine).scale.set(1, 1, 0.78);
  const hem = new THREE.TorusGeometry(p.robe ? 0.355 : 0.268, 0.018, 6, 28); hem.rotateX(Math.PI / 2);
  add(hem, M.trim, spine, 0, bottom + 0.01, 0).scale.set(1, 1, 0.78);
  const belt = new THREE.TorusGeometry(0.2, 0.03, 8, 28); belt.rotateX(Math.PI / 2);
  add(belt, M.leather, spine, 0, 0.02, 0).scale.set(1, 1, 0.8);
  add(new RoundedBoxGeometry(0.07, 0.06, 0.02, 1, 0.01), M.trim, spine, 0, 0.02, 0.165);
  add(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 10), M.skin, spine, 0, 0.62, 0);
  if (p.scarf) {
    const sc = new THREE.TorusGeometry(0.085, 0.045, 10, 20); sc.rotateX(Math.PI / 2);
    add(sc, M.scarf, spine, 0, 0.58, 0);
  }
  // satchel + strap
  add(new RoundedBoxGeometry(0.17, 0.16, 0.07, 2, 0.025), M.leather, spine, 0.2, -0.08, 0.05).rotation.y = 0.5;
  const strap = new THREE.TorusGeometry(0.27, 0.012, 5, 30);
  const st = add(strap, M.leather, spine, 0.02, 0.22, 0); st.rotation.set(0, Math.PI / 2, 0.7); st.scale.set(1, 1, 0.75);
  // head
  const head = new THREE.Group(); head.position.y = 0.74; spine.add(head);
  add(new THREE.SphereGeometry(0.125, 28, 20), M.skin, head).scale.set(0.92, 1.06, 0.98);
  add(new THREE.SphereGeometry(0.02, 8, 6), M.skin, head, 0, -0.015, 0.123);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.017, 10, 8), M.eye, head, s * 0.043, 0.012, 0.108);
    add(new THREE.SphereGeometry(0.028, 8, 6), M.skin, head, s * 0.115, 0, 0).scale.set(0.5, 1, 0.8);
  }
  let ponytail = null;
  if (p.hairStyle === 'tail') {
    const cap = add(new THREE.SphereGeometry(0.136, 24, 16, 0, TAU, 0, Math.PI * 0.56), M.hair, head, 0, 0.012, -0.01);
    cap.rotation.x = -0.32;
    add(new THREE.SphereGeometry(0.07, 12, 8), M.hair, head, 0.03, 0.085, 0.07).scale.set(1.5, 0.55, 0.8);
    ponytail = new THREE.Group(); ponytail.position.set(0, 0.06, -0.125); head.add(ponytail);
    const tie = new THREE.TorusGeometry(0.03, 0.012, 6, 12); tie.rotateX(Math.PI / 2);
    add(tie, M.scarf, ponytail);
    add(capsule(0.045, 0.2), M.hair, ponytail).scale.set(1, 1, 0.8);
  } else {
    add(new THREE.SphereGeometry(0.13, 20, 14, 0, TAU, 0, Math.PI * 0.42), M.hair, head, 0, 0.01, -0.01).rotation.x = -0.2;
    const beard = add(new THREE.SphereGeometry(0.1, 16, 12), M.hair, head, 0, -0.085, 0.05); beard.scale.set(0.95, 1.15, 0.75);
    const brim = add(new THREE.CylinderGeometry(0.26, 0.27, 0.02, 24), M.leather, head, 0, 0.1, 0); brim.rotation.x = -0.08;
    add(new THREE.ConeGeometry(0.13, 0.22, 16), M.leather, head, 0, 0.2, -0.01);
  }
  // arms (index 0 = left (+x), 1 = right (-x))
  const arms = [];
  for (const s of [1, -1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 0.235, 0.47, 0); spine.add(shoulder);
    add(new THREE.SphereGeometry(0.068, 12, 10), M.cloth, shoulder);
    add(capsule(0.056, 0.19), M.cloth, shoulder);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
    add(capsule(0.048, 0.18), p.robe ? M.cloth : M.skin, elbow);
    const cuff = new THREE.TorusGeometry(0.05, 0.014, 6, 14); cuff.rotateX(Math.PI / 2);
    add(cuff, M.leather, elbow, 0, -0.17, 0);
    const hand = new THREE.Group(); hand.position.y = -0.29; elbow.add(hand);
    add(new THREE.SphereGeometry(0.05, 12, 10), M.skin, hand).scale.set(0.85, 1.15, 0.7);
    arms.push({ shoulder, elbow, hand, s });
  }
  // legs
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, -0.02, 0); hips.add(hip);
    add(capsule(0.077, 0.28), M.pants, hip);
    const knee = new THREE.Group(); knee.position.y = -0.43; hip.add(knee);
    add(capsule(0.063, 0.27), M.pants, knee);
    const foot = new THREE.Group(); foot.position.y = -0.41; knee.add(foot);
    const boot = new THREE.CapsuleGeometry(0.068, 0.12, 6, 10); boot.rotateX(Math.PI / 2);
    add(boot, M.leather, foot, 0, -0.02, 0.045).scale.set(1, 0.75, 1);
    add(new THREE.CylinderGeometry(0.07, 0.066, 0.14, 12), M.leather, knee, 0, -0.33, 0);
    legs.push({ hip, knee, foot, s });
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, hips, spine, head, ponytail, arms, legs, M, phase: 0, breath: 0 };
}

function buildLantern() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: col('#4a3a28'), metalness: 0.75, roughness: 0.35 });
  const handle = new THREE.TorusGeometry(0.045, 0.007, 6, 16, Math.PI);
  const hm = new THREE.Mesh(handle, metal); hm.position.y = -0.02; g.add(hm);
  const body = new THREE.Group(); body.position.y = -0.14; g.add(body);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.07, 8), metal); top.position.y = 0.1; body.add(top);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.03, 8), metal); base.position.y = -0.08; body.add(base);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.78; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), metal); post.position.set(Math.cos(a) * 0.062, 0, Math.sin(a) * 0.062); body.add(post); }
  const glassMat = new THREE.MeshStandardMaterial({ color: col('#ffe2a8'), emissive: col('#ffb352'), emissiveIntensity: 1.6, transparent: true, opacity: 0.7, roughness: 0.1 });
  body.add(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.15, 12, 1, true), glassMat));
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3, 1.2) });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), flameMat); flame.scale.y = 1.5; body.add(flame);
  const light = new THREE.PointLight(0xffb35c, 5, 16, 1.5);
  body.add(light);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { g, body, light, glassMat, flameMat, flame };
}

// Verlet ribbon for the scarf tail
class Ribbon {
  constructor(n, seg, width, mat) {
    this.n = n; this.seg = seg; this.w = width;
    this.p = Array.from({ length: n }, () => new THREE.Vector3());
    this.pp = Array.from({ length: n }, () => new THREE.Vector3());
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    const uv = [], idx = [];
    for (let i = 0; i < n; i++) { uv.push(0, i / (n - 1), 1, i / (n - 1)); if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.init = false;
  }
  update(dt, anchor, side, axisA, axisB, wind) {
    const { p, pp, n, seg } = this;
    if (!this.init) { for (let i = 0; i < n; i++) { p[i].copy(anchor).y -= i * seg; pp[i].copy(p[i]); } this.init = true; }
    p[0].copy(anchor); pp[0].copy(anchor);
    const g = -9 * dt * dt, tmp = new THREE.Vector3();
    for (let i = 1; i < n; i++) {
      tmp.copy(p[i]).sub(pp[i]).multiplyScalar(0.94);
      pp[i].copy(p[i]);
      p[i].add(tmp);
      p[i].y += g;
      p[i].addScaledVector(wind, dt * dt * (0.5 + i / n));
    }
    const ab = new THREE.Vector3().subVectors(axisB, axisA), abl = ab.lengthSq();
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < n; i++) {
        tmp.subVectors(p[i], p[i - 1]);
        const d = tmp.length() || 1e-4;
        p[i].copy(p[i - 1]).addScaledVector(tmp, seg / d);
        // keep clear of the torso capsule
        const t = clamp(new THREE.Vector3().subVectors(p[i], axisA).dot(ab) / abl, 0, 1);
        const c = new THREE.Vector3().copy(axisA).addScaledVector(ab, t);
        tmp.subVectors(p[i], c);
        const dl = tmp.length();
        if (dl < 0.24) p[i].copy(c).addScaledVector(tmp, 0.24 / (dl || 1e-4));
      }
    }
    for (let i = 0; i < n; i++) {
      const w = this.w * (1 - (i / n) * 0.35) * 0.5;
      this.pos[i * 6] = p[i].x - side.x * w; this.pos[i * 6 + 1] = p[i].y - side.y * w; this.pos[i * 6 + 2] = p[i].z - side.z * w;
      this.pos[i * 6 + 3] = p[i].x + side.x * w; this.pos[i * 6 + 4] = p[i].y + side.y * w; this.pos[i * 6 + 5] = p[i].z + side.z * w;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
  reset() { this.init = false; }
}

// Procedural animation shared by Ela and the keeper
function animateHuman(h, dt, st) {
  const { speed = 0, air = false, swim = false, attack = 0, turnRate = 0, talk = 0, look = 0, lookUp = 0, stoop = 0, talkArm = 1 } = st;
  const stride = clamp(speed / 7, 0, 1);
  h.phase += dt * (speed > 0.1 ? 2.2 + speed * 1.15 : 0);
  h.breath += dt * 1.6;
  const ph = h.phase;
  const swing = swim ? 0.35 : (0.25 + stride * 0.6);
  const moving = clamp(speed / 1.5, 0, 1);
  const L = h.legs, A = h.arms;
  let lx = Math.sin(ph) * swing * moving, rx = -lx;
  let lk = Math.max(0, -Math.cos(ph)) * (0.4 + stride * 0.9) * moving, rk = Math.max(0, Math.cos(ph)) * (0.4 + stride * 0.9) * moving;
  if (air && !swim) { lx = -0.7; rx = 0.2; lk = 1.1; rk = 0.5; }
  const k = 1 - Math.exp(-dt * 16);
  L[0].hip.rotation.x = lerp(L[0].hip.rotation.x, -lx, k);
  L[1].hip.rotation.x = lerp(L[1].hip.rotation.x, -rx, k);
  L[0].knee.rotation.x = lerp(L[0].knee.rotation.x, lk, k);
  L[1].knee.rotation.x = lerp(L[1].knee.rotation.x, rk, k);
  L[0].foot.rotation.x = -L[0].hip.rotation.x * 0.3 - L[0].knee.rotation.x * 0.4;
  L[1].foot.rotation.x = -L[1].hip.rotation.x * 0.3 - L[1].knee.rotation.x * 0.4;
  const bob = Math.abs(Math.sin(ph)) * 0.05 * moving * (0.5 + stride);
  h.hips.position.y = lerp(h.hips.position.y, 0.92 - 0.03 * stride * moving + bob + (air ? 0.04 : 0) + (swim ? -0.05 : 0), k);
  h.spine.rotation.x = lerp(h.spine.rotation.x, stride * 0.2 * moving + (swim ? 0.5 : 0) + stoop + Math.sin(h.breath) * 0.012, k * 0.6);
  h.spine.rotation.y = Math.sin(ph) * 0.12 * moving;
  h.spine.rotation.z = lerp(h.spine.rotation.z, clamp(-turnRate * 0.05, -0.25, 0.25), k * 0.5);
  h.hips.rotation.y = -h.spine.rotation.y * 0.5;
  const breathe = 1 + Math.sin(h.breath) * 0.012;
  h.spine.scale.set(breathe, 1, breathe);
  // arms
  for (const a of A) {
    const opp = a.s > 0 ? -lx : lx;
    let sx = opp * 0.9 * moving + (swim ? Math.sin(ph * 0.5 + (a.s > 0 ? 0 : Math.PI)) * 1.2 - 0.6 : 0);
    let ex = -0.25 - stride * 0.6 * moving;
    let sz = a.s * (0.1 + stride * 0.05);
    if (air && !swim) { sx = -1.2; sz = a.s * 0.7; ex = -0.4; }
    if (a.s < 0 && attack > 0) { sx = lerp(sx, -2.7, attack); ex = lerp(ex, -0.2, attack); sz = lerp(sz, -0.2, attack); }
    if (st.staff && a.s > 0) { sx = -0.25; ex = -0.9; sz = 0.15; }
    if (a.s < 0 && st.holdLantern && attack <= 0 && !swim) { sx = sx * 0.4 - 0.35; ex = -1.0 - stride * 0.2; }
    if (talk > 0 && a.s === talkArm) { sx = lerp(sx, -0.6 + Math.sin(h.breath * 2.5) * 0.25, talk); ex = lerp(ex, -1.1, talk); }
    a.shoulder.rotation.x = lerp(a.shoulder.rotation.x, sx, k);
    a.shoulder.rotation.z = lerp(a.shoulder.rotation.z, sz, k);
    a.elbow.rotation.x = lerp(a.elbow.rotation.x, ex, k);
  }
  h.head.rotation.y = lerp(h.head.rotation.y, look - h.spine.rotation.y, k * 0.5);
  h.head.rotation.x = lerp(h.head.rotation.x, -lookUp - h.spine.rotation.x * 0.6 + Math.sin(h.breath * 0.5) * 0.02, k * 0.5);
  if (h.ponytail) {
    h.ponytail.rotation.x = lerp(h.ponytail.rotation.x, 0.25 + stride * 0.9 * moving + (air ? 0.8 : 0) + Math.sin(ph * 2) * 0.08 * moving, 1 - Math.exp(-dt * 6));
    h.ponytail.rotation.z = lerp(h.ponytail.rotation.z, Math.sin(ph) * 0.2 * moving - turnRate * 0.04, 1 - Math.exp(-dt * 6));
  }
}

// =====================================================================
//  Player (Ela) & keeper NPC
// =====================================================================
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: Math.PI, onGround: true, coyote: 0, jumpBuf: 0,
  hp: 5, maxHp: 5, energy: 100, invuln: 0, attackT: 0, burstCd: 0, swim: false, turnRate: 0, stepPhase: 0, landed: 0,
};
let ela, lantern, scarfA, scarfB, keeper;
function buildPlayer() {
  ela = buildHuman({ skin: '#e2b08f', cloth: '#2c5c63', pants: '#3a2e29', scarf: '#b52f3a', leather: '#5b3b27', hair: '#6e3420', hairStyle: 'tail' });
  scene.add(ela.root);
  lantern = buildLantern();
  ela.arms[1].hand.add(lantern.g);
  lantern.g.position.set(0, -0.03, 0.02);
  const scarfMat = new THREE.MeshStandardMaterial({ color: col('#b52f3a'), roughness: 0.85, side: THREE.DoubleSide, normalMap: TEX.fabricN });
  scarfA = new Ribbon(9, 0.075, 0.085, scarfMat);
  scarfB = new Ribbon(7, 0.075, 0.07, scarfMat);
}
function buildKeeper() {
  keeper = buildHuman({ skin: '#c99878', cloth: '#5a4636', pants: '#3b3129', scarf: null, leather: '#3e2c20', hair: '#cfc9c0', robe: true, hairStyle: 'old' });
  const k = keeper;
  const x = CAMP.x - 2.4, z = CAMP.z - 1.2;
  k.root.position.set(x, groundAt(x, z), z);
  k.root.rotation.y = Math.atan2(CAMP.x - x, CAMP.z - z);
  scene.add(k.root);
  const staffMat = new THREE.MeshStandardMaterial({ map: TEX.barkC, color: col('#9a7a5a'), roughness: 0.9 });
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.75, 6), staffMat);
  staff.position.set(0, -0.35, 0.02);
  staff.castShadow = true;
  k.arms[0].hand.add(staff);
  k.staff = staff;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 3.2) }));
  orb.position.y = 0.9; staff.add(orb);
  addCollider(x, z, 0.5);
  k.talk = 0;
  k.pos = new THREE.Vector3(x, k.root.position.y, z);
}

// =====================================================================
//  Mist spirits
// =====================================================================
const wisps = [];
const WISP_GEO = new THREE.SphereGeometry(0.42, 28, 20);
const EYE_GEO = new THREE.SphereGeometry(0.055, 8, 6);
const EYE_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.6, 4.2) });
function wispMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: G.time, uHit: { value: 0 }, uFade: { value: 0 }, uSeed: { value: rnd() * 10 } },
    transparent: true,
    vertexShader: `uniform float uTime; uniform float uSeed; varying vec3 vN; varying vec3 vV; varying float vW;
      void main() {
        vec3 p = position;
        float w = sin(p.y * 9.0 + uTime * 4.0 + uSeed) * 0.05 + sin(p.x * 11.0 - uTime * 3.0) * 0.04 + sin(p.z * 8.0 + uTime * 5.0 + uSeed) * 0.04;
        p += normal * w; vW = w;
        p.y -= max(-p.y, 0.0) * 0.6 * (0.5 + 0.5 * sin(uTime * 3.0 + p.x * 8.0));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform float uHit; uniform float uFade; varying vec3 vN; varying vec3 vV; varying float vW;
      void main() {
        float f = 1.0 - max(dot(vN, vV), 0.0);
        vec3 core = vec3(0.012, 0.004, 0.03);
        vec3 rim = mix(vec3(0.45, 0.12, 1.1), vec3(0.95, 0.3, 1.4), smoothstep(-0.05, 0.08, vW)) * 1.8;
        vec3 c = mix(core, rim, pow(f, 3.0)) + vec3(3.0, 2.6, 2.0) * uHit;
        gl_FragColor = vec4(c, (0.96 - pow(f, 6.0) * 0.35) * (1.0 - uFade));
      }`,
  });
}
function spawnWisp(x, z, home = null, delay = 0) {
  if (wisps.length >= (IS_MOBILE ? 8 : 11)) return null;
  const g = new THREE.Group();
  const m = new THREE.Mesh(WISP_GEO, wispMaterial());
  g.add(m);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(EYE_GEO, EYE_MAT); e.position.set(s * 0.12, 0.06, 0.36); e.scale.set(1, 1.4, 0.6); g.add(e); }
  const y = groundAt(x, z) + 1.4;
  g.position.set(x, y, z);
  g.scale.setScalar(0.01);
  scene.add(g);
  const w = { g, m, pos: g.position, vel: new THREE.Vector3(), home: home || new THREE.Vector3(x, y, z), state: 'spawn', t: -delay, hit: 0, hp: 1, seed: rnd() * 100, cool: 0 };
  wisps.push(w);
  return w;
}
function killWisp(w, silent) {
  if (w.state === 'die') return;
  w.state = 'die'; w.t = 0;
  if (!silent) {
    sparkBurst(w.pos, 26, new THREE.Color(1.6, 1.2, 3.0), 5, 1, 0.8, 0.28);
    for (let i = 0; i < 10; i++) smoke.spawn(w.pos.x, w.pos.y, w.pos.z, R(-1, 1), R(0, 1.5), R(-1, 1), 1.2, 0.6, 1.6, 0.25, 0.18, 0.35, 0.5, -0.3, 1.5);
  }
}

// =====================================================================
//  Light seeds (collectibles)
// =====================================================================
const seeds = [];
let seedMesh, seedHalo;
function buildSeeds() {
  const r = mulberry32(2024);
  const want = 40;
  let tries = 0;
  while (seeds.length < want && tries++ < 6000) {
    let x, z;
    if (r() < 0.55 && PATH_SEGS.length) {
      const sg = PATH_SEGS[Math.floor(r() * PATH_SEGS.length)];
      const t = r();
      x = lerp(sg[0], sg[2], t) + (r() - 0.5) * 8; z = lerp(sg[1], sg[3], t) + (r() - 0.5) * 8;
    } else { x = (r() * 2 - 1) * 170; z = (r() * 2 - 1) * 170; }
    const h = terrainHeight(x, z);
    if (h < 1.5 || h > 50 || blocked(x, z, 1)) continue;
    if (seeds.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 15 * 15)) continue;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 10) continue;
    seeds.push({ x, z, y: groundAt(x, z) + 1.1, taken: false, mag: 0, phase: r() * TAU });
  }
  seedMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.15, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 2.8, 1.0) }), seeds.length);
  seedMesh.frustumCulled = false;
  scene.add(seedMesh);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3));
  seedHalo = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: Object.assign({ uTime: G.time }, PART_U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uScale; uniform float uTime; varying float vF; uniform float uFogD;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
      gl_PointSize = (1.6 + 0.3 * sin(uTime * 3.0 + position.x)) * uScale / max(d, 0.5); vF = exp(-uFogD * uFogD * d * d * 0.5); }`,
    fragmentShader: `varying float vF; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a * a; gl_FragColor = vec4(vec3(1.0, 0.7, 0.3) * a * 1.4 * vF, 1.0); }`,
  }));
  seedHalo.frustumCulled = false;
  seedHalo.renderOrder = 6;
  scene.add(seedHalo);
}

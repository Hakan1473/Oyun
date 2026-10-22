
// =====================================================================
//  Post-processing
// =====================================================================
let composer, bloomPass, gradePass;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSat: { value: 1 }, uDamage: { value: 0 }, uFlash: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0.035 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uSat, uDamage, uFlash, uVig, uGrain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat);
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.85)));
      c *= mix(1.0, v, uVig);
      c = mix(c, vec3(0.55, 0.03, 0.12), uDamage * (1.0 - v) * 0.85);
      c += vec3(1.0, 0.85, 0.6) * uFlash;
      c += (hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};
function buildPost() {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: IS_MOBILE ? 0 : 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 1.0);
  bloomPass.enabled = Q.bloom;
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);
}
let prScale = 1;
function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pr = Math.min(devicePixelRatio || 1, Q.pr) * prScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
  PART_U.uScale.value = (h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
addEventListener('resize', resize);

// =====================================================================
//  Game state
// =====================================================================
const S = {
  mode: 'loading', prevMode: 'play', stage: 'talk', lit: [false, false, false, false, false], kills: 0, time: 0,
  talked: false, checkpoint: null, ritual: null, dlg: null, cine: null, deadT: 0, wispTimer: 4, interact: null, finished: false,
};
const SAVE_KEY = 'lumora-save-v1';
const litCount = () => S.lit.filter(Boolean).length;
function save() {
  store.set(SAVE_KEY, { lit: S.lit, seeds: seeds.map((s) => (s.taken ? 1 : 0)), stage: S.stage, kills: S.kills, time: S.time, talked: S.talked, cp: S.checkpoint, finished: S.finished });
}

// =====================================================================
//  Input
// =====================================================================
const input = { keys: new Set(), stick: new THREE.Vector2(), stickId: null, stickO: { x: 0, y: 0 }, camId: null, camLast: { x: 0, y: 0 },
  jumpQ: false, burstQ: false, actQ: false, camDX: 0, camDY: 0, zoom: 0, lastCam: -9, usingTouch: IS_TOUCH, jumpHeld: false };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  input.keys.add(e.code);
  input.usingTouch = false;
  if (S.mode === 'dialog' && ['Space', 'KeyE', 'Enter'].includes(e.code)) { advanceDialog(); e.preventDefault(); return; }
  if (e.code === 'Space') { input.jumpQ = true; e.preventDefault(); }
  if (['KeyF', 'KeyK', 'KeyQ'].includes(e.code)) input.burstQ = true;
  if (['KeyE', 'Enter'].includes(e.code)) input.actQ = true;
  if (['Escape', 'KeyP'].includes(e.code)) { if (S.mode === 'play') openPause(); else if (S.mode === 'pause') closePause(); }
});
addEventListener('keyup', (e) => input.keys.delete(e.code));
addEventListener('blur', () => input.keys.clear());
const layer = $('inputLayer');
layer.addEventListener('pointerdown', (e) => {
  AudioFX.init();
  if (S.mode === 'dialog') { advanceDialog(); return; }
  if (e.pointerType === 'mouse') {
    input.usingTouch = false;
    input.camId = e.pointerId; input.camLast = { x: e.clientX, y: e.clientY };
    layer.setPointerCapture(e.pointerId);
    return;
  }
  input.usingTouch = true;
  if (e.clientX < innerWidth * 0.45 && input.stickId === null && S.mode === 'play') {
    input.stickId = e.pointerId; input.stickO = { x: e.clientX, y: e.clientY };
    const st = $('stick'); st.style.left = e.clientX + 'px'; st.style.top = e.clientY + 'px'; st.className = 'on';
  } else if (input.camId === null) {
    input.camId = e.pointerId; input.camLast = { x: e.clientX, y: e.clientY };
  }
  layer.setPointerCapture(e.pointerId);
});
layer.addEventListener('pointermove', (e) => {
  if (e.pointerId === input.stickId) {
    let dx = e.clientX - input.stickO.x, dy = e.clientY - input.stickO.y;
    const d = Math.hypot(dx, dy), max = 56;
    if (d > max) { input.stickO.x += (dx / d) * (d - max); input.stickO.y += (dy / d) * (d - max); dx = (dx / d) * max; dy = (dy / d) * max; const st = $('stick'); st.style.left = input.stickO.x + 'px'; st.style.top = input.stickO.y + 'px'; }
    input.stick.set(dx / max, -dy / max);
    $('knob').style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (e.pointerId === input.camId) {
    const k = e.pointerType === 'mouse' ? 1 : 1.35;
    input.camDX += (e.clientX - input.camLast.x) * k; input.camDY += (e.clientY - input.camLast.y) * k;
    input.camLast = { x: e.clientX, y: e.clientY };
  }
});
const endPtr = (e) => {
  if (e.pointerId === input.stickId) { input.stickId = null; input.stick.set(0, 0); $('knob').style.transform = ''; $('stick').className = input.usingTouch ? 'idle' : ''; }
  if (e.pointerId === input.camId) input.camId = null;
};
layer.addEventListener('pointerup', endPtr);
layer.addEventListener('pointercancel', endPtr);
layer.addEventListener('wheel', (e) => { input.zoom += Math.sign(e.deltaY); }, { passive: true });
layer.addEventListener('contextmenu', (e) => e.preventDefault());
function holdBtn(id, on) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); AudioFX.init(); b.classList.add('pressed'); on(); });
  const up = () => b.classList.remove('pressed');
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
}
holdBtn('tJump', () => { input.jumpQ = true; });
holdBtn('tBurst', () => { input.burstQ = true; });
holdBtn('tAct', () => { input.actQ = true; });

// =====================================================================
//  Camera
// =====================================================================
const cam = { yaw: 0, pitch: 0.3, dist: 7.0, distT: 7.0, target: new THREE.Vector3(), shake: 0, blend: 1, from: new THREE.Vector3(), fromLook: new THREE.Vector3(), look: new THREE.Vector3() };
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function titleCamera(t, out, look) {
  const cx = CAMP.x + 3, cz = CAMP.z + 7;
  const a = t * 0.045 + 2.2;
  out.set(cx + Math.cos(a) * 17, CAMP.h + 4.2 + Math.sin(t * 0.08) * 0.8, cz + Math.sin(a) * 17);
  out.y = Math.max(out.y, groundAt(out.x, out.z) + 2);
  look.set(cx, CAMP.h + 1.4, cz);
}
function updateCamera(dt) {
  const sens = input.usingTouch ? 0.0062 : 0.0048;
  if (input.camDX || input.camDY) {
    cam.yaw -= input.camDX * sens;
    cam.pitch = clamp(cam.pitch + input.camDY * sens * 0.8, -0.25, 1.15);
    input.lastCam = S.time;
  }
  input.camDX = input.camDY = 0;
  if (input.zoom) { cam.distT = clamp(cam.distT + input.zoom * 0.7, 3.5, 13); input.zoom = 0; }
  const hs = Math.hypot(player.vel.x, player.vel.z);
  if (S.mode === 'play' && hs > 2 && S.time - input.lastCam > 1.6) {
    const behind = player.yaw + Math.PI;
    cam.yaw = lerpAngle(cam.yaw, behind, 1 - Math.exp(-dt * 0.9 * clamp(hs / 6, 0, 1)));
  }
  cam.dist = damp(cam.dist, cam.distT + (S.ritual ? 2.5 : 0), 3, dt);
  const tgt = _v.copy(player.pos); tgt.y += player.swim ? 1.3 : 1.55;
  cam.target.x = damp(cam.target.x, tgt.x, 14, dt);
  cam.target.z = damp(cam.target.z, tgt.z, 14, dt);
  cam.target.y = damp(cam.target.y, tgt.y, 9, dt);
  const cp = Math.cos(cam.pitch);
  const off = _v2.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
  let dist = cam.dist;
  for (let i = 1; i <= 6; i++) {
    const t = (i / 6) * dist;
    const px = cam.target.x + off.x * t, py = cam.target.y + off.y * t, pz = cam.target.z + off.z * t;
    if (groundAt(px, pz) + 0.45 > py) { dist = Math.max(1.8, t * 0.85); break; }
  }
  const pos = new THREE.Vector3().copy(cam.target).addScaledVector(off, dist);
  pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + 0.5, 0.45);
  const look = cam.look.copy(cam.target);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt); const s = cam.shake * 0.35; pos.x += (rnd() - 0.5) * s; pos.y += (rnd() - 0.5) * s; }
  if (cam.blend < 1) {
    cam.blend = Math.min(1, cam.blend + dt / 2.6);
    const e = ease(cam.blend);
    camera.position.lerpVectors(cam.from, pos, e);
    _v.lerpVectors(cam.fromLook, look, e);
    camera.lookAt(_v);
  } else {
    camera.position.copy(pos);
    camera.lookAt(look);
  }
  const sprint = clamp((hs - 6) / 3, 0, 1);
  const fov = 58 + sprint * 6;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); PART_U.uScale.value = (renderer.domElement.height) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); }
}

// =====================================================================
//  UI helpers
// =====================================================================
const FLAME = '<svg viewBox="0 0 24 28"><path d="M12 1c1.3 4.2 7.5 7.1 7.5 14.3A7.5 7.5 0 0 1 4.5 15.3c0-3.4 1.8-5.6 3.3-7.6.1 2.3 1.1 3.6 2.4 3.9-.6-3.6.2-7.3 1.8-10.6z" fill="#ffc46b" stroke="#ffe3a8" stroke-width="1"/><path d="M12 13c.6 2 3.3 3.3 3.3 6.3a3.3 3.3 0 0 1-6.6 0c0-1.7.8-2.6 1.5-3.6.2 1 .6 1.5 1.1 1.6-.3-1.6.1-3 .7-4.3z" fill="#fff4d6"/></svg>';
const FLAME_OFF = '<svg viewBox="0 0 24 28" class="off"><path d="M12 1c1.3 4.2 7.5 7.1 7.5 14.3A7.5 7.5 0 0 1 4.5 15.3c0-3.4 1.8-5.6 3.3-7.6.1 2.3 1.1 3.6 2.4 3.9-.6-3.6.2-7.3 1.8-10.6z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.35)" stroke-width="1"/></svg>';
let hudHp = -1;
function renderFlames(hit) {
  const el = $('flames');
  el.innerHTML = Array.from({ length: player.maxHp }, (_, i) => (i < player.hp ? FLAME : FLAME_OFF)).join('');
  if (hit) { const s = el.children[player.hp]; if (s) s.classList.add('hit'); }
  hudHp = player.hp;
}
let toastTimer = 0;
function toast(t1, t2, color = '#f3c375') {
  const el = $('toast');
  el.querySelector('.t1').textContent = t1;
  el.querySelector('.t2').textContent = t2 || '';
  el.style.setProperty('--tc', color);
  el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4300);
}
let lastObj = '';
function setObjective(text) {
  if (text === lastObj) return;
  lastObj = text;
  $('objText').textContent = text;
  const o = $('objective'); o.classList.remove('pulse'); void o.offsetWidth; o.classList.add('pulse');
}
function objectiveTarget() {
  if (S.stage === 'talk') return { text: 'Kamp ateşinin başındaki Bekçi Ilgaz ile konuş', p: keeper.pos };
  if (S.stage === 'shrines') {
    let best = null, bd = Infinity;
    shrineObjs.forEach((o) => { if (!o.lit) { const d = Math.hypot(o.s.x - player.pos.x, o.s.z - player.pos.z); if (d < bd) { bd = d; best = o; } } });
    if (best) return { text: `Işık Sunaklarını uyandır · ${litCount()}/5 — En yakın: ${best.s.name}`, p: new THREE.Vector3(best.s.x, best.s.h, best.s.z), shrine: best };
  }
  if (S.stage === 'lighthouse') return { text: 'Kuzeydeki Büyük Feneri yeniden yak', p: LH.door };
  const left = seeds.filter((s) => !s.taken).length;
  return { text: left ? `Lumora özgür. Kalan ${left} Işık Tohumu'nu bul` : 'Lumora özgür. Adanın tadını çıkar', p: null };
}

// ---------- minimap ----------
let MAPC;
function buildMinimapBase() {
  const S2 = 256, ext = 210;
  MAPC = makeCanvas(S2, S2);
  const ctx = MAPC.getContext('2d'), img = ctx.createImageData(S2, S2);
  const ld = new THREE.Vector3(-0.6, 0.7, -0.4).normalize();
  for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) {
    const wx = (x / S2) * 2 * ext - ext, wz = (y / S2) * 2 * ext - ext;
    const h = sampleGrid(H, wx, wz);
    const fx = clamp((wx + HALF) / STEP, 0, RES), fz = clamp((wz + HALF) / STEP, 0, RES);
    const k = Math.round(fz) * V + Math.round(fx);
    let r, g, b;
    if (h < 0) {
      const d = clamp(-h / 8, 0, 1);
      r = lerp(0.24, 0.07, d); g = lerp(0.55, 0.2, d); b = lerp(0.6, 0.32, d);
    } else {
      const sh = clamp(NX[k] * ld.x + NY[k] * ld.y + NZ[k] * ld.z, 0, 1) * 0.7 + 0.45;
      r = Math.pow(TCOL[k * 3], 1 / 2.2) * sh; g = Math.pow(TCOL[k * 3 + 1], 1 / 2.2) * sh; b = Math.pow(TCOL[k * 3 + 2], 1 / 2.2) * sh;
      if (PD[k] < 1.6) { r = r * 0.5 + 0.45; g = g * 0.5 + 0.38; b = b * 0.5 + 0.28; }
    }
    const i = (y * S2 + x) * 4;
    img.data[i] = r * 255; img.data[i + 1] = g * 255; img.data[i + 2] = b * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  MAPC.ext = ext;
}
function drawMinimap() {
  const c = $('minimap'), ctx = c.getContext('2d'), W = c.width, half = W / 2;
  const viewR = 75, k = half / viewR;
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.arc(half, half, half - 1, 0, TAU); ctx.clip();
  ctx.fillStyle = '#123142'; ctx.fillRect(0, 0, W, W);
  ctx.translate(half, half);
  ctx.rotate(cam.yaw);
  ctx.scale(k, k);
  ctx.translate(-player.pos.x, -player.pos.z);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(MAPC, -MAPC.ext, -MAPC.ext, MAPC.ext * 2, MAPC.ext * 2);
  ctx.restore();
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const toMap = (x, z, clampR = true) => {
    const dx = (x - player.pos.x) * k, dz = (z - player.pos.z) * k;
    let mx = dx * cy - dz * sy, my = dx * sy + dz * cy;
    const d = Math.hypot(mx, my), lim = half - 12;
    const out = d > lim;
    if (out && clampR) { mx *= lim / d; my *= lim / d; }
    return { x: half + mx, y: half + my, out };
  };
  const obj = objectiveTarget();
  const pulse = 0.5 + 0.5 * Math.sin(S.time * 4);
  shrineObjs.forEach((o) => {
    const p = toMap(o.s.x, o.s.z);
    const isObj = obj.shrine === o;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
    const sz = isObj ? 7 + pulse * 2 : 6;
    ctx.fillStyle = o.lit ? o.s.color : 'rgba(20,16,36,0.85)';
    ctx.strokeStyle = o.lit ? '#fff' : o.s.color; ctx.lineWidth = 2;
    if (o.lit) { ctx.shadowColor = o.s.color; ctx.shadowBlur = 10; }
    ctx.fillRect(-sz / 2, -sz / 2, sz, sz); ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  });
  const lp = toMap(LIGHTHOUSE.x, LIGHTHOUSE.z);
  ctx.save(); ctx.translate(lp.x, lp.y);
  ctx.fillStyle = S.stage === 'lighthouse' ? `rgba(255,214,140,${0.6 + pulse * 0.4})` : '#e8e1d2';
  ctx.strokeStyle = '#a3342e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-2.5, -5); ctx.lineTo(2.5, -5); ctx.lineTo(4, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (S.stage === 'talk' || Math.hypot(keeper.pos.x - player.pos.x, keeper.pos.z - player.pos.z) < viewR) {
    const kp = toMap(keeper.pos.x, keeper.pos.z);
    ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(kp.x, kp.y, S.stage === 'talk' ? 4 + pulse * 2 : 3.5, 0, TAU); ctx.fill();
  }
  seeds.forEach((s) => { if (s.taken) return; const p = toMap(s.x, s.z, false); if (p.out) return; ctx.fillStyle = 'rgba(255,214,120,0.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, TAU); ctx.fill(); });
  // player arrow
  ctx.save(); ctx.translate(half, half);
  const pdx = Math.sin(player.yaw), pdz = Math.cos(player.yaw);
  ctx.rotate(Math.atan2(pdx * cy - pdz * sy, -(pdx * sy + pdz * cy)));
  ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  // north marker
  const nx = half + Math.sin(cam.yaw) * (half - 11), ny = half - Math.cos(cam.yaw) * (half - 11);
  ctx.fillStyle = 'rgba(11,15,28,0.75)'; ctx.beginPath(); ctx.arc(nx, ny, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f3c375'; ctx.font = '800 11px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('K', nx, ny + 0.5);
}

// =====================================================================
//  Dialogue
// =====================================================================
const LINES = {
  intro: [
    'Ela! Demek fırtınayı atlatıp kıyıya çıkabildin. Seni bekliyordum, çocuğum.',
    'Yüz yıldır Lumora\'da güneş doğmuyor. Beş Işık Sunağı söndüğünden beri Sis Ruhları adayı sarıyor.',
    'Ama fenerin hâlâ yanıyor. Ruhlar bu ışıktan korkar. Yaklaşırlarsa ışığını patlat, dağılıp giderler.',
    'Her sunağın başında ışığını uyandır ve ruhlar dağılana dek çemberin içinde kal. Her sunak uyandıkça şafak biraz daha yaklaşacak.',
    'Yolda altın Işık Tohumları göreceksin; fenerini besler, yaralarını sarar. Beşi de uyandığında kuzeydeki Büyük Fener\'e çık.',
    'Bu kamp ateşi güvenlidir; ruhlar ona yaklaşamaz. Haydi, ışığın yolun olsun!',
  ],
  hints: [
    ['Çayır Sunağı batıdaki çiçekli düzlükte. Patikayı izlersen kaybolmazsın.'],
    ['Bir sunak uyandı bile! Hissediyor musun? Sis çoktan incelmeye başladı.'],
    ['Zirve Sunağı dağın tepesinde. Tırmanış zor, ama oradan bütün adayı görebilirsin.'],
    ['Harabeler eski bekçilerin evidir. Oradaki sunak, ruhların en çok toplandığı yerdir. Dikkatli ol.'],
    ['Bir sunak kaldı, Ela. Şafağın kokusunu alıyorum.'],
    ['Beş sunak da uyandı! Şimdi kuzeye, Büyük Fener\'e git. Son ışığı sen yakacaksın.'],
  ],
  done: ['Güneşi geri getirdin. Yüz yıllık bekleyiş bitti. Artık bu ada senin, Bekçi Ela.'],
};
function openDialog(who, lines, onDone) {
  S.prevMode = S.mode === 'dialog' ? S.prevMode : S.mode;
  S.mode = 'dialog';
  S.dlg = { who, lines, i: 0, chars: 0, onDone };
  $('dialog').hidden = false;
  $('dialog').querySelector('.who').textContent = who;
  $('prompt').hidden = true; $('tAct').hidden = true;
}
function updateDialog(dt) {
  const d = S.dlg;
  if (!d) return;
  const line = d.lines[d.i];
  if (d.chars < line.length) {
    const before = Math.floor(d.chars);
    d.chars = Math.min(line.length, d.chars + dt * 48);
    if (Math.floor(d.chars / 4) > Math.floor(before / 4)) AudioFX.talk();
    $('dialog').querySelector('.line').textContent = line.slice(0, Math.floor(d.chars));
  }
}
function advanceDialog() {
  const d = S.dlg;
  if (!d) return;
  const line = d.lines[d.i];
  if (d.chars < line.length) { d.chars = line.length; $('dialog').querySelector('.line').textContent = line; return; }
  d.i++;
  AudioFX.ui();
  if (d.i >= d.lines.length) {
    $('dialog').hidden = true;
    S.dlg = null;
    S.mode = 'play';
    input.jumpQ = input.actQ = false;
    if (d.onDone) d.onDone();
  } else { d.chars = 0; $('dialog').querySelector('.line').textContent = ''; }
}

// =====================================================================
//  Player update
// =====================================================================
const surfaceAt = (x, z, gh) => {
  const th = terrainHeight(x, z);
  if (gh > th + 0.05) return Math.abs(gh - 1.01) < 0.1 ? 'wood' : 'stone';
  if (gh < 2.3) return 'sand';
  return 'grass';
};
function damagePlayer(from) {
  if (player.invuln > 0 || S.mode !== 'play') return;
  player.hp -= 1;
  player.invuln = 1.3;
  _v.subVectors(player.pos, from).setY(0).normalize();
  player.vel.x = _v.x * 9; player.vel.z = _v.z * 9; player.vel.y = 4.5; player.onGround = false;
  cam.shake = 0.45;
  GradeShader.uniforms.uDamage.value = 1;
  AudioFX.hurt();
  renderFlames(true);
  if (player.hp <= 0) die();
}
function die() {
  S.mode = 'dead'; S.deadT = 0;
  $('dead').hidden = false;
  if (S.ritual) endRitual(false);
}
function respawn() {
  const cp = S.checkpoint || { x: CAMP.x + 3, z: CAMP.z + 3 };
  player.pos.set(cp.x, groundAt(cp.x, cp.z), cp.z);
  player.vel.set(0, 0, 0);
  player.hp = player.maxHp; player.energy = 100; player.invuln = 2;
  renderFlames();
  for (const w of wisps) if (w.pos.distanceTo(player.pos) < 30) killWisp(w, true);
  cam.target.copy(player.pos);
  scarfA.reset(); scarfB.reset();
  $('dead').hidden = true;
  S.mode = 'play';
}
function doBurst() {
  player.energy -= 20; player.burstCd = 0.65; player.attackT = 0.5;
  const c = new THREE.Vector3(); lantern.flame.getWorldPosition(c);
  spawnRing(_v.copy(player.pos).setY(player.pos.y + 0.25), 7.5, new THREE.Color(3.2, 2.2, 1.0), 0.5);
  sparkBurst(c, IS_MOBILE ? 30 : 50, new THREE.Color(3, 2, 0.8), 7, 0.6, 0.8, 0.22);
  lantern.light.intensity = 60;
  cam.shake = 0.18;
  GradeShader.uniforms.uFlash.value = 0.12;
  AudioFX.burst();
  for (const w of wisps) {
    if (w.state !== 'hunt' && w.state !== 'spawn') continue;
    const d = w.pos.distanceTo(player.pos);
    if (d < 8) { w.pendingKill = d * 0.035; w.hit = 1; }
  }
}
let stepSign = 1;
function updatePlayer(dt) {
  const P = player;
  const playing = S.mode === 'play';
  let mx = 0, my = 0, speedT = 0;
  if (playing) {
    const K = input.keys;
    if (K.has('KeyW') || K.has('ArrowUp')) my += 1;
    if (K.has('KeyS') || K.has('ArrowDown')) my -= 1;
    if (K.has('KeyA') || K.has('ArrowLeft')) mx -= 1;
    if (K.has('KeyD') || K.has('ArrowRight')) mx += 1;
    const km = Math.hypot(mx, my);
    if (km > 0) { mx /= km; my /= km; speedT = K.has('ShiftLeft') || K.has('ShiftRight') ? 8.6 : 5.6; }
    else if (input.stickId !== null) {
      const sm = Math.min(1, input.stick.length());
      if (sm > 0.08) { mx = input.stick.x / Math.max(sm, 1e-3); my = input.stick.y / Math.max(sm, 1e-3); speedT = smooth(0.08, 0.95, sm) * 7.6; }
    }
  }
  if (P.swim) speedT *= 0.55;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const wx = fx * my + rx * mx, wz = fz * my + rz * mx;
  const acc = P.onGround || P.swim ? 12 : 3.5;
  P.vel.x = damp(P.vel.x, wx * speedT, acc, dt);
  P.vel.z = damp(P.vel.z, wz * speedT, acc, dt);
  if (input.jumpQ) { P.jumpBuf = 0.15; input.jumpQ = false; }
  P.jumpBuf -= dt;
  P.coyote = P.onGround ? 0.12 : P.coyote - dt;
  if (playing && P.jumpBuf > 0 && P.coyote > 0 && !P.swim) {
    P.vel.y = 8.4; P.onGround = false; P.coyote = 0; P.jumpBuf = 0;
    AudioFX.jump();
    for (let i = 0; i < 8; i++) smoke.spawn(P.pos.x, P.pos.y + 0.1, P.pos.z, R(-1.5, 1.5), R(0.2, 0.8), R(-1.5, 1.5), 0.7, 0.35, 0.9, 0.75, 0.68, 0.58, 0.35, 0, 3);
  }
  if (!P.swim) P.vel.y -= (P.vel.y < 0 ? 30 : 22) * dt;
  P.pos.addScaledVector(P.vel, dt);
  // colliders
  for (const c of collidersAt(P.pos.x, P.pos.z)) {
    const dx = P.pos.x - c.x, dz = P.pos.z - c.z, rr = c.r + 0.32, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      P.pos.x = c.x + nx * rr; P.pos.z = c.z + nz * rr;
      const vn = P.vel.x * nx + P.vel.z * nz;
      if (vn < 0) { P.vel.x -= vn * nx; P.vel.z -= vn * nz; }
    }
  }
  const rad = Math.hypot(P.pos.x, P.pos.z);
  if (rad > 205) { P.pos.x *= 205 / rad; P.pos.z *= 205 / rad; }
  const gh = groundAt(P.pos.x, P.pos.z);
  const wasGround = P.onGround;
  if (gh < -0.8) {
    if (!P.swim) { for (let i = 0; i < 14; i++) smoke.spawn(P.pos.x, 0.05, P.pos.z, R(-2, 2), R(1, 3), R(-2, 2), 0.8, 0.25, 0.6, 0.9, 0.95, 1, 0.6, 9, 1); }
    P.swim = true; P.onGround = false;
    P.pos.y = damp(P.pos.y, -0.98, 6, dt); P.vel.y = 0;
    if (Math.hypot(P.vel.x, P.vel.z) > 1 && rnd() < dt * 12) smoke.spawn(P.pos.x + R(-0.3, 0.3), 0.04, P.pos.z + R(-0.3, 0.3), 0, 0.2, 0, 1.0, 0.3, 1.2, 0.85, 0.92, 0.95, 0.45, 0, 1);
  } else {
    P.swim = false;
    if (P.pos.y <= gh) {
      if (!wasGround && P.vel.y < -7) {
        AudioFX.land(); P.landed = 0.25;
        for (let i = 0; i < 10; i++) smoke.spawn(P.pos.x, gh + 0.05, P.pos.z, R(-2, 2), R(0.1, 0.6), R(-2, 2), 0.8, 0.3, 1.0, 0.75, 0.68, 0.58, 0.35, 0, 3);
      }
      P.pos.y = gh; P.vel.y = 0; P.onGround = true;
    } else if (wasGround && P.pos.y - gh < 0.45 && P.vel.y <= 0) { P.pos.y = gh; P.vel.y = 0; P.onGround = true; }
    else P.onGround = false;
  }
  // facing
  const hs = Math.hypot(P.vel.x, P.vel.z);
  const prevYaw = P.yaw;
  if (hs > 0.4 && speedT > 0) P.yaw = lerpAngle(P.yaw, Math.atan2(P.vel.x, P.vel.z), 1 - Math.exp(-dt * 11));
  P.turnRate = damp(P.turnRate, (((P.yaw - prevYaw + Math.PI) % TAU + TAU) % TAU - Math.PI) / Math.max(dt, 1e-3), 8, dt);
  // timers & actions
  P.invuln -= dt; P.burstCd -= dt; P.attackT -= dt; P.landed -= dt;
  P.energy = Math.min(100, P.energy + dt * 6);
  if (input.burstQ) { input.burstQ = false; if (playing && P.burstCd <= 0 && P.energy >= 20) doBurst(); }
  // footsteps
  const s = Math.sin(ela.phase);
  if (P.onGround && hs > 0.8 && Math.sign(s) !== stepSign) {
    stepSign = Math.sign(s) || 1;
    const surf = surfaceAt(P.pos.x, P.pos.z, gh);
    AudioFX.step(surf);
    if (hs > 6 && surf !== 'wood') smoke.spawn(P.pos.x, gh + 0.05, P.pos.z, R(-0.4, 0.4) - P.vel.x * 0.05, R(0.2, 0.5), R(-0.4, 0.4) - P.vel.z * 0.05, 0.7, 0.25, 0.8, 0.72, 0.64, 0.52, 0.3, 0, 2);
  }
  if (P.swim && hs > 0.8 && Math.sign(s) !== stepSign) { stepSign = Math.sign(s) || 1; AudioFX.step('water'); }
  // visuals
  ela.root.position.copy(P.pos);
  if (P.landed > 0) ela.root.position.y -= Math.sin((P.landed / 0.25) * Math.PI) * 0.06;
  ela.root.rotation.y = P.yaw;
  ela.root.visible = !(P.invuln > 0 && P.invuln < 1.3 && Math.floor(P.invuln * 14) % 2 === 0 && S.mode === 'play');
  const atk = P.attackT > 0 ? Math.sin((1 - P.attackT / 0.5) * Math.PI) : 0;
  const talkingTo = S.mode === 'dialog';
  let look = 0;
  if (talkingTo) look = clamp(lerpAngle(0, Math.atan2(keeper.pos.x - P.pos.x, keeper.pos.z - P.pos.z) - P.yaw, 1), -1, 1);
  animateHuman(ela, dt, { speed: hs, air: !P.onGround && !P.swim, swim: P.swim, attack: atk, turnRate: P.turnRate, holdLantern: true, look });
  // lantern hangs upright and swings
  ela.root.updateMatrixWorld(true);
  ela.arms[1].hand.getWorldQuaternion(_q);
  _e.set(Math.sin(S.time * 3.1) * 0.08 + (hs > 1 ? Math.sin(ela.phase * 2) * 0.15 : 0) - clamp(hs * 0.03, 0, 0.25), P.yaw, Math.sin(S.time * 2.3) * 0.06 - P.turnRate * 0.04, 'YXZ');
  lantern.g.quaternion.copy(_q.invert()).multiply(new THREE.Quaternion().setFromEuler(_e));
  const e01 = P.energy / 100;
  const flick = 0.9 + Math.sin(S.time * 17) * 0.05 + Math.sin(S.time * 31) * 0.04 + (rnd() - 0.5) * 0.05;
  lantern.light.intensity = damp(lantern.light.intensity, (2.5 + e01 * 4.5) * flick * (1 - atm.t / 9), 8, dt);
  lantern.flameMat.color.setRGB(5 * flick * (0.5 + e01 * 0.5), 3 * flick * (0.5 + e01 * 0.5), 1.2);
  lantern.glassMat.emissiveIntensity = (0.6 + e01) * flick;
  // scarf tails
  const side = _v.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw)).multiplyScalar(-1);
  const back = _v2.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  const neck = new THREE.Vector3(); ela.head.getWorldPosition(neck); neck.y -= 0.17; neck.addScaledVector(back, 0.09);
  const hipW = new THREE.Vector3(); ela.hips.getWorldPosition(hipW);
  const wind = new THREE.Vector3(1.5 + Math.sin(S.time * 0.7) * 1.2, 0.5, 0.8 + Math.sin(S.time * 1.3) * 0.8);
  scarfA.update(dt, neck.clone().addScaledVector(side, 0.03), side, hipW, neck, wind);
  scarfB.update(dt, neck.clone().addScaledVector(side, -0.04), side, hipW, neck, wind);
}

// =====================================================================
//  Wisps, seeds, shrines, world FX
// =====================================================================
const COL_SPIRIT = new THREE.Color(0.5, 0.3, 1.2);
function updateWisps(dt) {
  const target = _v.copy(player.pos); target.y += 1.1;
  for (let i = wisps.length - 1; i >= 0; i--) {
    const w = wisps[i];
    w.t += dt;
    if (w.pendingKill !== undefined) { w.pendingKill -= dt; if (w.pendingKill <= 0) { w.pendingKill = undefined; killWisp(w); S.kills++; AudioFX.wispDie(); player.energy = Math.min(100, player.energy + 4); } }
    w.hit = Math.max(0, w.hit - dt * 3);
    w.m.material.uniforms.uHit.value = w.hit;
    if (w.state === 'spawn') {
      if (w.t < 0) { w.g.visible = false; continue; }
      if (!w.g.visible) { w.g.visible = true; AudioFX.wispSpawn(); sparkBurst(w.pos, 14, COL_SPIRIT, 2, 1, 1, 0.3); }
      w.g.scale.setScalar(smooth(0, 0.9, w.t));
      if (w.t > 0.9) w.state = 'hunt';
    } else if (w.state === 'die') {
      const k = w.t / 0.45;
      w.g.scale.setScalar((1 + k * 0.5) * (1 - k));
      w.m.material.uniforms.uFade.value = k;
      if (k >= 1) { scene.remove(w.g); w.m.material.dispose(); wisps.splice(i, 1); }
      continue;
    }
    if (w.state !== 'hunt') continue;
    const toP = _v2.subVectors(target, w.pos);
    const d = toP.length();
    const aggro = S.ritual ? 60 : 19;
    const desired = new THREE.Vector3();
    const campD = Math.hypot(w.pos.x - CAMP.x, w.pos.z - CAMP.z);
    if (w.cool > 0) { w.cool -= dt; desired.copy(toP).multiplyScalar(-2.5 / Math.max(d, 0.01)); }
    else if (d < aggro && S.mode === 'play' && player.hp > 0) desired.copy(toP).multiplyScalar(4.4 / Math.max(d, 0.01));
    else {
      const a = w.t * 0.4 + w.seed;
      desired.set(w.home.x + Math.cos(a) * 6 - w.pos.x, 0, w.home.z + Math.sin(a * 1.3) * 6 - w.pos.z).multiplyScalar(0.4);
    }
    if (campD < 20) desired.set(w.pos.x - CAMP.x, 0, w.pos.z - CAMP.z).normalize().multiplyScalar(5);
    for (const o of wisps) {
      if (o === w || o.state !== 'hunt') continue;
      const dx = w.pos.x - o.pos.x, dz = w.pos.z - o.pos.z, dd = dx * dx + dz * dz;
      if (dd < 2.2 && dd > 1e-4) { desired.x += (dx / dd) * 1.5; desired.z += (dz / dd) * 1.5; }
    }
    w.vel.x = damp(w.vel.x, desired.x, 2.6, dt); w.vel.z = damp(w.vel.z, desired.z, 2.6, dt);
    const gy = Math.max(groundAt(w.pos.x, w.pos.z), 0) + 1.25 + Math.sin(w.t * 2.2 + w.seed) * 0.25;
    w.vel.y = damp(w.vel.y, (gy - w.pos.y) * 3 + (d < aggro ? toP.y * 0.3 : 0), 3, dt);
    w.pos.addScaledVector(w.vel, dt);
    w.g.rotation.y = Math.atan2(target.x - w.pos.x, target.z - w.pos.z);
    w.m.rotation.z = Math.sin(w.t * 2 + w.seed) * 0.2;
    if (rnd() < dt * 18) smoke.spawn(w.pos.x + R(-0.2, 0.2), w.pos.y + R(-0.3, 0.1), w.pos.z + R(-0.2, 0.2), -w.vel.x * 0.2 + R(-0.2, 0.2), R(-0.1, 0.4), -w.vel.z * 0.2 + R(-0.2, 0.2), 1.3, 0.5, 1.3, 0.12, 0.07, 0.2, 0.55, -0.2, 1.2);
    if (rnd() < dt * 5) glow.spawn(w.pos.x + R(-0.3, 0.3), w.pos.y + R(-0.3, 0.3), w.pos.z + R(-0.3, 0.3), 0, R(0.2, 0.6), 0, 0.9, 0.12, 0.02, 0.6, 0.35, 1.4, 1);
    if (d < 0.95 && w.cool <= 0 && S.mode === 'play' && player.invuln <= 0) { damagePlayer(w.pos); w.cool = 1.4; w.vel.copy(toP).multiplyScalar(-6 / Math.max(d, 0.01)); }
  }
  // ambient spawning
  if (S.mode === 'play' && S.stage !== 'done' && S.stage !== 'talk') {
    S.wispTimer -= dt;
    if (S.wispTimer <= 0) {
      S.wispTimer = 10 + litCount() * 3 + rnd() * 5;
      const roam = wisps.filter((w) => !w.guard).length;
      if (roam < 3 + (5 - litCount()) * 0.4) {
        for (let k = 0; k < 6; k++) {
          const a = rnd() * TAU, r = R(24, 34), x = player.pos.x + Math.cos(a) * r, z = player.pos.z + Math.sin(a) * r;
          if (terrainHeight(x, z) < 1 || Math.hypot(x - CAMP.x, z - CAMP.z) < 30) continue;
          if (shrineObjs.some((o) => o.lit && Math.hypot(x - o.s.x, z - o.s.z) < 35)) continue;
          spawnWisp(x, z); break;
        }
      }
    }
  }
}
function updateSeeds(dt) {
  const d = new THREE.Object3D(), halo = seedHalo.geometry.attributes.position;
  seeds.forEach((s, i) => {
    if (s.taken) { d.scale.setScalar(0); d.updateMatrix(); seedMesh.setMatrixAt(i, d.matrix); halo.setXYZ(i, 0, -999, 0); return; }
    const dist = Math.hypot(s.x - player.pos.x, s.z - player.pos.z);
    if (dist < 4.5 && S.mode === 'play') s.mag = Math.min(1, s.mag + dt * 2);
    let x = s.x, y = s.y + Math.sin(S.time * 2 + s.phase) * 0.18, z = s.z;
    if (s.mag > 0) {
      const k = s.mag * s.mag;
      s.x = lerp(s.x, player.pos.x, k * dt * 6); s.z = lerp(s.z, player.pos.z, k * dt * 6); s.y = lerp(s.y, player.pos.y + 1.1, k * dt * 6);
      x = s.x; z = s.z; y = s.y;
    }
    if (dist < 1.1 && S.mode === 'play') {
      s.taken = true;
      const n = seeds.filter((q) => q.taken).length;
      player.energy = Math.min(100, player.energy + 25);
      if (player.hp < player.maxHp) { player.hp++; renderFlames(); }
      sparkBurst(new THREE.Vector3(x, y, z), 24, new THREE.Color(3, 2.2, 0.9), 3, 1.5, 0.9, 0.2);
      AudioFX.pickup(n);
      $('seedCount').textContent = n;
      if (n === seeds.length) toast('Bütün Işık Tohumları', 'Lumora\'nın her köşesi aydınlandı');
      save();
    }
    d.position.set(x, y, z);
    d.rotation.set(S.time, S.time * 1.3, 0);
    d.scale.setScalar(1 + Math.sin(S.time * 4 + s.phase) * 0.12);
    d.updateMatrix();
    seedMesh.setMatrixAt(i, d.matrix);
    halo.setXYZ(i, x, y, z);
  });
  seedMesh.instanceMatrix.needsUpdate = true;
  halo.needsUpdate = true;
}
function setShrineLit(o, instant) {
  o.lit = true; S.lit[o.idx] = true;
  o.beam.visible = true;
  if (instant) o.glow = 1;
}
function updateShrines(dt) {
  for (const o of shrineObjs) {
    const dist = Math.hypot(o.s.x - player.pos.x, o.s.z - player.pos.z);
    o.glow = damp(o.glow, o.lit ? 1 : 0, 0.8, dt);
    const ritualHere = S.ritual && S.ritual.kind === 'shrine' && S.ritual.idx === o.idx;
    const rp = ritualHere ? S.ritual.t / S.ritual.dur : 0;
    o.crystal.rotation.y += dt * (0.4 + o.glow * 1.2 + rp * 4);
    o.crystal.position.y = 3.1 + Math.sin(S.time * 1.4 + o.idx) * (0.08 + o.glow * 0.12);
    o.orbit.rotation.y += dt * (0.2 + o.glow * 0.8 + rp * 3);
    o.orbit.position.y = 3.1 + o.glow * 0.4;
    o.crystalMat.emissiveIntensity = 0.12 + o.glow * 3.2 + rp * 2.5 + Math.sin(S.time * 3) * 0.05;
    o.rune.material.color.copy(o.lit ? new THREE.Color(o.s.color) : new THREE.Color('#4a4166')).multiplyScalar(0.35 + o.glow * 1.4 + rp * 1.6 + (ritualHere ? Math.sin(S.time * 8) * 0.2 : 0));
    o.rune.rotation.z += dt * (0.05 + o.glow * 0.1 + rp * 0.8);
    o.beam.material.uniforms.uI.value = o.glow * clamp(1.1 - atm.t / 6, 0.25, 0.9);
    if (!o.lit && !o.guarded && dist < 48 && S.stage !== 'talk' && S.mode === 'play') {
      o.guarded = true;
      for (let k = 0; k < 2 + Math.floor(o.idx / 2); k++) {
        const a = rnd() * TAU, w = spawnWisp(o.s.x + Math.cos(a) * 10, o.s.z + Math.sin(a) * 10, new THREE.Vector3(o.s.x, o.s.h + 1.3, o.s.z), k * 0.4);
        if (w) w.guard = true;
      }
    }
    if (dist < 70) {
      if (o.lit && rnd() < dt * 8) glow.spawn(o.s.x + R(-3, 3), o.s.h + 0.8, o.s.z + R(-3, 3), 0, R(1, 2.5), 0, 2.4, 0.2, 0.02, ...new THREE.Color(o.s.color).multiplyScalar(2).toArray(), 1);
      if (!o.lit && rnd() < dt * 6) {
        const a = rnd() * TAU;
        smoke.spawn(o.s.x + Math.cos(a) * 6, o.s.h + 0.7, o.s.z + Math.sin(a) * 6, -Math.sin(a) * 1.2, R(0.1, 0.4), Math.cos(a) * 1.2, 3, 1.2, 2.6, 0.18, 0.12, 0.28, 0.35, -0.05, 0.3);
      }
      if (ritualHere && rnd() < dt * 40) {
        const a = rnd() * TAU, rr = R(1, 5);
        glow.spawn(o.s.x + Math.cos(a) * rr, o.s.h + 0.7, o.s.z + Math.sin(a) * rr, -Math.cos(a) * rr * 0.3, R(2, 4), -Math.sin(a) * rr * 0.3, 1.0, 0.18, 0.02, ...new THREE.Color(o.s.color).multiplyScalar(2.2).toArray(), 1);
      }
    }
  }
}
function updateCampfire(dt) {
  const d = player.pos.distanceTo(CAMPFIRE.pos);
  const flick = 0.85 + Math.sin(S.time * 13) * 0.08 + Math.sin(S.time * 23.7) * 0.06 + (rnd() - 0.5) * 0.08;
  CAMPFIRE.light.intensity = 22 * flick * (1 - atm.t / 12);
  if (d < 80 || S.mode === 'title') {
    const p = CAMPFIRE.pos;
    if (rnd() < dt * 50) glow.spawn(p.x + R(-0.25, 0.25), p.y + R(0, 0.1), p.z + R(-0.25, 0.25), R(-0.2, 0.2), R(1.2, 2.2), R(-0.2, 0.2), R(0.5, 0.9), 0.55, 0.08, 2.6, R(0.8, 1.3), 0.2, 1, -0.6, 1.2);
    if (rnd() < dt * 6) glow.spawn(p.x, p.y + 0.4, p.z, R(-0.5, 0.5), R(1.5, 3), R(-0.5, 0.5), R(1.2, 2.2), 0.06, 0.03, 3, 1.4, 0.3, 1, 0, 0.4);
    if (rnd() < dt * 8) smoke.spawn(p.x + R(-0.2, 0.2), p.y + 1.0, p.z + R(-0.2, 0.2), R(0.1, 0.4), R(0.6, 1.0), R(-0.1, 0.2), 4, 0.5, 2.5, 0.3, 0.28, 0.27, 0.22, -0.05, 0.2);
  }
  CAMPFIRE.boat.position.y = 0.05 + Math.sin(S.time * 1.1) * 0.06;
  CAMPFIRE.boat.rotation.z = Math.sin(S.time * 0.9) * 0.04;
  CAMPFIRE.boat.rotation.x = Math.sin(S.time * 0.7) * 0.025;
}
function updateKeeper(dt) {
  const k = keeper;
  const d = Math.hypot(player.pos.x - k.pos.x, player.pos.z - k.pos.z);
  k.talk = damp(k.talk, S.mode === 'dialog' ? 1 : 0, 5, dt);
  const toP = Math.atan2(player.pos.x - k.pos.x, player.pos.z - k.pos.z) - k.root.rotation.y;
  const look = d < 9 || S.mode === 'title' ? clamp(lerpAngle(0, toP, 1), -1.1, 1.1) : Math.sin(S.time * 0.3) * 0.4;
  animateHuman(k, dt, { speed: 0, talk: k.talk, look, lookUp: 0.05, stoop: 0.12, talkArm: -1, staff: true });
  // keep the staff upright in world space, gripped a third of the way down
  k.root.updateMatrixWorld(true);
  k.arms[0].hand.getWorldQuaternion(_q);
  k.staff.quaternion.copy(_q.invert()).multiply(new THREE.Quaternion().setFromEuler(_e.set(0.05, k.root.rotation.y, 0.04)));
  k.staff.position.set(0, -0.3, 0).applyQuaternion(k.staff.quaternion);
}
function updateLighthouse(dt) {
  if (S.stage === 'lighthouse' || S.ritual?.kind === 'lh') LH.doorMat.emissiveIntensity = 0.4 + Math.sin(S.time * 3) * 0.3;
  else LH.doorMat.emissiveIntensity = damp(LH.doorMat.emissiveIntensity, 0, 2, dt);
  if (LH.lit > 0) {
    LH.lit = Math.min(1, LH.lit + dt * 0.25);
    const e = LH.lit;
    LH.lensMat.color.setRGB(0.25 + e * 9, 0.2 + e * 7, 0.15 + e * 4);
    LH.glassMat.emissiveIntensity = e * 2.5;
    LH.winM.emissiveIntensity = e * 2;
    LH.beamGroup.visible = true;
    LH.beamMat.uniforms.uI.value = e * 1.1;
    LH.beamGroup.rotation.y += dt * 0.5;
  }
}

// =====================================================================
//  Rituals & progression
// =====================================================================
function startRitual(kind, idx) {
  const center = kind === 'lh' ? new THREE.Vector3(LIGHTHOUSE.x, LIGHTHOUSE.h, LIGHTHOUSE.z + 7) : new THREE.Vector3(SHRINES[idx].x, SHRINES[idx].h, SHRINES[idx].z);
  S.ritual = { kind, idx, t: 0, dur: kind === 'lh' ? 12 : 8, waves: kind === 'lh' ? [0.4, 3, 6, 9] : [0.4, 3.4, 6], wi: 0, center, tick: 0, radius: kind === 'lh' ? 10 : 7.6 };
  $('ritual').hidden = false;
  $('ritualLabel').textContent = kind === 'lh' ? 'Fener tutuşuyor' : 'Sunak uyanıyor';
  AudioFX.ui();
  toast(kind === 'lh' ? 'Son Işık' : SHRINES[idx].name, 'Çemberin içinde kal ve ruhları dağıt', kind === 'lh' ? '#ffe2a6' : SHRINES[idx].color);
}
function endRitual(success) {
  const r = S.ritual;
  S.ritual = null;
  $('ritual').hidden = true;
  if (!success || !r) return;
  if (r.kind === 'lh') { finale(); return; }
  const o = shrineObjs[r.idx];
  setShrineLit(o);
  const n = litCount();
  const c = new THREE.Color(o.s.color).multiplyScalar(2.5);
  sparkBurst(new THREE.Vector3(o.s.x, o.s.h + 3, o.s.z), IS_MOBILE ? 70 : 140, c, 9, 1.5, 1.6, 0.35);
  spawnRing(new THREE.Vector3(o.s.x, o.s.h + 0.7, o.s.z), 40, c, 1.4);
  GradeShader.uniforms.uFlash.value = 0.25;
  cam.shake = 0.3;
  for (const w of wisps) if (w.pos.distanceTo(r.center) < 50) { w.pendingKill = w.pos.distanceTo(r.center) * 0.02; }
  atm.target = n;
  AudioFX.lit();
  AudioFX.mood = n >= 5 ? 2 : n >= 2 ? 1 : 0;
  player.hp = player.maxHp; player.energy = 100; renderFlames();
  S.checkpoint = { x: o.s.x + 3, z: o.s.z + 9 };
  toast(`${o.s.name} Uyandı`, n < 5 ? `Şafak yaklaşıyor · ${n}/5` : 'Beş sunak da uyandı', o.s.color);
  if (n >= 5) {
    S.stage = 'lighthouse';
    setTimeout(() => toast('Büyük Fener', 'Kuzeye git ve son ışığı yak', '#ffe2a6'), 4600);
  }
  save();
}
function updateRitual(dt) {
  const r = S.ritual;
  if (!r) return;
  const d = Math.hypot(player.pos.x - r.center.x, player.pos.z - r.center.z);
  const inside = d < r.radius;
  if (S.mode === 'play') r.t = inside ? r.t + dt : Math.max(0, r.t - dt * 0.6);
  $('ritualLabel').textContent = inside ? (r.kind === 'lh' ? 'Fener tutuşuyor' : 'Sunak uyanıyor') : 'Çembere geri dön!';
  const p = r.t / r.dur;
  $('ritualArc').style.strokeDashoffset = (276.5 * (1 - p)).toFixed(1);
  if (Math.floor(r.t) > r.tick && inside) { r.tick = Math.floor(r.t); AudioFX.ritualTick(p); }
  while (r.wi < r.waves.length && r.t >= r.waves[r.wi]) {
    const n = (r.kind === 'lh' ? 2 : 1) + Math.floor((r.kind === 'lh' ? 5 : r.idx + litCount()) / 3);
    for (let k = 0; k < n; k++) {
      const a = rnd() * TAU, rr = 13 + rnd() * 4;
      const w = spawnWisp(r.center.x + Math.cos(a) * rr, r.center.z + Math.sin(a) * rr, null, k * 0.35);
      if (w) w.home.copy(r.center);
    }
    r.wi++;
  }
  if (r.t >= r.dur) endRitual(true);
}
function finale() {
  S.mode = 'cine';
  S.cine = { t: 0 };
  S.stage = 'done'; S.finished = true;
  atm.target = 6;
  LH.lit = 0.001;
  AudioFX.finale(); AudioFX.mood = 2;
  for (const w of wisps) killWisp(w);
  GradeShader.uniforms.uFlash.value = 0.4;
  $('hud').hidden = true; $('touch').hidden = true;
  cam.from.copy(camera.position);
  const look = new THREE.Vector3(); camera.getWorldDirection(look); cam.fromLook.copy(camera.position).addScaledVector(look, 10);
  save();
}
function updateCine(dt) {
  const c = S.cine;
  c.t += dt;
  const L = LIGHTHOUSE, a = c.t * 0.12 + 1.2;
  const pos = new THREE.Vector3(L.x + Math.sin(a) * 46, L.h + 10 + c.t * 1.2, L.z + Math.cos(a) * 46);
  const look = new THREE.Vector3(L.x, L.h + 18, L.z);
  const e = ease(Math.min(1, c.t / 3));
  camera.position.lerpVectors(cam.from, pos, e);
  camera.lookAt(_v.lerpVectors(cam.fromLook, look, e));
  if (c.t > 11 && $('ending').hidden) showEnding();
}
function showEnding() {
  const m = Math.floor(S.time / 60), s = Math.floor(S.time % 60);
  $('endStats').innerHTML = `<span>Yolculuk süresi</span><span>${m} dk ${String(s).padStart(2, '0')} sn</span>
    <span>Işık Tohumu</span><span>${seeds.filter((q) => q.taken).length} / ${seeds.length}</span>
    <span>Dağıtılan Sis Ruhu</span><span>${S.kills}</span>`;
  $('ending').hidden = false;
  S.mode = 'ending';
}
function freeRoam() {
  $('ending').hidden = true;
  $('hud').hidden = false;
  if (IS_TOUCH) $('touch').hidden = false;
  cam.blend = 0; cam.from.copy(camera.position);
  const look = new THREE.Vector3(); camera.getWorldDirection(look); cam.fromLook.copy(camera.position).addScaledVector(look, 10);
  S.mode = 'play';
}

// ---------- interaction ----------
function updateInteract() {
  let it = null;
  if (S.mode === 'play' && !S.ritual) {
    const dk = Math.hypot(player.pos.x - keeper.pos.x, player.pos.z - keeper.pos.z);
    if (dk < 3.4) it = { label: 'Konuş', act: talkKeeper };
    if (S.stage !== 'talk') for (const o of shrineObjs) {
      if (!o.lit && Math.hypot(player.pos.x - o.s.x, player.pos.z - o.s.z) < 6.6) it = { label: 'Uyandır', act: () => startRitual('shrine', o.idx) };
    }
    if (S.stage === 'lighthouse' && player.pos.distanceTo(LH.door) < 6) it = { label: 'Feneri Yak', act: () => startRitual('lh') };
  }
  S.interact = it;
  const pr = $('prompt'), ta = $('tAct');
  if (it) {
    if (input.usingTouch) { pr.hidden = true; ta.hidden = false; ta.textContent = it.label; }
    else { ta.hidden = true; pr.hidden = false; $('promptText').textContent = it.label; }
  } else { pr.hidden = true; ta.hidden = true; }
  if (input.actQ) { input.actQ = false; if (it) it.act(); }
}
function talkKeeper() {
  if (!S.talked) {
    openDialog('Bekçi Ilgaz', LINES.intro, () => {
      S.talked = true; S.stage = 'shrines'; S.wispTimer = 12;
      toast('Beş Işık Sunağı', 'Haritadaki elmasları izle');
      save();
    });
  } else if (S.stage === 'done') openDialog('Bekçi Ilgaz', LINES.done);
  else openDialog('Bekçi Ilgaz', LINES.hints[S.stage === 'lighthouse' ? 5 : litCount()]);
}

// =====================================================================
//  Menus
// =====================================================================
function show(id, v) { $(id).hidden = !v; }
function syncSegs() {
  document.querySelectorAll('#qualitySeg button').forEach((b) => b.classList.toggle('on', b.dataset.q === qualityName));
  document.querySelectorAll('#soundSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.s === '1') === AudioFX.on));
}
let pauseFromTitle = false;
function openPause(fromTitle = false) {
  pauseFromTitle = fromTitle;
  if (!fromTitle) { S.prevMode = S.mode; S.mode = 'pause'; }
  $('btnRestart').hidden = fromTitle; $('confirm').hidden = true;
  syncSegs();
  show('pause', true);
}
function closePause() {
  show('pause', false);
  if (!pauseFromTitle) { S.mode = S.prevMode === 'pause' ? 'play' : S.prevMode; last = performance.now(); }
}
function applyQuality(name) {
  qualityName = name; Q = PRESETS[name]; store.set('lumora-quality', name);
  renderer.shadowMap.enabled = Q.shadows;
  sunLight.castShadow = Q.shadows;
  sunLight.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
  if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
  scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  if (bloomPass) bloomPass.enabled = Q.bloom;
  if (grassMesh) grassMesh.geometry.instanceCount = Math.floor(GRASS_MAX * Q.grass);
  prScale = 1;
  resize();
}
$('qualitySeg').addEventListener('click', (e) => { const q = e.target.dataset?.q; if (q) { applyQuality(q); syncSegs(); AudioFX.ui(); } });
$('soundSeg').addEventListener('click', (e) => { const s = e.target.dataset?.s; if (s !== undefined) { AudioFX.init(); AudioFX.setOn(s === '1'); syncSegs(); AudioFX.ui(); } });
$('btnPause').addEventListener('click', () => openPause());
$('btnResume').addEventListener('click', () => closePause());
$('btnRestart').addEventListener('click', () => { $('confirm').hidden = false; });
$('btnRestartNo').addEventListener('click', () => { $('confirm').hidden = true; });
$('btnRestartYes').addEventListener('click', () => { store.del(SAVE_KEY); location.reload(); });
$('btnEndRestart').addEventListener('click', () => { store.del(SAVE_KEY); location.reload(); });
$('btnFreeRoam').addEventListener('click', freeRoam);
$('btnTitleSettings').addEventListener('click', () => { AudioFX.init(); openPause(true); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (S.mode === 'play') openPause(); AudioFX.ctx?.suspend(); }
  else AudioFX.ctx?.resume();
});

function beginPlay(fromSave) {
  show('title', false); show('intro', false);
  show('hud', true);
  if (IS_TOUCH) { show('touch', true); $('stick').className = 'idle'; $('stick').style.left = '110px'; $('stick').style.top = (innerHeight - 130) + 'px'; }
  cam.from.copy(camera.position);
  const look = new THREE.Vector3(); camera.getWorldDirection(look); cam.fromLook.copy(camera.position).addScaledVector(look, 12);
  cam.blend = 0;
  cam.yaw = player.yaw + Math.PI;
  cam.target.copy(player.pos).setY(player.pos.y + 1.55);
  renderFlames();
  $('seedTotal').textContent = seeds.length;
  $('seedCount').textContent = seeds.filter((s) => s.taken).length;
  S.mode = 'play';
  if (!fromSave) setTimeout(() => toast('Lumora', 'Alacakaranlık Adası'), 900);
  last = performance.now();
}
function newGame() {
  AudioFX.init(); AudioFX.ui();
  store.del(SAVE_KEY);
  show('title', false); show('intro', true);
  S.mode = 'intro';
}
function continueGame(d) {
  AudioFX.init(); AudioFX.ui();
  S.lit = d.lit || S.lit; S.stage = d.stage || 'shrines'; S.kills = d.kills || 0; S.time = d.time || 0; S.talked = !!d.talked; S.finished = !!d.finished;
  S.lit.forEach((v, i) => { if (v) setShrineLit(shrineObjs[i], true); });
  (d.seeds || []).forEach((v, i) => { if (v && seeds[i]) seeds[i].taken = true; });
  const n = litCount();
  atm.target = atm.t = S.finished ? 6 : n;
  AudioFX.mood = n >= 5 ? 2 : n >= 2 ? 1 : 0;
  if (S.finished) { LH.lit = 1; S.stage = 'done'; }
  S.checkpoint = d.cp || null;
  if (S.checkpoint) player.pos.set(S.checkpoint.x, groundAt(S.checkpoint.x, S.checkpoint.z), S.checkpoint.z);
  updateEnv();
  beginPlay(true);
}
$('btnNew').addEventListener('click', newGame);
$('btnIntro').addEventListener('click', () => { AudioFX.ui(); beginPlay(false); });

// =====================================================================
//  Main loop
// =====================================================================
let last = performance.now();
let fpsT = 0, fpsN = 0, fpsAcc = 0, mapT = 0;
const titleLook = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  // rAF timestamps can precede a performance.now() taken during the previous task
  const dt = clamp((now - last) / 1000, 0, 1 / 20);
  last = Math.max(last, now);
  if (S.mode === 'pause' || S.mode === 'loading' || dt === 0) return;
  tick(dt);
  composer.render(dt);
  // adaptive resolution
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT > 3) {
    const fps = fpsN / fpsAcc;
    if (fps < 40 && prScale > 0.55) { prScale = Math.max(0.55, prScale - 0.12); resize(); }
    else if (fps > 57 && prScale < 1) { prScale = Math.min(1, prScale + 0.06); resize(); }
    fpsT = fpsN = fpsAcc = 0;
  }
}
function tick(dt) {
  G.time.value += dt;
  GradeShader.uniforms.uTime.value = G.time.value;
  if (S.mode === 'play') S.time += dt;
  if (S.mode === 'dead') { S.deadT += dt; if (S.deadT > 2.6) respawn(); }

  applyAtmosphere(dt);
  updatePlayer(dt);
  if (S.mode === 'title' || S.mode === 'intro') {
    titleCamera(G.time.value, camera.position, titleLook);
    camera.lookAt(titleLook);
  } else if (S.mode === 'cine' || S.mode === 'ending') updateCine(dt);
  else updateCamera(dt);
  if (S.mode === 'dialog') updateDialog(dt);
  updateKeeper(dt);
  updateWisps(dt);
  updateSeeds(dt);
  updateShrines(dt);
  updateCampfire(dt);
  updateLighthouse(dt);
  updateRitual(dt);
  updateInteract();
  updateRings(dt);
  glow.update(dt); smoke.update(dt);

  // world-follow uniforms
  const focus = S.mode === 'title' || S.mode === 'intro' ? titleLook : player.pos;
  GRASS_U.uPlayer.value.copy(player.pos);
  OCCLUDE_U.uFocus.value.copy(player.pos).y += S.mode === 'play' || S.mode === 'dialog' || S.mode === 'dead' ? 1.1 : -999;
  FLY_U.uPlayer.value.copy(focus);
  FLY_U.uAmt.value = clamp(1 - atm.t / 5.5, 0.15, 1);
  PART_U.uFogD.value = scene.fog.near; PART_U.uFogC.value.copy(scene.fog.color);
  const ts = 84 / Q.shadowSize;
  sunLight.target.position.set(Math.round(focus.x / ts) * ts, Math.round(focus.y / ts) * ts, Math.round(focus.z / ts) * ts);
  sunLight.position.copy(sunLight.target.position).addScaledVector(lightDir, 160);

  // HUD
  if (S.mode === 'play' || S.mode === 'dialog') {
    $('energyFill').style.width = player.energy.toFixed(1) + '%';
    $('tBurst').querySelector('.cd').style.setProperty('--cd', (player.energy < 20 ? 100 : clamp(player.burstCd / 0.65, 0, 1) * 100) + '%');
    if (player.hp !== hudHp) renderFlames();
    const o = objectiveTarget();
    setObjective(o.text);
    $('objDist').textContent = o.p ? `${Math.round(Math.hypot(o.p.x - player.pos.x, o.p.z - player.pos.z))} m` : '';
    mapT -= dt;
    if (mapT <= 0) { drawMinimap(); mapT = 1 / 20; }
  }
  GradeShader.uniforms.uDamage.value = Math.max(0, GradeShader.uniforms.uDamage.value - dt * 1.6);
  GradeShader.uniforms.uFlash.value = Math.max(0, GradeShader.uniforms.uFlash.value - dt * 0.8);
  GradeShader.uniforms.uSat.value = GRADE.sat * (player.hp <= 1 && S.mode === 'play' ? 0.55 : 1);
  $('dmg').style.opacity = player.hp <= 1 && S.mode === 'play' ? 0.5 + Math.sin(S.time * 5) * 0.2 : 0;

  // audio
  const seaD = clamp(1 - (Math.max(terrainHeight(player.pos.x, player.pos.z), 0) / 8), 0, 1);
  AudioFX.update(dt, { speed: Math.hypot(player.vel.x, player.vel.z), height: Math.max(0, player.pos.y), sea: S.mode === 'title' ? 0.6 : seaD, fire: clamp(1 - player.pos.distanceTo(CAMPFIRE.pos) / 14, 0, 1) });
}

// =====================================================================
//  Boot
// =====================================================================
async function boot() {
  const steps = [
    ['Dokular dokunuyor…', buildTextures],
    ['Ada denizden yükseliyor…', genHeights],
    ['Çayırlar boyanıyor…', genColors],
    ['Kıyılar dalgalanıyor…', () => { buildTerrain(); buildWater(); SKY_U.uCloud.value = TEX.cloud; }],
    ['Sunaklar diziliyor…', () => { buildMaterials(); SHRINES.forEach(buildShrine); buildLighthouse(); buildCamp(); buildRuins(); }],
    ['Orman büyüyor…', buildVegetation],
    ['Rüzgâr esiyor…', () => { buildGrass(); buildFireflies(); buildRingPool(); glow = new Pool(IS_MOBILE ? 900 : 1800, true); smoke = new Pool(IS_MOBILE ? 450 : 900, false); }],
    ['Ela uyanıyor…', () => { buildPlayer(); buildKeeper(); buildSeeds(); buildMinimapBase(); buildPost(); }],
    ['Işık toplanıyor…', () => {
      sunLight.castShadow = Q.shadows; renderer.shadowMap.enabled = Q.shadows;
      sunLight.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
      applyAtmosphere(0); updateEnv(); resize();
      const ps = CAMPFIRE.pierStart;
      player.pos.set(ps.x, groundAt(ps.x, ps.z), ps.z);
      player.yaw = Math.PI;
      ela.root.position.copy(player.pos);
    }],
  ];
  for (let i = 0; i < steps.length; i++) {
    $('loadtxt').textContent = steps[i][0];
    await nextFrame();
    steps[i][1]();
    $('loadbar').style.width = ((i + 1) / (steps.length + 1)) * 100 + '%';
  }
  titleCamera(0, camera.position, titleLook); camera.lookAt(titleLook);
  $('loadtxt').textContent = 'Gölgeler derleniyor…';
  await nextFrame();
  // Pre-warm shaders for things that appear later (beams, spirits, rings) to avoid hitches
  const warm = [LH.beamGroup, ...shrineObjs.map((o) => o.beam), ...rings.map((r) => r.m)];
  warm.forEach((o) => { o.visible = true; });
  const ghost = spawnWisp(CAMP.x, CAMP.z);
  if (ghost) { ghost.g.visible = true; ghost.g.scale.setScalar(1); }
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  warm.forEach((o) => { o.visible = false; });
  if (ghost) { scene.remove(ghost.g); wisps.splice(wisps.indexOf(ghost), 1); }
  composer.render(0.016);
  $('loadbar').style.width = '100%';
  $('controlsHint').innerHTML = IS_TOUCH
    ? 'Sol taraf: hareket · Sağ taraf: kamera · Işık düğmesi: ruhları dağıt'
    : '<kbd>W A S D</kbd> hareket · <kbd>Shift</kbd> koş · <kbd>Boşluk</kbd> zıpla · <kbd>F</kbd> ışık patlaması · <kbd>E</kbd> etkileşim · fare ile sürükle: kamera';
  const sv = store.get(SAVE_KEY);
  if (sv && (sv.talked || sv.lit?.some(Boolean))) {
    $('btnContinue').hidden = false;
    $('btnContinue').onclick = () => continueGame(sv);
    $('btnNew').classList.replace('primary', 'ghost');
    $('btnNew').textContent = 'Yeni Oyun';
  }
  S.mode = 'title';
  show('title', true);
  $('loading').classList.add('out');
  setTimeout(() => show('loading', false), 900);
  last = performance.now();
  window.__lumora = { ela, sim: (sec) => { for (let t = 0; t < sec; t += 1 / 30) tick(1 / 30); }, cam, keeper, shrineObjs, applyQuality, S, player, scene, camera, renderer, SHRINES, CAMP, LIGHTHOUSE, wisps, seeds, startRitual, endRitual, atm, terrainHeight, newGame, beginPlay, talkKeeper, advanceDialog };
}
requestAnimationFrame(frame);
boot().catch((e) => {
  console.error(e);
  $('loadtxt').textContent = 'Bir hata oluştu: ' + e.message;
});

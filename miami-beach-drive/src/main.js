// Miami Beach Drive — WebGL open-world driving & on-foot game with GPU harness.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, smooth = THREE.MathUtils.smoothstep;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const lerpAngle = (a, b, k) => a + wrapAngle(b - a) * k;

// ======================= Save / progress =======================
const SAVE_KEY = 'mbd.save.v1';
const DEFAULT_SAVE = () => ({ v: 1, cash: 0, owned: { convertible: true }, colors: { '#ff4fa8': true, '#24e7ff': true }, color: '#ff4fa8',
  vehicle: 'convertible', underglow: false, glowOn: true, ach: {}, stats: { missions: 0, bestJump: 0, bestDrift: 0 }, vol: 0.6 });
function loadSave() {
  const d = DEFAULT_SAVE();
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && s.v === 1) return { ...d, ...s, owned: { ...d.owned, ...s.owned }, colors: { ...d.colors, ...s.colors }, stats: { ...d.stats, ...s.stats }, ach: { ...s.ach } };
  } catch (e) { /* storage unavailable */ }
  return d;
}
const SV = loadSave();
let saveDirty = false, saveT = 0;
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) { /* ignore */ } saveDirty = false; }
const markDirty = () => saveDirty = true;

// ======================= Quality presets =======================
const PRESETS = {
  low:    { pr: 0.6,  bloom: false, shadow: 0,    palms: 80,  traffic: 8,  peds: 12, water: 48,  fog: 0.0042 },
  medium: { pr: 0.85, bloom: true,  shadow: 1024, palms: 140, traffic: 12, peds: 20, water: 96,  fog: 0.0032 },
  high:   { pr: 1.0,  bloom: true,  shadow: 2048, palms: 220, traffic: 18, peds: 30, water: 160, fog: 0.0026 },
  ultra:  { pr: 1.5,  bloom: true,  shadow: 4096, palms: 360, traffic: 26, peds: 46, water: 256, fog: 0.0020 },
};
const params = new URLSearchParams(location.search);
let quality = PRESETS[params.get('q')] ? params.get('q') : 'high';
$('quality').value = quality;

// ======================= Renderer / scene =======================
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf3a37a, 0.0026);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.55, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const sky = new Sky(); sky.scale.setScalar(3000); scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 6; skyU.rayleigh.value = 2.2; skyU.mieCoefficient.value = 0.006; skyU.mieDirectionalG.value = 0.85;

const starGeo = new THREE.BufferGeometry(); { const p = []; for (let i = 0; i < 1500; i++) {
  const th = Math.random() * Math.PI * 2, ph = Math.random() * 0.45 * Math.PI; p.push(Math.cos(th) * Math.cos(ph) * 1400, Math.sin(ph) * 1400 + 40, Math.sin(th) * Math.cos(ph) * 1400); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false });
const nightStars = new THREE.Points(starGeo, starMat); scene.add(nightStars);
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6dd, fog: false, transparent: true }));
scene.add(moonMesh);

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0xe8c9a0, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 3); scene.add(sun, sun.target);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
const moonLight = new THREE.DirectionalLight(0x8fa8ff, 0); moonLight.position.set(300, 400, -600); scene.add(moonLight);
const headlight = new THREE.SpotLight(0xfff1d6, 0, 70, 0.5, 0.5, 1.3); scene.add(headlight, headlight.target);

// ======================= Procedural textures =======================
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const facadeTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = '#5f86a3'; g.fillRect(x * 64 + 12, y * 64 + 16, 40, 34);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x * 64 + 12, y * 64 + 16, 40, 4);
    g.fillStyle = '#e9e4dc'; g.fillRect(x * 64 + 8, y * 64 + 50, 48, 5);
  }
});
const litTex = canvasTex(256, 256, g => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (Math.random() < 0.55) {
    g.fillStyle = pick(['#ffd79a', '#fff0c8', '#ff9fd0', '#9fefff']); g.fillRect(x * 64 + 12, y * 64 + 16, 40, 34);
  }
});
const sandTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#e9d3a6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(160,120,70,.12)' : 'rgba(255,255,255,.18)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
}, [120, 30]);
const roadTex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#3a3a40'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = '#f2c230'; g.fillRect(0, 60, w, 3); g.fillRect(0, 66, w, 3);
  g.fillStyle = '#eeeeee'; g.fillRect(0, 6, w, 4); g.fillRect(0, 118, w, 4);
});
const crossTex = canvasTex(128, 512, (g, w, h) => {
  g.fillStyle = '#3a3a40'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = '#eee'; for (let y = 0; y < h; y += 64) g.fillRect(62, y, 4, 32);
});
const paverTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#e8ddd0'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,100,90,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
  g.fillStyle = 'rgba(255,120,170,.25)'; g.fillRect(32, 32, 64, 64);
});
function signTex(text, color, font = 70) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#120818'; g.fillRect(0, 0, w, h);
    g.font = `italic bold ${font}px "Trebuchet MS", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 22; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4); g.fillText(text, w / 2, h / 2 + 4);
    g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
  });
}
const stripeTex = canvasTex(256, 64, (g, w, h) => {
  const cols = ['#ff4fa8', '#ffffff', '#24e7ff', '#ffd166', '#ffffff', '#7cf5c8'];
  cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / cols.length, 0, w / cols.length + 1, h); });
});

// ======================= World layout =======================
// Ocean Drive runs along x at z=0 (beach and ocean toward -z), Collins Ave at z=80, cross streets every 80 m.
const XMIN = -415, XMAX = 415, OD_Z = 0, COL_Z = 80, ROAD_HW = 7, CROSS = [-320, -240, -160, -80, 0, 80, 160, 240, 320], CROSS_HW = 6;
const SHORE_Z = -70, WATER_Z = -61;
const GARAGE = { x: 40, z: 10.8, carX: 52, carZ: 10.8, jetX: 40, jetZ: -72 };
const colliders = [];
let circles = [];
const buckets = new Map();
function addGeo(key, geo) { if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(geo); }
function box(key, w, h, d, x, y, z, uv) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uv) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uv[0], a.getY(i) * uv[1]); }
  g.translate(x, y, z); addGeo(key, g);
}
const PASTELS = ['#f7a8c4', '#9fe3d0', '#c9b6f2', '#ffd1a1', '#9ad7f0', '#fff1a8', '#fdf7f2'];
const NEONS = ['#ff3fa4', '#00f0ff', '#b45cff', '#ff9a3c', '#7cff6b'];
const SIGN_NAMES = [['CORAL', '#ff3fa4'], ['SEA BREEZE', '#00f0ff'], ['LUNA', '#b45cff'], ['PALMERA', '#7cff6b'], ['STARLITE', '#ffd166'],
  ['FLAMINGO', '#ff3fa4'], ['AQUA', '#00f0ff'], ['SUNSET', '#ff9a3c'], ['CAFÉ CUBANO', '#ff9a3c'], ['MAMBO', '#b45cff'], ['TROPICANA', '#7cff6b'], ['BRISA', '#00f0ff']];
const materials = {};
PASTELS.forEach((c, i) => materials['body' + i] = new THREE.MeshStandardMaterial({ color: c, map: facadeTex, roughness: 0.75, emissive: 0xffffff, emissiveMap: litTex, emissiveIntensity: 0 }));
materials.white = new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.6 });
materials.glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ee, map: facadeTex, roughness: 0.15, metalness: 0.6, emissive: 0xffffff, emissiveMap: litTex, emissiveIntensity: 0 });
NEONS.forEach((c, i) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); m.userData.base = new THREE.Color(c); materials['neon' + i] = m; });
SIGN_NAMES.forEach(([t, c], i) => { const m = new THREE.MeshBasicMaterial({ map: signTex(t, c), toneMapped: false }); m.userData.base = new THREE.Color(1, 1, 1); materials['sign' + i] = m; });
materials.garageSign = new THREE.MeshBasicMaterial({ map: signTex('🔧 GARAJE', '#ffd166', 64), toneMapped: false }); materials.garageSign.userData.base = new THREE.Color(1, 1, 1);
const neonMats = Object.keys(materials).filter(k => /^(neon|sign|garageSign)/.test(k)).map(k => materials[k]);
const windowMats = Object.keys(materials).filter(k => k.startsWith('body') || k === 'glass').map(k => materials[k]);

function decoBuilding(cx, w, zFront, f, d, h, garage = false) {
  const cz = zFront - f * d / 2, body = 'body' + ((Math.random() * PASTELS.length) | 0), neon = 'neon' + ((Math.random() * NEONS.length) | 0);
  box(body, w, h, d, cx, h / 2, cz, [w / 24, h / 16]);
  colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: Math.min(zFront, zFront - f * d), z1: Math.max(zFront, zFront - f * d) });
  for (let y = 4; y < h - 1 && y < 26; y += 4) box('white', w * 0.92, 0.22, 1.1, cx, y - 0.4, zFront + f * 0.55);
  const fx = garage ? cx + w / 3 : cx + (Math.random() < 0.5 ? 0 : rand(-w / 4, w / 4)), fh = h + rand(3, 7);
  box(Math.random() < 0.5 ? 'white' : body, 2.2, fh, 1.3, fx, fh / 2, zFront + f * 0.65);
  box(neon, 0.3, fh - 2, 0.25, fx, fh / 2, zFront + f * 1.35);
  box(neon, w, 0.3, 0.3, cx, h - 0.4, zFront + f * 0.2);
  box(body, w * 0.6, 2.4, d * 0.55, cx, h + 1.2, cz);
  box('white', w * 0.3, 1.8, d * 0.3, cx, h + 3.3, cz);
  box('white', w * 0.55, 0.15, 2.4, cx - w * 0.15, 3.2, zFront + f * 1.2);
  if (garage) {
    const g = new THREE.PlaneGeometry(9, 2.25); if (f < 0) g.rotateY(Math.PI); g.translate(cx - 2, 5.5, zFront + f * 0.75); addGeo('garageSign', g);
    box('neon3', 8, 0.3, 0.3, cx - 2, 3.4, zFront + f * 1.3);
  } else if (Math.random() < 0.6) {
    const si = (Math.random() * SIGN_NAMES.length) | 0, sw = Math.min(w * 0.45, 9);
    const g = new THREE.PlaneGeometry(sw, sw / 4); if (f < 0) g.rotateY(Math.PI);
    g.translate(fx + (fx > cx ? -1 : 1) * (sw / 2 + 1.6), Math.min(h - 3, 6.5), zFront + f * 0.75); addGeo('sign' + si, g);
  }
}
function condo(cx, w, zFront, d, h) {
  const cz = zFront + d / 2;
  box('glass', w, h, d, cx, h / 2, cz, [w / 24, h / 16]);
  colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: zFront, z1: zFront + d });
  for (let y = 6; y < h; y += 6) box('white', w + 0.6, 0.35, d + 0.6, cx, y, cz);
  box('neon' + ((Math.random() * NEONS.length) | 0), w + 0.8, 0.5, d + 0.8, cx, h + 0.2, cz);
  box('white', w * 0.4, 4, d * 0.4, cx, h + 2, cz);
}
const edges = [XMIN, ...CROSS, XMAX];
for (let i = 0; i < edges.length - 1; i++) {
  const x0 = edges[i] + (i === 0 ? 0 : CROSS_HW + 1.5), x1 = edges[i + 1] - (i === edges.length - 2 ? 0 : CROSS_HW + 1.5);
  for (const row of ['A', 'B', 'C']) {
    let x = x0;
    while (x1 - x > 12) {
      const w = Math.min(rand(14, 26), x1 - x), cx = x + w / 2;
      const isGarage = row === 'A' && GARAGE.x > x && GARAGE.x < x + w;
      if (row === 'A') decoBuilding(cx, w - 1, 14.5, -1, rand(14, 20), isGarage ? 12 : rand(9, 19), isGarage);
      if (row === 'B') decoBuilding(cx, w - 1, 70, 1, rand(14, 18), rand(9, 16));
      if (row === 'C') condo(cx, w - 2, 91, rand(18, 32), rand(24, 70));
      x += w;
    }
  }
}
roadTex.repeat.set((XMAX - XMIN) / 24, 1);
for (const z of [OD_Z, COL_Z]) { const g = new THREE.PlaneGeometry(XMAX - XMIN + 40, ROAD_HW * 2); g.rotateX(-Math.PI / 2); g.translate(0, 0.02, z); addGeo('road', g); }
crossTex.repeat.set(1, 66 / 24);
for (const x of CROSS) { const g = new THREE.PlaneGeometry(CROSS_HW * 2, COL_Z - OD_Z - ROAD_HW * 2); g.rotateX(-Math.PI / 2); g.translate(x, 0.015, (OD_Z + COL_Z) / 2); addGeo('cross', g); }
for (const [z0, z1] of [[-12, -ROAD_HW], [ROAD_HW, 14.5], [70, COL_Z - ROAD_HW], [COL_Z + ROAD_HW, 91]])
  box('paver', XMAX - XMIN + 40, 0.2, z1 - z0, 0, 0.1, (z0 + z1) / 2, [(XMAX - XMIN + 40) / 4, (z1 - z0) / 4]);
materials.road = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 });
materials.cross = new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.85 });
materials.paver = new THREE.MeshStandardMaterial({ map: paverTex, roughness: 0.8 });
const sandY = z => z < -58 ? (z + 58) * 0.06 : 0;
const sandGeo = new THREE.PlaneGeometry(3000, 140, 1, 70); sandGeo.rotateX(-Math.PI / 2); sandGeo.translate(0, 0, -81);
{ const a = sandGeo.attributes.position; for (let i = 0; i < a.count; i++) a.setY(i, sandY(a.getZ(i))); sandGeo.computeVertexNormals(); }
const sand = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 })); sand.receiveShadow = true; scene.add(sand);
const lot = new THREE.Mesh(new THREE.PlaneGeometry(3000, 400), new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 1 }));
lot.rotation.x = -Math.PI / 2; lot.position.set(0, -0.01, 210); lot.receiveShadow = true; scene.add(lot);

const towers = [];
for (let i = 0; i < 8; i++) {
  const x = -350 + i * 100 + rand(-10, 10), z = -40, key = 'body' + (i % PASTELS.length);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box('white', 0.25, 2.6, 0.25, x + lx * 1.4, 1.3, z + lz * 1.4);
  box('white', 4, 0.25, 4, x, 2.7, z); box(key, 3.2, 2.2, 3, x, 3.9, z); box('neon' + (i % NEONS.length), 3.8, 0.3, 3.6, x, 5.15, z);
  box('white', 1.0, 0.15, 3.0, x, 1.2, z - 2.6);
  colliders.push({ x0: x - 2, x1: x + 2, z0: z - 2, z1: z + 2 }); towers.push({ x, z });
}
// Wooden pier at the garage so the jet ski has a dock
box('white', 3, 0.3, 50, GARAGE.jetX + 4, 0.6, -55, null); // top surface at y=0.75 (see PIER)
for (let z = -78; z <= -32; z += 6) for (const dx of [-1.3, 1.3]) box('white', 0.25, 3, 0.25, GARAGE.jetX + 4 + dx, -0.6, z);

for (const [key, geos] of buckets) {
  const m = new THREE.Mesh(mergeGeometries(geos), materials[key]);
  m.castShadow = !/^(sign|garageSign|road|cross|paver)/.test(key); m.receiveShadow = true; scene.add(m);
  geos.forEach(g => g.dispose());
}
const garageRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false }));
garageRing.position.set(GARAGE.x, 0.3, GARAGE.z); scene.add(garageRing);

// ======================= Ocean (GPU wave shader) =======================
let ocean;
const oceanU = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() },
  uNight: { value: 0 }, uFogCol: { value: new THREE.Color() }, uFogD: { value: 0.003 }, uMoonDir: { value: new THREE.Vector3(0.3, 0.4, -0.85).normalize() } };
const WAVE_GLSL = `float H(vec2 p, float amp){ return amp*( sin(p.x*0.05+uTime*0.9)*0.6 + sin(p.y*0.11-uTime*1.4+p.x*0.02)*0.9 + sin((p.x+p.y)*0.21+uTime*2.1)*0.25 ); }`;
function waterHeight(x, z, t) {
  const shore = clamp((SHORE_Z - z) / 60, 0, 1), amp = 0.12 + 0.5 * shore;
  return amp * (Math.sin(x * 0.05 + t * 0.9) * 0.6 + Math.sin(z * 0.11 - t * 1.4 + x * 0.02) * 0.9 + Math.sin((x + z) * 0.21 + t * 2.1) * 0.25) - 0.05;
}
function buildOcean(seg) {
  if (ocean) { scene.remove(ocean); ocean.geometry.dispose(); }
  const g = new THREE.PlaneGeometry(3000, 1400, seg * 2, seg); g.rotateX(-Math.PI / 2); g.translate(0, 0, SHORE_Z - 700 + 6);
  ocean = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: oceanU, transparent: true,
    vertexShader: `uniform float uTime; varying vec3 vW; varying float vShore; ${WAVE_GLSL}
      void main(){ vec4 w = modelMatrix*vec4(position,1.0);
        float shore = clamp((${SHORE_Z.toFixed(1)} - w.z)/60.0, 0.0, 1.0); float amp = 0.12 + 0.5*shore;
        w.y += H(w.xz, amp) - 0.05; vW = w.xyz; vShore = shore; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime, uNight, uFogD; uniform vec3 uSunDir, uSunCol, uSky, uFogCol, uMoonDir; varying vec3 vW; varying float vShore; ${WAVE_GLSL}
      float n(vec2 p){ return sin(p.x*1.7+uTime*1.3)*sin(p.y*2.3-uTime) + 0.5*sin(p.x*4.1-p.y*3.3+uTime*2.0); }
      void main(){
        float amp = 0.12 + 0.5*vShore, e = 0.6;
        vec3 N = normalize(vec3(H(vW.xz-vec2(e,0.),amp)-H(vW.xz+vec2(e,0.),amp), 2.0*e, H(vW.xz-vec2(0.,e),amp)-H(vW.xz+vec2(0.,e),amp)));
        N = normalize(N + 0.08*vec3(n(vW.xz*0.7), 0.0, n(vW.zx*0.9)));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 shallow = mix(vec3(0.15,0.75,0.72), vec3(0.02,0.08,0.12), uNight);
        vec3 deep = mix(vec3(0.0,0.22,0.38), vec3(0.0,0.02,0.06), uNight);
        vec3 col = mix(shallow, deep, smoothstep(0.0, 0.6, vShore));
        col = mix(col, uSky, clamp(fres*0.85, 0.0, 1.0));
        vec3 R = reflect(-V, N);
        col += uSunCol * pow(max(dot(R, uSunDir), 0.0), 180.0) * 6.0;
        col += vec3(0.8,0.85,1.0) * pow(max(dot(R, uMoonDir), 0.0), 90.0) * 2.5 * uNight;
        float foam = smoothstep(0.55, 1.0, n(vW.xz*0.35) * 0.5 + 0.5) * (1.0 - smoothstep(0.0, 0.12, vShore));
        foam += (1.0 - smoothstep(0.0, 0.03, vShore)) * (0.6 + 0.4*sin(uTime*1.5 + vW.x*0.08));
        col = mix(col, vec3(0.95) * (1.0 - 0.75*uNight), clamp(foam, 0.0, 1.0));
        float d = length(cameraPosition - vW); float fog = 1.0 - exp(-uFogD*uFogD*d*d);
        gl_FragColor = vec4(mix(col, uFogCol, fog), mix(0.82, 0.97, vShore));
      }` }));
  ocean.renderOrder = 1; scene.add(ocean);
}

// ======================= Ramps =======================
const ramps = [];
const rampMat = new THREE.MeshStandardMaterial({ color: 0xff4fa8, roughness: 0.5, emissive: 0xff2a8a, emissiveIntensity: 0.1 });
function addRamp(x0, z0, axis, dir, len = 9, w = 5, h = 2.2) {
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len, h)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2);
  const mesh = new THREE.Mesh(g, rampMat); mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(x0, 0, z0); mesh.rotation.y = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  scene.add(mesh);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, w), materials.neon1); stripe.position.set(len, h, 0); mesh.add(stripe);
  ramps.push({ x0, z0, axis, dir, len, w, h, cx: axis === 'x' ? x0 + dir * len / 2 : x0, cz: axis === 'z' ? z0 + dir * len / 2 : z0 });
}
[[-300, -30, 1], [-150, -50, -1], [-20, -28, 1], [110, -48, -1], [250, -32, 1], [370, -52, -1]].forEach(([x, z, d]) => addRamp(x, z, 'x', d));
addRamp(-160, 22, 'z', 1, 8, 6, 1.8); addRamp(160, 58, 'z', -1, 8, 6, 1.8); addRamp(0, 25, 'z', 1, 8, 6, 1.8);
function rampHeight(x, z) {
  for (const r of ramps) {
    const u = r.axis === 'x' ? (x - r.x0) * r.dir : (z - r.z0) * r.dir, v = r.axis === 'x' ? z - r.z0 : x - r.x0;
    if (u >= 0 && u <= r.len && Math.abs(v) <= r.w / 2) return r.h * u / r.len;
  }
  return null;
}
const PIER = { x: GARAGE.jetX + 4, hw: 1.5, z0: -80, z1: -30, y: 0.75 };
const onPier = (x, z) => Math.abs(x - PIER.x) < PIER.hw && z > PIER.z0 && z < PIER.z1;
const onSidewalk = z => (z > -12 && z < -ROAD_HW) || (z > ROAD_HW && z < 14.5) || (z > 70 && z < COL_Z - ROAD_HW) || (z > COL_Z + ROAD_HW && z < 91);
const groundHeight = (x, z) => rampHeight(x, z) ?? (onPier(x, z) ? PIER.y : onSidewalk(z) ? 0.2 : sandY(z));

// ======================= Palms, lamps, umbrellas =======================
function palmGeos() {
  const trunk = new THREE.CylinderGeometry(0.18, 0.32, 9, 7, 8); trunk.translate(0, 4.5, 0);
  const p = trunk.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.025 * y * y); }
  trunk.computeVertexNormals();
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const l = new THREE.PlaneGeometry(0.9, 4.2, 1, 6); l.translate(0, 2.1, 0);
    const a = l.attributes.position; for (let j = 0; j < a.count; j++) { const y = a.getY(j); a.setZ(j, -0.09 * y * y); a.setX(j, a.getX(j) * (1 - y / 5)); }
    l.rotateX(-Math.PI / 2 + 0.55); l.rotateY(i / 9 * Math.PI * 2 + Math.random() * 0.3); l.translate(2.025, 9, 0); leaves.push(l);
  }
  const crown = mergeGeometries(leaves); crown.computeVertexNormals(); return [trunk, crown];
}
const [trunkGeo, crownGeo] = palmGeos();
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.95 });
const crownMat = new THREE.MeshStandardMaterial({ color: 0x3f9d4a, roughness: 0.7, side: THREE.DoubleSide });
let palmsT, palmsC, palmCircles = [];
function buildPalms(n) {
  if (palmsT) { scene.remove(palmsT, palmsC); palmsT.dispose(); palmsC.dispose(); }
  palmsT = new THREE.InstancedMesh(trunkGeo, trunkMat, n); palmsC = new THREE.InstancedMesh(crownGeo, crownMat, n);
  palmsT.castShadow = palmsC.castShadow = true; palmsT.receiveShadow = true;
  palmCircles = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    let x, z;
    if (i < n * 0.35) { x = XMIN + 10 + (i / (n * 0.35)) * (XMAX - XMIN - 20); z = -10; if (Math.abs(x - GARAGE.jetX - 4) < 4) x += 8; }
    else if (i < n * 0.55) { x = XMIN + 10 + ((i - n * 0.35) / (n * 0.2)) * (XMAX - XMIN - 20); z = i % 2 ? 71.6 : 88.6; if (CROSS.some(c => Math.abs(c - x) < 8)) x += 9; }
    else { x = rand(XMIN, XMAX); z = rand(-58, -16); if (towers.some(t => Math.hypot(t.x - x, t.z - z) < 5) || ramps.some(r => Math.hypot(r.cx - x, r.cz - z) < 12) || Math.abs(x - GARAGE.jetX - 4) < 5) z = -16; }
    e.set(rand(-0.05, 0.05), rand(0, Math.PI * 2), rand(-0.05, 0.05)); q.setFromEuler(e); const sc = rand(0.8, 1.25); s.set(sc, sc, sc);
    m.compose(new THREE.Vector3(x, 0, z), q, s); palmsT.setMatrixAt(i, m); palmsC.setMatrixAt(i, m);
    palmCircles.push({ x, z, r: 0.45 * sc });
  }
  scene.add(palmsT, palmsC);
  circles = [...palmCircles, ...lampCircles];
}
const lampPos = [];
for (let x = XMIN + 8; x < XMAX; x += 24) for (const z of [-8.2, 8.2, 71.8, 88.2]) if (!CROSS.some(c => Math.abs(c - x) < 7)) lampPos.push(new THREE.Vector3(x, 0, z));
const lampPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 6, 6).translate(0, 3, 0), new THREE.MeshStandardMaterial({ color: 0x2c2c34, metalness: 0.6, roughness: 0.4 }), lampPos.length);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false });
const lampBulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8).translate(0, 6.1, 0), bulbMat, lampPos.length);
const lampCircles = lampPos.map((p, i) => { const m = new THREE.Matrix4().makeTranslation(p.x, 0, p.z); lampPole.setMatrixAt(i, m); lampBulb.setMatrixAt(i, m); return { x: p.x, z: p.z, r: 0.25 }; });
scene.add(lampPole, lampBulb);
const lampLights = [0, 1, 2, 3, 4, 5].map(() => { const l = new THREE.PointLight(0xffb066, 0, 26, 1.5); scene.add(l); return l; });
const UMB = 46;
const umbTop = new THREE.InstancedMesh(new THREE.ConeGeometry(1.8, 0.8, 12, 1, true).translate(0, 2.5, 0), new THREE.MeshStandardMaterial({ map: stripeTex, side: THREE.DoubleSide, roughness: 0.8 }), UMB);
const umbPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5).translate(0, 1.3, 0), materials.white, UMB);
for (let i = 0; i < UMB; i++) { const m = new THREE.Matrix4().compose(new THREE.Vector3(rand(XMIN, XMAX), 0, rand(-56, -18)),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-.12, .12), rand(0, 6), rand(-.12, .12))), new THREE.Vector3(1, 1, 1)); umbTop.setMatrixAt(i, m); umbPole.setMatrixAt(i, m); }
umbTop.castShadow = true; scene.add(umbTop, umbPole);

// ======================= Collectibles & beach balls =======================
const STAR_N = 30;
const starShape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 0.45 : 1; i ? starShape.lineTo(Math.sin(a) * r, Math.cos(a) * r) : starShape.moveTo(0, r); }
const collect = new THREE.InstancedMesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.25, bevelEnabled: false }).translate(0, 0, -0.125),
  new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false }), STAR_N);
const starPts = []; scene.add(collect);
function placeStars() {
  starPts.length = 0;
  ramps.forEach(r => starPts.push({ x: r.axis === 'x' ? r.x0 + r.dir * (r.len + 9) : r.x0, z: r.axis === 'z' ? r.z0 + r.dir * (r.len + 9) : r.z0, y: 4.5, got: false }));
  for (let i = 0; i < 3; i++) starPts.push({ x: rand(-300, 300), z: rand(-140, -90), y: 0.8, got: false }); // out at sea: jet ski or swim
  while (starPts.length < STAR_N) {
    const t = Math.random(); let x = rand(XMIN + 10, XMAX - 10), z;
    if (t < 0.35) z = rand(-56, -16); else if (t < 0.6) z = pick([-3.5, 3.5]); else if (t < 0.8) z = COL_Z + pick([-3.5, 3.5]); else { x = pick(CROSS); z = rand(12, 68); }
    starPts.push({ x, z, y: 1.6, got: false });
  }
}
const ballTex = canvasTex(256, 128, (g, w, h) => { ['#ff4fa8', '#fff', '#24e7ff', '#fff', '#ffd166', '#fff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 6, 0, w / 6 + 1, h); }); });
const ballGeo = new THREE.SphereGeometry(0.6, 20, 14), ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.4 });
const balls = [];
for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(ballGeo, ballMat); b.castShadow = true; b.position.set(rand(-380, 380), 0.6, rand(-56, -18)); b.userData.v = new THREE.Vector3(); scene.add(b); balls.push(b); }

// ======================= People (player on foot, pedestrians, passengers) =======================
const PG = {
  torso: new THREE.BoxGeometry(0.5, 0.62, 0.28), hips: new THREE.BoxGeometry(0.46, 0.22, 0.27), head: new THREE.SphereGeometry(0.17, 12, 10),
  hair: new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), leg: new THREE.BoxGeometry(0.17, 0.8, 0.19).translate(0, -0.4, 0),
  shoe: new THREE.BoxGeometry(0.18, 0.1, 0.3).translate(0, -0.82, -0.05), arm: new THREE.BoxGeometry(0.13, 0.6, 0.14).translate(0, -0.3, 0),
  glasses: new THREE.BoxGeometry(0.3, 0.06, 0.04),
};
const SKINS = ['#f1c7a5', '#d9a06f', '#b97a4f', '#8d5634', '#5e3a22'], HAIRS = ['#1b1410', '#4a2e1a', '#c89b50', '#9a9a9a', '#e0b77a', '#7a2a1a'];
const SHIRTS = ['#ff4fa8', '#24e7ff', '#ffd166', '#7cf5c8', '#ffffff', '#ff6b3d', '#b45cff', '#2f6fdf', '#f7a8c4'], PANTS = ['#1f2a44', '#e8dcc2', '#ffffff', '#3d5a80', '#2b2b2b', '#c9b6f2'];
const matCache = new Map();
const pMat = c => { if (!matCache.has(c)) matCache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })); return matCache.get(c); };
function makePerson(o = {}) {
  const shirt = o.shirt || pick(SHIRTS), pants = o.pants || pick(PANTS), skin = o.skin || pick(SKINS), hair = o.hair || pick(HAIRS);
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const add = (geo, c, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, pMat(c)); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(PG.torso, shirt, 0, 1.2, 0); add(PG.hips, pants, 0, 0.88, 0); add(PG.head, skin, 0, 1.7, 0); add(PG.hair, hair, 0, 1.73, 0.02);
  if (o.glasses || Math.random() < 0.3) add(PG.glasses, '#111111', 0, 1.72, -0.16);
  const limb = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); body.add(p); return p; };
  const legL = limb(-0.12, 0.86), legR = limb(0.12, 0.86), armL = limb(-0.32, 1.47), armR = limb(0.32, 1.47);
  for (const l of [legL, legR]) { add(PG.leg, pants, 0, 0, 0, l); add(PG.shoe, '#222222', 0, 0, 0, l); }
  for (const a of [armL, armR]) add(PG.arm, skin, 0, 0, 0, a);
  return { group: g, body, legL, legR, armL, armR };
}
function animatePerson(p, phase, amt, mode = 'walk') {
  p.body.rotation.set(0, 0, 0); p.body.position.y = 0;
  p.armL.rotation.set(0, 0, 0); p.armR.rotation.set(0, 0, 0); p.legL.rotation.set(0, 0, 0); p.legR.rotation.set(0, 0, 0);
  if (mode === 'swim') {
    p.body.rotation.x = -0.9; p.body.position.y = 0.6;
    p.armL.rotation.x = phase; p.armR.rotation.x = phase + Math.PI; p.legL.rotation.x = Math.sin(phase * 2) * 0.4; p.legR.rotation.x = -Math.sin(phase * 2) * 0.4; return;
  }
  if (mode === 'down') { p.body.rotation.x = Math.PI / 2; p.body.position.y = 0.2; p.armL.rotation.z = -1.2; p.armR.rotation.z = 1.2; return; }
  if (mode === 'air') { p.legL.rotation.x = 0.6; p.legR.rotation.x = -0.3; p.armL.rotation.z = -0.9; p.armR.rotation.z = 0.9; return; }
  const s = Math.sin(phase) * amt;
  p.legL.rotation.x = s * 0.8; p.legR.rotation.x = -s * 0.8; p.armL.rotation.x = -s * 0.7; p.armR.rotation.x = s * 0.7;
  p.body.position.y = Math.abs(Math.cos(phase)) * 0.05 * amt;
  if (mode === 'wave') { p.armR.rotation.x = 0; p.armR.rotation.z = 2.6 + Math.sin(phase * 3) * 0.35; }
  if (mode === 'angry') { p.armL.rotation.z = -2.4 + Math.sin(phase * 4) * 0.3; p.armR.rotation.z = 2.4 - Math.sin(phase * 4) * 0.3; }
}

// ======================= Vehicles =======================
const VEHICLES = {
  convertible: { name: 'Convertible', icon: '🚗', desc: 'Rápido y con estilo', max: 42, accel: 19, grip: 7.5, turn: 2.1, sand: 0.45, r: 1.3, price: 0 },
  moped:       { name: 'Scooter', icon: '🛵', desc: 'Ágil, gira en un peso', max: 27, accel: 17, grip: 10, turn: 3.0, sand: 0.35, r: 0.7, price: 150 },
  jeep:        { name: 'Jeep', icon: '🚙', desc: 'Rey de la arena', max: 35, accel: 15, grip: 6.5, turn: 1.9, sand: 0.92, r: 1.3, price: 300 },
  jetski:      { name: 'Moto acuática', icon: '🚤', desc: 'Explora el mar (sale del muelle)', max: 30, accel: 16, grip: 3.2, turn: 2.4, sand: 0.1, r: 1.0, price: 500, water: true },
  sedan:       { name: 'Sedán', icon: '🚘', desc: 'Del tráfico', max: 33, accel: 15, grip: 7, turn: 2.0, sand: 0.5, r: 1.3, price: null },
};
const SHOP_TYPES = ['convertible', 'moped', 'jeep', 'jetski'];
const CAR_COLORS = ['#ff4fa8', '#24e7ff', '#ffd166', '#7cf5c8', '#b45cff', '#ffffff', '#ff6b3d', '#222233'];
const COLOR_PRICE = 40, GLOW_PRICE = 120;
const glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function makeVehicle(type, color) {
  const g = new THREE.Group(), wheels = [], front = [], drivers = [];
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15 });
  const head = new THREE.MeshBasicMaterial({ color: 0xfff7e0, toneMapped: false }), tail = new THREE.MeshBasicMaterial({ color: 0xff1a3a, toneMapped: false });
  const skin = pMat('#c68e62'), shirt = pMat('#ff4fa8');
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const driver = (x, y, z) => drivers.push(add(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), shirt, x, y, z), add(new THREE.SphereGeometry(0.18, 12, 8), skin, x, y + 0.5, z - 0.03), add(PG.glasses, dark, x, y + 0.52, z - 0.2));
  function wheel(x, y, z, r, wdt, isFront, torus) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); g.add(pivot);
    const geo = torus ? new THREE.TorusGeometry(r * 0.75, r * 0.3, 8, 18).rotateY(Math.PI / 2) : new THREE.CylinderGeometry(r, r, wdt, 16).rotateZ(Math.PI / 2);
    add(geo, dark, 0, 0, 0, pivot);
    if (!torus) add(new THREE.CylinderGeometry(r * 0.55, r * 0.55, wdt + 0.02, 10).rotateZ(Math.PI / 2), chrome, 0, 0, 0, pivot);
    wheels.push(pivot); if (isFront) front.push(pivot); pivot.userData.r = r;
  }
  let headZ = -2.3, glowW = 2.4, glowL = 4.6;
  if (type === 'convertible') {
    add(new THREE.BoxGeometry(2.0, 0.55, 4.5), paint, 0, 0.62, 0);
    add(new THREE.BoxGeometry(1.9, 0.28, 1.5), paint, 0, 0.98, -1.4);
    add(new THREE.BoxGeometry(1.9, 0.3, 1.1), paint, 0, 0.98, 1.6);
    const ws = add(new THREE.BoxGeometry(1.8, 0.55, 0.06), new THREE.MeshStandardMaterial({ color: 0xaee8ff, transparent: true, opacity: 0.35, metalness: 0.9, roughness: 0 }), 0, 1.3, -0.55); ws.rotation.x = -0.45;
    const seat = new THREE.MeshStandardMaterial({ color: 0xf4efe6 });
    for (const x of [-0.45, 0.45]) { add(new THREE.BoxGeometry(0.6, 0.5, 0.6), seat, x, 1.05, 0.45); add(new THREE.BoxGeometry(0.6, 0.6, 0.15), seat, x, 1.35, 0.75); }
    driver(-0.45, 1.45, 0.35);
    add(new THREE.BoxGeometry(2.05, 0.15, 0.15), chrome, 0, 0.45, -2.27); add(new THREE.BoxGeometry(2.05, 0.15, 0.15), chrome, 0, 0.45, 2.27);
    for (const x of [-0.7, 0.7]) { add(new THREE.BoxGeometry(0.42, 0.16, 0.05), head, x, 0.75, -2.26); add(new THREE.BoxGeometry(0.42, 0.14, 0.05), tail, x, 0.78, 2.26); }
    for (const [x, z] of [[-1, -1.45], [1, -1.45], [-1, 1.45], [1, 1.45]]) wheel(x, 0.38, z, 0.38, 0.3, z < 0);
  } else if (type === 'jeep') {
    add(new THREE.BoxGeometry(2.1, 0.9, 3.9), paint, 0, 1.1, 0);
    add(new THREE.BoxGeometry(2.0, 0.08, 0.06), dark, 0, 1.6, -0.6);
    for (const x of [-0.98, 0.98]) for (const z of [-0.55, 1.6]) add(new THREE.BoxGeometry(0.1, 0.9, 0.1), dark, x, 2.0, z);
    add(new THREE.BoxGeometry(2.0, 0.1, 2.25), dark, 0, 2.45, 0.52);
    add(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 14).rotateX(Math.PI / 2), dark, 0, 1.25, 2.08);
    driver(-0.45, 1.85, 0.3);
    for (const x of [-0.7, 0.7]) { add(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12).rotateX(Math.PI / 2), head, x, 1.25, -1.97); add(new THREE.BoxGeometry(0.25, 0.25, 0.05), tail, x, 1.2, 1.97); }
    for (const [x, z] of [[-1.05, -1.3], [1.05, -1.3], [-1.05, 1.3], [1.05, 1.3]]) wheel(x, 0.5, z, 0.5, 0.42, z < 0);
    headZ = -2.0; glowW = 2.5; glowL = 4.2;
  } else if (type === 'moped') {
    add(new THREE.BoxGeometry(0.5, 0.35, 1.5), paint, 0, 0.65, 0);
    add(new THREE.BoxGeometry(0.55, 0.9, 0.35), paint, 0, 0.95, -0.6);
    add(new THREE.BoxGeometry(0.5, 0.18, 0.8), dark, 0, 0.95, 0.35);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6).rotateZ(Math.PI / 2), chrome, 0, 1.45, -0.7);
    driver(0, 1.45, 0.2); drivers.push(add(new THREE.SphereGeometry(0.21, 12, 8), paint, 0, 1.98, 0.15));
    add(new THREE.BoxGeometry(0.6, 0.5, 0.5), materials.white, 0, 1.1, 0.85);
    add(new THREE.CircleGeometry(0.12, 12).rotateY(Math.PI), head, 0, 1.2, -0.79); add(new THREE.BoxGeometry(0.25, 0.08, 0.05), tail, 0, 0.9, 0.76);
    wheel(0, 0.32, -0.7, 0.32, 0.12, true, true); wheel(0, 0.32, 0.65, 0.32, 0.12, false, true);
    headZ = -0.8; glowW = 1.2; glowL = 2.2;
  } else if (type === 'jetski') {
    add(new THREE.BoxGeometry(1.1, 0.5, 2.6), paint, 0, 0.25, 0.2);
    const nose = add(new THREE.ConeGeometry(0.62, 1.2, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4), paint, 0, 0.25, -1.6); nose.scale.set(1, 0.55, 1);
    add(new THREE.BoxGeometry(0.5, 0.3, 1.1), dark, 0, 0.62, 0.45);
    add(new THREE.BoxGeometry(0.7, 0.35, 0.5), materials.white, 0, 0.6, -0.55);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6).rotateZ(Math.PI / 2), chrome, 0, 0.95, -0.45);
    add(new THREE.BoxGeometry(0.3, 0.08, 0.05), tail, 0, 0.45, 1.52);
    driver(0, 1.15, 0.35);
    headZ = -2.0; glowW = 1.6; glowL = 3.4;
  } else { // sedan (borrowed from traffic)
    add(new THREE.BoxGeometry(2.0, 0.8, 4.4), paint, 0, 0.75, 0);
    add(new THREE.BoxGeometry(1.8, 0.6, 2.0), new THREE.MeshStandardMaterial({ color: 0x18202c, metalness: 0.9, roughness: 0.1 }), 0, 1.45, 0.2);
    for (const x of [-0.65, 0.65]) { add(new THREE.BoxGeometry(0.4, 0.18, 0.05), head, x, 0.8, -2.22); add(new THREE.BoxGeometry(0.4, 0.18, 0.05), tail, x, 0.85, 2.22); }
    for (const [x, z] of [[-1, -1.4], [1, -1.4], [-1, 1.4], [1, 1.4]]) wheel(x, 0.36, z, 0.36, 0.28, z < 0);
    driver(-0.45, 1.25, 0.3);
  }
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xff4fa8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(glowW, 1, glowL); glow.position.y = 0.06; glow.visible = false; g.add(glow);
  return { group: g, wheels, front, paint, drivers, glow, headZ };
}
const vehicles = [];
function createVehicle(type, color, x, z, h, kind) {
  const model = makeVehicle(type, color); scene.add(model.group);
  const v = { type, color, kind, model, s: { x, z, y: type === 'jetski' ? 0 : groundHeight(x, z), vy: 0, air: false, airT: 0, lastSlope: 0, h, vx: 0, vz: 0, steer: 0, wheelSpin: 0 } };
  vehicles.push(v); return v;
}
function removeVehicle(v) { scene.remove(v.model.group); vehicles.splice(vehicles.indexOf(v), 1); }
function applyCosmetics(v) {
  if (v.kind !== 'owned') return;
  v.color = SV.color; v.model.paint.color.set(SV.color);
  v.model.glow.visible = SV.underglow && SV.glowOn; v.model.glow.material.color.set(SV.color === '#222233' || SV.color === '#ffffff' ? '#24e7ff' : SV.color);
}

// ======================= Traffic =======================
const TRAFFIC_COLORS = ['#ffffff', '#1d1d1d', '#bfbfbf', '#ff4fa8', '#24a0e0', '#ffd166', '#7cf5c8', '#d23b3b'];
const trafficCars = [];
const TB = new THREE.BoxGeometry(2.0, 0.8, 4.4), TC = new THREE.BoxGeometry(1.8, 0.6, 2.0);
const tHead = new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }), tTail = new THREE.MeshBasicMaterial({ color: 0xff1030, toneMapped: false });
const lightsGeo = mergeGeometries([new THREE.BoxGeometry(0.4, 0.18, 0.05).translate(-0.65, 0.8, -2.22), new THREE.BoxGeometry(0.4, 0.18, 0.05).translate(0.65, 0.8, -2.22)]);
const tailsGeo = mergeGeometries([new THREE.BoxGeometry(0.4, 0.18, 0.05).translate(-0.65, 0.85, 2.22), new THREE.BoxGeometry(0.4, 0.18, 0.05).translate(0.65, 0.85, 2.22)]);
const glassMat = new THREE.MeshStandardMaterial({ color: 0x18202c, metalness: 0.9, roughness: 0.1 });
const LANES = [{ z: OD_Z - 3.5, dir: 1 }, { z: OD_Z + 3.5, dir: -1 }, { z: COL_Z - 3.5, dir: 1 }, { z: COL_Z + 3.5, dir: -1 }];
function spawnTraffic(lane, x) {
  const g = new THREE.Group(), color = pick(TRAFFIC_COLORS);
  const body = new THREE.Mesh(TB, new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 })); body.position.y = 0.75;
  const cab = new THREE.Mesh(TC, glassMat); cab.position.set(0, 1.45, 0.2); body.castShadow = cab.castShadow = true;
  g.add(body, cab, new THREE.Mesh(lightsGeo, tHead), new THREE.Mesh(tailsGeo, tTail));
  g.userData = { lane, speed: rand(10, 15), base: rand(10, 15), color };
  g.position.set(x, 0, lane.z); g.rotation.y = lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  scene.add(g); trafficCars.push(g); return g;
}
function buildTraffic(n) {
  trafficCars.forEach(c => scene.remove(c)); trafficCars.length = 0;
  for (let i = 0; i < n; i++) spawnTraffic(LANES[i % 4], rand(XMIN, XMAX));
}

// ======================= Pedestrians =======================
const ZONES = [
  { x0: XMIN + 5, x1: XMAX - 5, z0: -11.5, z1: -7.8, w: 3 }, { x0: XMIN + 5, x1: XMAX - 5, z0: 7.8, z1: 13.6, w: 3 },
  { x0: XMIN + 5, x1: XMAX - 5, z0: 70.4, z1: 72.6, w: 1 }, { x0: XMIN + 5, x1: XMAX - 5, z0: 87.4, z1: 90.4, w: 1 },
  { x0: XMIN + 5, x1: XMAX - 5, z0: -54, z1: -16, w: 3 },
];
const ZONE_BAG = ZONES.flatMap(z => Array(z.w).fill(z));
const SHOUTS = ['¡Oye!', '¡Cuidado!', '¡Mira por dónde vas!', '¡Ay, mi madre!', '¡Despacio!', '¡Wepa!'];
const peds = [];
function newPedTarget(p) { const z = p.zone; p.tx = clamp(p.x + rand(-30, 30), z.x0, z.x1); p.tz = rand(z.z0, z.z1); }
function spawnPed(zone, x, z, opts = {}) {
  const m = makePerson(opts); scene.add(m.group);
  const p = { m, zone, x, z, h: rand(-3, 3), state: 'walk', t: 0, speed: rand(1.1, 1.7), phase: Math.random() * 6, vx: 0, vz: 0, temp: !!opts.temp };
  newPedTarget(p); peds.push(p); return p;
}
function buildPeds(n) {
  for (const p of peds.filter(p => !p.temp)) { scene.remove(p.m.group); }
  for (let i = peds.length - 1; i >= 0; i--) if (!peds[i].temp) peds.splice(i, 1);
  for (let i = 0; i < n; i++) { const zone = pick(ZONE_BAG); spawnPed(zone, rand(zone.x0, zone.x1), rand(zone.z0, zone.z1)); }
}

// ======================= Missions =======================
const PLACES = ['Hotel Coral', 'Café Luna', 'Muelle Sur', 'Torre Salvavidas 3', 'Club Mambo', 'Hotel Palmera', 'Galería Aqua', 'Heladería Sol',
  'Bar Flamingo', 'Mercado de Flores', 'Estudio de Tatuajes Brisa', 'Restaurante Tropicana', 'Puesto de Jugos', 'Hostal Starlite', 'Tienda de Surf'];
const NAMES = ['Valentina', 'Mateo', 'Camila', 'Diego', 'Isabella', 'Santiago', 'Lucía', 'Andrés', 'Mía', 'Javier', 'Sofía', 'Carlos', 'Abuela Rosa', 'DJ Tito', 'un turista con mapa'];
function randomSpot() {
  const t = Math.random(); let x = rand(XMIN + 20, XMAX - 20), z;
  if (t < 0.35) z = pick([-4, 4]); else if (t < 0.6) z = COL_Z + pick([-4, 4]); else if (t < 0.8) { x = pick(CROSS); z = rand(14, 66); } else z = rand(-54, -18);
  return new THREE.Vector3(x, 0, z);
}
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 60, 32, 1, true).translate(0, 30, 0), beaconMat); scene.add(beacon);
const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.15, 8, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false })); scene.add(ring);
const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false })); scene.add(arrow);
const passenger = makePerson({ shirt: '#ffffff', glasses: true }); scene.add(passenger.group);
const M = { stage: 'pickup', target: new THREE.Vector3(), timer: 0, name: '', place: '', airBonus: 0, dropT: 0, dropFrom: null };
function setMissionColor(c) { beaconMat.color.set(c); ring.material.color.set(c); arrow.material.color.set(c); }
function newMission() {
  const b = body();
  let s; do s = randomSpot(); while (Math.hypot(s.x - b.x, s.z - b.z) < 60);
  Object.assign(M, { stage: 'pickup', target: s, name: pick(NAMES), place: pick(PLACES), timer: 0, airBonus: 0 });
  passenger.group.visible = true; passenger.group.position.set(s.x, groundHeight(s.x, s.z), s.z);
  setMissionColor(0xffd166);
}

// ======================= Achievements =======================
const ACH = [
  ['primer', '🚕', 'Primer viaje', 'Completa tu primer viaje'], ['taxista', '🏆', 'Taxista estrella', 'Completa 10 viajes'],
  ['volador', '🪽', 'Volador', 'Salto de más de 2 s'], ['derrape', '🌀', 'Rey del derrape', 'Derrape de 300 puntos'],
  ['estrellas', '⭐', 'Coleccionista', 'Junta las 30 estrellas'], ['nadador', '🏊', 'Al agua', 'Nada en el océano'],
  ['prestado', '🔑', 'Prestadito', 'Pide prestado un auto del tráfico'], ['flota', '🚗', 'Flota completa', 'Ten los 4 vehículos'],
  ['futbol', '⚽', 'Golazo', 'Patea una pelota a pie'], ['nocturno', '🌙', 'Turno de noche', 'Completa un viaje de noche'],
  ['marinero', '🚤', 'Marinero', 'Maneja la moto acuática'], ['estilo', '💜', 'Con estilo', 'Compra luces de neón'],
];
const achQueue = []; let achBusy = false;
function unlock(id) {
  if (SV.ach[id] || S.mode === 'attract' || S.mode === 'bench') return;
  SV.ach[id] = Date.now(); markDirty(); achQueue.push(ACH.find(a => a[0] === id)); showAch();
}
function showAch() {
  if (achBusy || !achQueue.length) return; achBusy = true;
  const a = achQueue.shift(); $('achIco').textContent = a[1]; $('achName').textContent = `${a[2]} — ${a[3]}`; $('achToast').classList.add('show');
  blip(784, 0.15, 'triangle', 0.12, 1.5); setTimeout(() => blip(1046, 0.25, 'triangle', 0.12, 1.5), 140);
  setTimeout(() => { $('achToast').classList.remove('show'); setTimeout(() => { achBusy = false; showAch(); }, 400); }, 3000);
}
function renderAch() {
  const got = ACH.filter(a => SV.ach[a[0]]).length; $('achCount').textContent = `${got}/${ACH.length}`;
  $('achList').innerHTML = ACH.map(a => `<div class="${SV.ach[a[0]] ? 'got' : ''}"><b>${a[1]} ${a[2]}</b>${a[3]}</div>`).join('');
}

// ======================= Ads (portal SDK adapter with simulated fallback) =======================
const Ads = {
  provider: 'sim', lastShopAd: -1e9,
  async init() {
    try {
      if (window.CrazyGames?.SDK) { this.provider = 'crazygames'; await window.CrazyGames.SDK.init?.(); }
      else if (window.PokiSDK) { this.provider = 'poki'; await window.PokiSDK.init(); }
    } catch (e) { console.warn('Ad SDK init failed, using simulated ads', e); this.provider = 'sim'; }
  },
  gameplayStart() { try { if (this.provider === 'crazygames') window.CrazyGames.SDK.game.gameplayStart(); else if (this.provider === 'poki') window.PokiSDK.gameplayStart(); } catch (e) { } },
  gameplayStop() { try { if (this.provider === 'crazygames') window.CrazyGames.SDK.game.gameplayStop(); else if (this.provider === 'poki') window.PokiSDK.gameplayStop(); } catch (e) { } },
  rewarded() {
    return new Promise(resolve => {
      const prev = S.mode; S.mode = 'ad'; this.gameplayStop(); muteAll(true);
      const done = ok => { muteAll(false); S.mode = prev; if (prev === 'play') this.gameplayStart(); resolve(!!ok); };
      try {
        if (this.provider === 'crazygames') { window.CrazyGames.SDK.ad.requestAd('rewarded', { adFinished: () => done(true), adError: () => done(false) }); return; }
        if (this.provider === 'poki') { window.PokiSDK.rewardedBreak().then(done, () => done(false)); return; }
      } catch (e) { return done(false); }
      $('adOverlay').classList.remove('hidden'); let n = 3; $('adCount').textContent = n;
      const iv = setInterval(() => { n--; $('adCount').textContent = n; if (n <= 0) { clearInterval(iv); $('adOverlay').classList.add('hidden'); done(true); } }, 1000);
    });
  },
};
let offer = null;
function showOffer(text, action, sec = 8, onExpire = null) { offer = { text, action, until: clockT + sec, dur: sec, onExpire }; $('offerText').textContent = text; $('offer').classList.remove('hidden'); }
function clearOffer(expired) { const o = offer; offer = null; $('offer').classList.add('hidden'); if (expired && o?.onExpire) o.onExpire(); }
async function acceptOffer() {
  if (!offer) return; const o = offer; offer = null; $('offer').classList.add('hidden');
  const ok = await Ads.rewarded();
  if (ok) o.action(); else { toast('El anuncio no se completó', '#ff4d6d'); o.onExpire?.(); }
}
$('offerBtn').onclick = acceptOffer;

// ======================= Game state =======================
const S = { mode: 'attract', tod: +(params.get('tod') ?? 0.45), todAuto: false, cam: 0, camYaw: 0, footYaw: 0, camDist: 1, shake: 0, wp: 0, photo: false };
const P = { stars: 0, drift: 0, driftT: 0, best: 0 };
let cur = null; // vehicle being driven; null = on foot
const hero = makePerson({ shirt: '#ff4fa8', pants: '#ffffff', skin: '#c68e62', hair: '#1b1410', glasses: true });
scene.add(hero.group); hero.group.visible = false;
const foot = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, h: 0, phase: 0, grounded: true, swim: false };
const body = () => cur ? { x: cur.s.x, y: cur.s.y, z: cur.s.z, h: cur.s.h, vx: cur.s.vx, vz: cur.s.vz } : { x: foot.x, y: foot.y, z: foot.z, h: foot.h, vx: foot.vx, vz: foot.vz };

function ownedVehicle(type) { return vehicles.find(v => v.kind === 'owned' && v.type === type); }
function summon(type) {
  let v = ownedVehicle(type);
  const [x, z, h] = type === 'jetski' ? [GARAGE.jetX, GARAGE.jetZ, 0] : [GARAGE.carX, GARAGE.carZ, -Math.PI / 2];
  if (v && v === cur) return v;
  if (!v) v = createVehicle(type, SV.color, x, z, h, 'owned');
  Object.assign(v.s, { x, z, h, vx: 0, vz: 0, vy: 0, air: false, y: type === 'jetski' ? 0 : groundHeight(x, z) });
  applyCosmetics(v); return v;
}
function enterVehicle(v) {
  cur = v; hero.group.visible = false; S.camYaw = 0;
  if (v.type === 'jetski') unlock('marinero');
}
function exitVehicle() {
  const s = cur.s, sp = Math.hypot(s.vx, s.vz);
  if (sp > 9) { toast('Frena para bajarte', '#24e7ff', 0.9); return; }
  const rx = Math.cos(s.h), rz = -Math.sin(s.h), off = VEHICLES[cur.type].r + 0.9;
  Object.assign(foot, { x: s.x - rx * off, z: s.z - rz * off, y: s.y + 0.2, vx: s.vx * 0.5, vz: s.vz * 0.5, vy: 0, h: s.h });
  if (cur.type === 'jetski') { foot.x = GARAGE.jetX + 4; foot.z = clamp(s.z, -78, -33); if (Math.abs(s.x - foot.x) > 4) { foot.x = s.x - rx * off; foot.z = s.z - rz * off; } }
  S.footYaw = s.h; cur = null; hero.group.visible = true;
}
function borrowTraffic(c) {
  const u = c.userData, h = c.rotation.y;
  scene.remove(c); trafficCars.splice(trafficCars.indexOf(c), 1);
  const v = createVehicle('sedan', u.color, c.position.x, c.position.z, h, 'borrowed');
  const rx = Math.cos(h), rz = -Math.sin(h);
  const zone = c.position.z > 40 ? ZONES[c.position.z > COL_Z ? 3 : 2] : ZONES[c.position.z > 0 ? 1 : 0];
  const d = spawnPed(zone, c.position.x - rx * 2.2, c.position.z - rz * 2.2, { temp: true });
  d.state = 'angry'; d.t = 4; d.h = h; toast(`Conductor: "${pick(['¡Oye, mi carro!', '¡Me lo devuelves con gasolina!', '¡Ay, no puede ser!'])}"`, '#ff9a3c', 1.8);
  const lane = u.lane; spawnTraffic(lane, lane.dir > 0 ? XMIN - 10 : XMAX + 10);
  const borrowed = vehicles.filter(x => x.kind === 'borrowed' && x !== v);
  if (borrowed.length > 3) removeVehicle(borrowed[0]);
  enterVehicle(v); unlock('prestado');
}
function interactTarget() {
  if (cur) return null;
  if (Math.hypot(foot.x - GARAGE.x, foot.z - GARAGE.z) < 2.6) return { kind: 'garage', label: 'Abrir garaje' };
  let best = null, bd = 3.6;
  for (const v of vehicles) { const d = Math.hypot(v.s.x - foot.x, v.s.z - foot.z); if (d < bd) { bd = d; best = { kind: 'vehicle', v, label: `Subir · ${VEHICLES[v.type].name}` }; } }
  for (const c of trafficCars) { const d = Math.hypot(c.position.x - foot.x, c.position.z - foot.z); if (d < bd) { bd = d; best = { kind: 'traffic', c, label: 'Pedir prestado este auto' }; } }
  return best;
}
function interact() {
  if (S.mode !== 'play') return;
  if (cur) return exitVehicle();
  const t = interactTarget(); if (!t) return;
  if (t.kind === 'garage') openShop();
  else if (t.kind === 'vehicle') enterVehicle(t.v);
  else borrowTraffic(t.c);
}

// ======================= Input =======================
const keys = {}, prevKeys = {};
let gpPrevY = false;
addEventListener('keydown', e => {
  keys[e.code] = true; if (e.repeat) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyC') cycleCam(); if (e.code === 'KeyR') toggleRadio(); if (e.code === 'KeyP') S.photo = true; if (e.code === 'KeyG') acceptOffer();
  if (e.code === 'Escape') { if (S.mode === 'play') pause(); else if (S.mode === 'pause') resume(); else if (S.mode === 'shop') closeShop(); }
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k; b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => keys[k] = false);
});
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw: cur ? S.camYaw : S.footYaw }; });
addEventListener('pointermove', e => { if (!drag) return; const y = drag.yaw - (e.clientX - drag.x) * 0.008; if (cur) S.camYaw = y; else S.footYaw = y; });
addEventListener('pointerup', () => drag = null);
renderer.domElement.addEventListener('wheel', e => { S.camDist = clamp(S.camDist * (e.deltaY > 0 ? 1.1 : 0.9), 0.5, 2.5); }, { passive: true });
function readInput() {
  let steer = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let gas = keys.ArrowUp || keys.KeyW ? 1 : 0, brake = keys.ArrowDown || keys.KeyS ? 1 : 0, hand = keys.Space ? 1 : 0, horn = !!keys.KeyH, run = !!(keys.ShiftLeft || keys.ShiftRight);
  let fwdAxis = gas - brake, act = (keys.KeyF && !prevKeys.KeyF) || (keys.Enter && !prevKeys.Enter), rot = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
  const gp = navigator.getGamepads?.()[0];
  if (gp) {
    if (Math.abs(gp.axes[0]) > 0.15) steer = gp.axes[0];
    if (Math.abs(gp.axes[1]) > 0.15) fwdAxis = -gp.axes[1];
    if (Math.abs(gp.axes[2] || 0) > 0.2) rot = gp.axes[2];
    gas = Math.max(gas, gp.buttons[7]?.value || 0); brake = Math.max(brake, gp.buttons[6]?.value || 0);
    hand = (hand || gp.buttons[0]?.pressed) ? 1 : 0; horn = horn || !!gp.buttons[1]?.pressed; run = run || !!gp.buttons[2]?.pressed;
    const y = !!gp.buttons[3]?.pressed; if (y && !gpPrevY) act = true; gpPrevY = y;
  }
  return { steer, gas, brake, hand, horn, run, fwdAxis, act, rot };
}
const WAYPOINTS = [[310, -3.5], [320, 40], [320, 83.5], [-310, 83.5], [-320, 40], [-320, -3.5]];
function autopilot(s) {
  const [tx, tz] = WAYPOINTS[S.wp % WAYPOINTS.length], dx = tx - s.x, dz = tz - s.z;
  if (Math.hypot(dx, dz) < 10) S.wp++;
  const diff = wrapAngle(Math.atan2(-dx, -dz) - s.h), sp = Math.hypot(s.vx, s.vz);
  return { steer: clamp(-diff * 2.5, -1, 1), gas: Math.abs(diff) > 0.5 && sp > 14 ? 0 : 1, brake: Math.abs(diff) > 0.9 && sp > 12 ? 1 : 0, hand: 0, horn: false };
}

// ======================= Audio =======================
let ac = null, master, engOsc, engGain, engFilter, hornGain, radioOn = false, radioGain, nextNote = 0, step = 0, NB;
function initAudio() {
  if (ac) return;
  try { ac = new AudioContext(); } catch (e) { return; }
  master = ac.createGain(); master.gain.value = SV.vol; master.connect(ac.destination);
  engOsc = ac.createOscillator(); engOsc.type = 'sawtooth'; engFilter = ac.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 500;
  engGain = ac.createGain(); engGain.gain.value = 0; engOsc.connect(engFilter).connect(engGain).connect(master); engOsc.start();
  hornGain = ac.createGain(); hornGain.gain.value = 0; hornGain.connect(master);
  for (const f of [392, 494]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f; const lp = ac.createBiquadFilter(); lp.frequency.value = 1800; o.connect(lp).connect(hornGain); o.start(); }
  radioGain = ac.createGain(); radioGain.gain.value = 0; radioGain.connect(master);
  setInterval(radioTick, 25);
}
function muteAll(m) { if (master) master.gain.setTargetAtTime(m ? 0 : SV.vol, ac.currentTime, 0.05); }
const noiseBuf = () => { const b = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
function blip(freq = 880, dur = 0.12, type = 'sine', vol = 0.15, slide = 2) {
  if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * slide, ac.currentTime + dur); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(master); o.start(); o.stop(ac.currentTime + dur + 0.02);
}
function thud() { if (!ac) return; NB ||= noiseBuf(); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = NB; f.type = 'lowpass'; f.frequency.value = 300;
  g.gain.setValueAtTime(0.5, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25); s.connect(f).connect(g).connect(master); s.start(); }
function splash() { if (!ac) return; NB ||= noiseBuf(); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = NB; f.type = 'bandpass'; f.frequency.value = 900;
  g.gain.setValueAtTime(0.4, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3); s.connect(f).connect(g).connect(master); s.start(); }
// Original synthwave loop: Am - F - C - G at 104 bpm
const BPM = 104, PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function noiseHit(t, type, freq, vol, dur) { NB ||= noiseBuf(); const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = NB; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); n.connect(f).connect(g).connect(radioGain); n.start(t); n.stop(t + dur + 0.02); }
function radioTick() {
  if (!radioOn) return;
  const spb = 60 / BPM / 4;
  if (nextNote < ac.currentTime) nextNote = ac.currentTime + 0.05;
  while (nextNote < ac.currentTime + 0.12) {
    const t = nextNote, bar = Math.floor(step / 16) % 4, s = step % 16, ch = PROG[bar];
    if (s % 4 === 0) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(radioGain); o.start(t); o.stop(t + 0.3); }
    if (s === 4 || s === 12) noiseHit(t, 'bandpass', 1800, 0.35, 0.18);
    if (s % 2 === 0) noiseHit(t, 'highpass', 7000, s % 4 === 2 ? 0.12 : 0.05, 0.05);
    if (s % 2 === 0) { const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(ch[0] - 24 + (s % 4 === 2 ? 12 : 0));
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(200, t + spb * 2);
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + spb * 1.9); o.connect(f).connect(g).connect(radioGain); o.start(t); o.stop(t + spb * 2); }
    if (s % 3 === 0) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = mtof(ch[(step / 3 | 0) % 3] + 12);
      g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + spb * 2.5); o.connect(g).connect(radioGain); o.start(t); o.stop(t + spb * 3); }
    if (s === 0) for (const m of ch) { const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'sawtooth'; o.detune.value = rand(-8, 8); o.frequency.value = mtof(m);
      f.frequency.value = 1200; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + spb * 16);
      o.connect(f).connect(g).connect(radioGain); o.start(t); o.stop(t + spb * 16 + 0.05); }
    nextNote += spb; step++;
  }
}
function toggleRadio() {
  initAudio(); if (!ac) return; radioOn = !radioOn; radioGain.gain.setTargetAtTime(radioOn ? 0.5 : 0, ac.currentTime, 0.1);
  $('radioBtn').classList.toggle('on', radioOn); toast(radioOn ? '📻 Radio Brisa 104.0' : '📻 Off', '#24e7ff');
}
$('vol').value = SV.vol;
$('vol').oninput = e => { SV.vol = +e.target.value; markDirty(); if (master) master.gain.value = SV.vol; };

// ======================= UI =======================
let toastT = 0;
function toast(msg, color = '#ffd166', dur = 1.4) { const t = $('toast'); t.textContent = msg; t.style.color = color; t.style.opacity = 1; toastT = dur; }
const CAMS = ['Persecución', 'Cinemática', 'Primera persona', 'Aérea'];
function cycleCam() { S.cam = (S.cam + 1) % CAMS.length; S.camYaw = 0; toast('📷 ' + CAMS[S.cam], '#24e7ff', 0.9); }
$('camBtn').onclick = cycleCam; $('radioBtn').onclick = toggleRadio; $('setBtn').onclick = () => $('settings').classList.toggle('hidden');
$('photoBtn').onclick = () => S.photo = true; $('skipBtn').onclick = () => { if (S.mode === 'play') { newMission(); toast('Nueva misión', '#24e7ff'); } };
$('menuBtn').onclick = () => { if (S.mode === 'play') pause(); };
$('tod').oninput = e => { S.tod = +e.target.value; };
$('todAuto').onchange = e => S.todAuto = e.target.checked;
const fmt = n => '$' + n.toLocaleString('es');

function renderMenu() {
  $('vehicles').innerHTML = SHOP_TYPES.map(k => {
    const v = VEHICLES[k], own = SV.owned[k], bar = (n, max) => '█'.repeat(Math.round(n / max * 8)).padEnd(8, '░');
    return `<div class="veh ${k === SV.vehicle ? 'sel' : ''} ${own ? '' : 'locked'}" data-k="${k}"><span class="ic">${v.icon}</span><b>${v.name}</b><span>${own ? v.desc : '🔒 ' + fmt(v.price) + ' en el garaje'}</span>
      <div class="bars">VEL ${bar(v.max, 42)}<br>GIRO ${bar(v.turn, 3)}<br>ARENA ${bar(v.sand, 1)}</div></div>`;
  }).join('');
  document.querySelectorAll('#vehicles .veh').forEach(el => el.onclick = () => {
    const k = el.dataset.k; if (!SV.owned[k]) return toast('Cómpralo en el garaje 🔧', '#ffd166');
    SV.vehicle = k; markDirty(); renderMenu(); if (S.mode === 'attract') startAttract();
  });
  $('swatches').innerHTML = CAR_COLORS.map(c => `<button class="sw ${c === SV.color ? 'sel' : ''} ${SV.colors[c] ? '' : 'locked'}" style="background:${c}" data-c="${c}" title="${SV.colors[c] ? '' : fmt(COLOR_PRICE) + ' en el garaje'}"></button>`).join('');
  $('swatches').querySelectorAll('.sw').forEach(el => el.onclick = () => { const c = el.dataset.c; if (!SV.colors[c]) return toast('Compra este color en el garaje 🔧', '#ffd166'); setColor(c); renderMenu(); });
  renderAch(); $('achWrap').classList.toggle('hidden', S.mode !== 'pause');
}
function setColor(c) { SV.color = c; markDirty(); vehicles.forEach(applyCosmetics); }
function pause() { S.mode = 'pause'; Ads.gameplayStop(); $('menu').classList.remove('hidden'); $('menuTitle').innerHTML = 'Pausa'; $('menuText').textContent = 'Elige vehículo o color, revisa tus logros y sigue explorando.'; $('playBtn').textContent = 'Continuar'; renderMenu(); save(); }
function resume() {
  S.mode = 'play'; Ads.gameplayStart(); $('menu').classList.add('hidden');
  if (cur && cur.kind === 'owned' && cur.type !== SV.vehicle) { const s = cur.s; const v = summon(SV.vehicle); if (v.type !== 'jetski') Object.assign(v.s, { x: s.x, z: s.z, h: s.h, y: s.y }); cur.s.x += 1000; removeVehicle(cur); enterVehicle(v); }
}
function startAttract() {
  for (const v of [...vehicles]) removeVehicle(v);
  const v = createVehicle(SV.vehicle === 'jetski' ? 'convertible' : SV.vehicle, SV.color, -300, -3.5, -Math.PI / 2, 'owned'); applyCosmetics(v); cur = v; S.wp = 0; hero.group.visible = false;
}
function startGame() {
  for (const v of [...vehicles]) removeVehicle(v);
  P.stars = 0; P.drift = 0; P.best = 0; placeStars();
  let v;
  if (SV.vehicle === 'jetski') { v = summon('jetski'); } else { v = createVehicle(SV.vehicle, SV.color, -200, -3.5, -Math.PI / 2, 'owned'); applyCosmetics(v); }
  enterVehicle(v); newMission(); S.mode = 'play'; S.cam = 0; Ads.gameplayStart();
  $('menu').classList.add('hidden'); $('benchResult').hidden = true;
  toast('¡Bienvenido a Miami Beach!', '#ff4fa8', 2);
}
$('playBtn').onclick = () => { initAudio(); if (ac?.state === 'suspended') ac.resume(); if (S.mode === 'pause') resume(); else startGame(); };
$('resetSave').onclick = () => { if (!confirm('¿Borrar todo tu progreso (dinero, vehículos, logros)?')) return; try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); };

// ---- Garage shop
function openShop() { S.mode = 'shop'; Ads.gameplayStop(); $('shop').classList.remove('hidden'); renderShop(); blip(520, 0.1, 'triangle', 0.1, 1.5); }
function closeShop() { S.mode = 'play'; Ads.gameplayStart(); $('shop').classList.add('hidden'); save(); }
$('shopClose').onclick = closeShop;
function buy(price) { if (SV.cash < price) { toast('No te alcanza 💸', '#ff4d6d'); return false; } SV.cash -= price; markDirty(); blip(880, 0.12, 'square', 0.1, 1.5); return true; }
function renderShop() {
  $('shopCash').textContent = fmt(SV.cash);
  $('shopVeh').innerHTML = SHOP_TYPES.map(k => {
    const v = VEHICLES[k], own = SV.owned[k];
    return `<div class="veh ${own ? '' : 'locked'}"><span class="ic">${v.icon}</span><b>${v.name}</b><span>${v.desc}</span>
      <button data-k="${k}" class="${own ? '' : 'primary'}" ${!own && SV.cash < v.price ? 'disabled' : ''}>${own ? (k === 'jetski' ? 'Traer al muelle' : 'Traer aquí') : 'Comprar ' + fmt(v.price)}</button></div>`;
  }).join('');
  $('shopVeh').querySelectorAll('button').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (!SV.owned[k]) { if (!buy(VEHICLES[k].price)) return; SV.owned[k] = true; toast(`¡${VEHICLES[k].name} es tuyo!`, '#7cff6b'); if (SHOP_TYPES.every(t => SV.owned[t])) unlock('flota'); }
    SV.vehicle = k; markDirty(); summon(k); toast(k === 'jetski' ? 'Tu moto acuática te espera en el muelle 🚤' : `${VEHICLES[k].name} estacionado frente al garaje`, '#24e7ff', 2); renderShop();
  });
  $('shopColors').innerHTML = CAR_COLORS.map(c => `<button class="sw ${c === SV.color ? 'sel' : ''} ${SV.colors[c] ? '' : 'locked'}" style="background:${c}" data-c="${c}"></button>`).join('');
  $('shopColors').querySelectorAll('.sw').forEach(el => el.onclick = () => {
    const c = el.dataset.c; if (!SV.colors[c]) { if (!buy(COLOR_PRICE)) return; SV.colors[c] = true; } setColor(c); renderShop();
  });
  const adReady = clockT - Ads.lastShopAd > 180;
  $('shopExtras').innerHTML = `
    <div class="extra"><div><b>💜 Luces de neón bajo el vehículo</b><span>Brillan con el color de tu pintura, sobre todo de noche</span></div>
      <button id="glowBtn" class="${SV.underglow ? '' : 'primary'}">${SV.underglow ? (SV.glowOn ? 'Apagar' : 'Encender') : 'Comprar ' + fmt(GLOW_PRICE)}</button></div>
    <div class="extra"><div><b>📺 Patrocinio del día</b><span>Mira un anuncio corto y gana $50 (cada 3 minutos)</span></div>
      <button id="adCash" class="primary" ${adReady ? '' : 'disabled'}>${adReady ? '+$50' : 'Vuelve en ' + Math.ceil(180 - (clockT - Ads.lastShopAd)) + ' s'}</button></div>`;
  $('glowBtn').onclick = () => { if (!SV.underglow) { if (!buy(GLOW_PRICE)) return; SV.underglow = true; SV.glowOn = true; unlock('estilo'); } else SV.glowOn = !SV.glowOn; markDirty(); vehicles.forEach(applyCosmetics); renderShop(); };
  $('adCash').onclick = async () => { const ok = await Ads.rewarded(); S.mode = 'shop'; if (ok) { Ads.lastShopAd = clockT; SV.cash += 50; markDirty(); toast('+$50 💵', '#7cff6b'); } renderShop(); };
}

// ======================= Time of day =======================
const fogDay = new THREE.Color(0xcfe3f2), fogSunset = new THREE.Color(0xf2a07b), fogNight = new THREE.Color(0x141530);
const sunDir = new THREE.Vector3(); let night = 0;
function applyTimeOfDay(t) {
  const elev = lerp(48, -14, t) * Math.PI / 180, az = (215 + t * 25) * Math.PI / 180;
  sunDir.set(Math.cos(elev) * Math.sin(az) * 0.6, Math.sin(elev), Math.abs(Math.cos(elev) * Math.cos(az))).normalize();
  skyU.sunPosition.value.copy(sunDir);
  night = smooth(t, 0.55, 0.82);
  const dayAmt = clamp(Math.sin(elev) * 3, 0, 1), hi = clamp(Math.sin(elev) * 2, 0, 1);
  sun.intensity = 3.2 * dayAmt; sun.color.setHSL(lerp(0.06, 0.12, hi), 0.9, lerp(0.62, 0.95, hi));
  hemi.intensity = lerp(0.9, 0.35, night); hemi.color.setHSL(lerp(0.58, 0.68, night), 0.6, lerp(0.75, 0.35, night)); hemi.groundColor.setHSL(lerp(0.09, 0.75, night), 0.4, lerp(0.6, 0.12, night));
  moonLight.intensity = 0.5 * night;
  const fc = t < 0.5 ? fogDay.clone().lerp(fogSunset, smooth(t, 0.25, 0.5)) : fogSunset.clone().lerp(fogNight, smooth(t, 0.5, 0.78));
  scene.fog.color.copy(fc); oceanU.uFogCol.value.copy(fc);
  renderer.toneMappingExposure = lerp(0.55, 0.85, night); bloom.strength = lerp(0.35, 1.0, night);
  oceanU.uSunDir.value.copy(sunDir); oceanU.uSunCol.value.copy(sun.color).multiplyScalar(dayAmt); oceanU.uNight.value = night;
  oceanU.uSky.value.copy(fc).lerp(new THREE.Color(0x6fb6e8), (1 - night) * (1 - smooth(t, 0.3, 0.5)) * 0.7);
  starMat.opacity = night; nightStars.visible = night > 0.01; moonMesh.material.opacity = night; moonMesh.visible = night > 0.01;
  const ni = 0.35 + 2.6 * night;
  for (const m of neonMats) m.color.copy(m.userData.base).multiplyScalar(m.map ? 0.55 + 1.6 * night : ni);
  for (const m of windowMats) m.emissiveIntensity = 1.4 * night;
  bulbMat.color.setRGB(1, 0.76, 0.48).multiplyScalar(0.4 + 3 * night);
  rampMat.emissiveIntensity = 0.1 + 1.2 * night;
  for (const v of vehicles) v.model.glow.material.opacity = 0.35 + 0.6 * night;
  const hrs = 14 + t * 9, hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60), str = `${hh}:${String(mm).padStart(2, '0')}`;
  $('clock').textContent = str; $('todLabel').textContent = `(${str})`;
}
function applyQuality(q) {
  quality = q; const p = PRESETS[q];
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * p.pr); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = p.shadow > 0; sun.castShadow = p.shadow > 0;
  if (p.shadow) { sun.shadow.mapSize.set(p.shadow, p.shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  bloom.enabled = p.bloom; scene.fog.density = p.fog; oceanU.uFogD.value = p.fog;
  buildOcean(p.water); buildPalms(p.palms); buildTraffic(p.traffic); buildPeds(p.peds);
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
}
$('quality').onchange = e => applyQuality(e.target.value);

// ======================= Simulation =======================
function surfaceAt(x, z) {
  if (z < WATER_Z) return 'water';
  if (Math.abs(z - OD_Z) < ROAD_HW || Math.abs(z - COL_Z) < ROAD_HW || (z > OD_Z && z < COL_Z && CROSS.some(c => Math.abs(c - x) < CROSS_HW))) return 'road';
  if (z < -12) return 'sand';
  return 'paver';
}
function collide(s, R, yMax, onHit) {
  for (const c of colliders) {
    if (s.x > c.x0 - R && s.x < c.x1 + R && s.z > c.z0 - R && s.z < c.z1 + R && s.y < yMax) {
      const dl = s.x - (c.x0 - R), dr = c.x1 + R - s.x, dn = s.z - (c.z0 - R), df = c.z1 + R - s.z, m = Math.min(dl, dr, dn, df);
      if (m === dl) { s.x = c.x0 - R; s.vx = -Math.abs(s.vx) * 0.3; } else if (m === dr) { s.x = c.x1 + R; s.vx = Math.abs(s.vx) * 0.3; }
      else if (m === dn) { s.z = c.z0 - R; s.vz = -Math.abs(s.vz) * 0.3; } else { s.z = c.z1 + R; s.vz = Math.abs(s.vz) * 0.3; }
      onHit?.(1);
    }
  }
  for (const c of circles) {
    const dx = s.x - c.x, dz = s.z - c.z; if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
    const d = Math.hypot(dx, dz), rr = c.r + R * 0.8;
    if (d < rr && d > 1e-4 && s.y < 3) { const nx = dx / d, nz = dz / d; s.x = c.x + nx * rr; s.z = c.z + nz * rr; const vn = s.vx * nx + s.vz * nz;
      if (vn < 0) { s.vx -= 1.5 * vn * nx; s.vz -= 1.5 * vn * nz; if (vn < -6) onHit?.(0.7); } }
  }
}
function updateVehicle(v, dt, inp, t) {
  const s = v.s, V = VEHICLES[v.type], jet = !!V.water, isCur = v === cur;
  const surf = surfaceAt(s.x, s.z), onWater = surf === 'water';
  const fx = -Math.sin(s.h), fz = -Math.cos(s.h), rx = Math.cos(s.h), rz = -Math.sin(s.h);
  let fwd = s.vx * fx + s.vz * fz, lat = s.vx * rx + s.vz * rz;
  const k = jet ? (onWater ? 1 : 0.1) : surf === 'sand' ? V.sand : surf === 'paver' ? 0.9 : 1;
  const maxS = V.max * k;
  if (!s.air) {
    if (inp.gas) fwd += V.accel * inp.gas * (fwd < maxS ? 1 : 0) * dt * (surf === 'sand' && !jet ? lerp(0.6, 1, V.sand) : 1);
    if (inp.brake) { if (fwd > 0.5) fwd -= (jet ? 14 : 32) * inp.brake * dt; else fwd = Math.max(-8, fwd - V.accel * 0.6 * inp.brake * dt); }
    fwd -= fwd * (0.12 + (jet ? (onWater ? 0.1 : 3) : surf === 'sand' ? (1 - V.sand) * 1.4 : 0)) * dt;
    if (fwd > maxS) fwd = lerp(fwd, maxS, 2 * dt);
    if (inp.hand) fwd -= Math.sign(fwd) * 6 * dt;
    lat *= Math.exp(-(inp.hand ? 1.2 : V.grip) * (surf === 'sand' && !jet ? 0.6 : 1) * dt);
  }
  s.vx = fx * fwd + rx * lat; s.vz = fz * fwd + rz * lat;
  s.steer = lerp(s.steer, inp.steer, 1 - Math.exp(-10 * dt));
  if (!s.air) s.h -= s.steer * V.turn * clamp(fwd / 8, -1, 1) * (1 - 0.45 * Math.min(1, Math.abs(fwd) / V.max)) * dt * (inp.hand ? 1.45 : 1);
  s.x += s.vx * dt; s.z += s.vz * dt;
  const speed = Math.hypot(s.vx, s.vz); let landed = 0;
  if (jet && s.z < WATER_Z + 2) { s.y = Math.max(waterHeight(s.x, s.z, t) + 0.05, sandY(s.z)); s.air = false; }
  else {
    const gh = groundHeight(s.x, s.z);
    if (s.air) {
      s.vy -= 22 * dt; s.y += s.vy * dt; s.airT += dt;
      if (s.y <= gh) { s.y = gh; s.air = false; landed = s.airT; if (isCur) { S.shake = Math.min(0.6, -s.vy * 0.03); thud(); } }
    } else {
      const slopeVy = (gh - s.y) / Math.max(dt, 1e-3);
      if (gh < s.y - 0.25 && s.lastSlope > 1) { s.air = true; s.vy = s.lastSlope; s.airT = 0; } else { s.y = gh; s.lastSlope = slopeVy; }
    }
  }
  collide(s, V.r, 6, f => { if (isCur && speed > 8) { thud(); S.shake = 0.5 * f; } });
  if (s.x < XMIN || s.x > XMAX) { s.x = clamp(s.x, XMIN, XMAX); s.vx *= -0.3; }
  if (s.z > 140) { s.z = 140; s.vz = 0; }
  if (jet) { if (s.z < -600) { s.z = -600; s.vz *= -0.3; } }
  else if (s.z < SHORE_Z - 2) {
    if (isCur) { toast('¡Splash! Al agua 🌊', '#24e7ff'); splash(); if (S.mode === 'play') { SV.cash = Math.max(0, SV.cash - 10); markDirty(); } }
    Object.assign(s, { z: -4, vx: 0, vz: 0, h: -Math.PI / 2, y: 0, air: false });
  }
  return { speed, fwd, lat, landed };
}
function syncVehicle(v) {
  const s = v.s, g = v.model.group, V = VEHICLES[v.type], sp = Math.hypot(s.vx, s.vz);
  g.position.set(s.x, s.y, s.z); g.rotation.set(0, s.h, 0);
  if (v.type === 'moped') g.rotation.z = -s.steer * clamp(sp / 20, 0, 1) * 0.45;
  else if (v.type === 'jetski') { g.rotation.z = -s.steer * clamp(sp / 20, 0, 1) * 0.3; g.rotation.x = clamp(sp / 30, 0, 1) * 0.12 + Math.sin(clockT * 3 + s.x) * 0.03; }
  else g.rotation.z = -s.steer * clamp(sp / 30, 0, 1) * 0.06;
  if (s.air) g.rotation.x = clamp(s.vy * 0.03, -0.3, 0.3);
  for (const w of v.model.wheels) w.children[0].rotation.x = -s.wheelSpin / w.userData.r;
  for (const w of v.model.front) w.rotation.y = -s.steer * 0.45;
  for (const d of v.model.drivers) d.visible = v === cur;
}
function updateFoot(dt, inp, t) {
  const F = foot;
  S.footYaw += inp.rot * 2.2 * dt;
  const yaw = S.footYaw, cfx = -Math.sin(yaw), cfz = -Math.cos(yaw), crx = Math.cos(yaw), crz = -Math.sin(yaw);
  let mx = cfx * inp.fwdAxis + crx * inp.steer, mz = cfz * inp.fwdAxis + crz * inp.steer;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const pier = onPier(F.x, F.z), water = F.z < WATER_Z - 1 && !pier, deep = F.z < -64 && !pier;
  F.swim = deep;
  const spd = deep ? 3.2 : water ? 2.6 : inp.run ? 9 : 4.5;
  const acc = F.grounded || deep ? 12 : 3;
  F.vx = lerp(F.vx, mx * spd, 1 - Math.exp(-acc * dt)); F.vz = lerp(F.vz, mz * spd, 1 - Math.exp(-acc * dt));
  if (ml > 0.1) F.h = lerpAngle(F.h, Math.atan2(-mx, -mz), 1 - Math.exp(-12 * dt));
  if (inp.hand && F.grounded && !deep) { F.vy = 7; F.grounded = false; }
  F.x += F.vx * dt; F.z += F.vz * dt;
  if (deep) { F.y = waterHeight(F.x, F.z, t) - 1.25; F.vy = 0; F.grounded = true; unlock('nadador'); }
  else {
    const gh = groundHeight(F.x, F.z);
    F.vy -= 22 * dt; F.y += F.vy * dt;
    if (F.y <= gh) { F.y = gh; F.vy = 0; F.grounded = true; } else if (F.y > gh + 0.15) F.grounded = false;
  }
  collide(F, 0.35, 4.5);
  for (const v of vehicles) { const dx = F.x - v.s.x, dz = F.z - v.s.z, d = Math.hypot(dx, dz), rr = VEHICLES[v.type].r + 0.4; if (d < rr && d > 1e-4) { F.x = v.s.x + dx / d * rr; F.z = v.s.z + dz / d * rr; } }
  F.x = clamp(F.x, XMIN, XMAX); F.z = clamp(F.z, -170, 140);
  if (F.z < -165) toast('Demasiado lejos, regresa a la playa 🦈', '#24e7ff', 0.5);
  const sp = Math.hypot(F.vx, F.vz); F.phase += sp * dt * (deep ? 1.2 : 2.3);
  hero.group.position.set(F.x, F.y, F.z); hero.group.rotation.y = F.h;
  animatePerson(hero, F.phase, clamp(sp / 4.5, 0, 1.2), deep ? 'swim' : !F.grounded ? 'air' : 'walk');
  return sp;
}
const tmpBody = { x: 0, z: 0 };
function updateTraffic(dt) {
  const b = body();
  for (const c of trafficCars) {
    const u = c.userData, L = u.lane; let target = u.base;
    for (const o of trafficCars) if (o !== c && o.userData.lane === L) { const ahead = (o.position.x - c.position.x) * L.dir; if (ahead > 0 && ahead < 12) target = Math.min(target, o.userData.speed * (ahead < 7 ? 0.5 : 1)); }
    const pAhead = (b.x - c.position.x) * L.dir;
    if (pAhead > 0 && pAhead < 14 && Math.abs(b.z - L.z) < 2.6) target = 0;
    for (const p of peds) { const a = (p.x - c.position.x) * L.dir; if (a > 0 && a < 9 && Math.abs(p.z - L.z) < 2) target = 0; }
    u.speed = lerp(u.speed, target, 1 - Math.exp(-3 * dt));
    c.position.x += u.speed * L.dir * dt;
    if (c.position.x > XMAX + 20) c.position.x = XMIN - 20; if (c.position.x < XMIN - 20) c.position.x = XMAX + 20;
    const dx = b.x - c.position.x, dz = b.z - c.position.z;
    if (cur) {
      const s = cur.s;
      if (Math.abs(dx) < 3.1 && Math.abs(dz) < 1.9 && s.y < 1.8) {
        const nx = Math.abs(dx) / 3.1 > Math.abs(dz) / 1.9 ? Math.sign(dx) : 0, nz = nx ? 0 : Math.sign(dz);
        s.x += nx * 0.6; s.z += nz * 0.6; s.vx = s.vx * 0.3 + nx * 6; s.vz = s.vz * 0.3 + nz * 6;
        if (!u.hitT || performance.now() - u.hitT > 1000) { u.hitT = performance.now(); thud(); S.shake = 0.6; if (S.mode === 'play') { SV.cash = Math.max(0, SV.cash - 5); markDirty(); toast('¡Choque! −$5', '#ff4d6d'); } }
      }
    } else if (Math.abs(dx) < 2.6 && Math.abs(dz) < 1.4 && foot.y < 1.5) {
      if (Math.abs(dx) / 2.6 > Math.abs(dz) / 1.4) foot.x = c.position.x + Math.sign(dx) * 2.6; else foot.z = c.position.z + Math.sign(dz || 1) * 1.4;
    }
  }
}
let pedPenaltyT = 0;
function updatePeds(dt, t) {
  const car = cur?.s, carSp = car ? Math.hypot(car.vx, car.vz) : 0;
  for (let i = peds.length - 1; i >= 0; i--) {
    const p = peds[i];
    p.t -= dt; let sp = 0, mode = 'walk';
    if (p.state === 'down') { mode = 'down'; if (p.t <= 0) { p.state = 'angry'; p.t = 2; } }
    else if (p.state === 'angry') { mode = 'angry'; if (p.t <= 0) { p.state = 'walk'; newPedTarget(p); if (p.temp) { p.state = 'leave'; p.t = 6; } } }
    else if (p.state === 'dodge') { p.x += p.vx * dt; p.z += p.vz * dt; sp = 6; mode = 'air'; if (p.t <= 0) { p.state = 'walk'; newPedTarget(p); } }
    else if (p.state === 'idle') { if (p.t <= 0) { p.state = 'walk'; newPedTarget(p); } }
    else {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      const s = p.state === 'leave' ? 3.5 : p.speed;
      if (d < 0.5) { if (p.state === 'leave') { scene.remove(p.m.group); peds.splice(i, 1); continue; } p.state = 'idle'; p.t = rand(1, 5); }
      else { p.x += dx / d * s * dt; p.z += dz / d * s * dt; p.h = lerpAngle(p.h, Math.atan2(-dx, -dz), 1 - Math.exp(-6 * dt)); sp = s; }
      if (p.state === 'leave' && p.t <= 0) { scene.remove(p.m.group); peds.splice(i, 1); continue; }
    }
    if (car && p.state !== 'down') {
      const rx = p.x - car.x, rz = p.z - car.z, d = Math.hypot(rx, rz);
      if (d < 1.7 && carSp > 4 && car.y < 1.5) {
        p.state = 'down'; p.t = 2.2; p.x += car.vx * 0.12; p.z += car.vz * 0.12; thud();
        if (S.mode === 'play' && pedPenaltyT <= 0) { SV.cash = Math.max(0, SV.cash - 10); markDirty(); toast('¡Cuidado con los peatones! −$10', '#ff4d6d'); pedPenaltyT = 2; }
      } else if (d < 10 && carSp > 6 && p.state !== 'dodge') {
        const along = (rx * car.vx + rz * car.vz) / carSp, side = (rx * car.vz - rz * car.vx) / carSp;
        if (along > 0 && Math.abs(side) < 2.4) {
          const sgn = side >= 0 ? 1 : -1, nx = car.vz / carSp * sgn, nz = -car.vx / carSp * sgn;
          p.state = 'dodge'; p.t = 0.55; p.vx = nx * 7; p.vz = nz * 7; p.h = Math.atan2(-nx, -nz);
          if (Math.random() < 0.3) toast(pick(SHOUTS), '#ffffff', 0.7);
        }
      }
    }
    if (!cur) { const dx = p.x - foot.x, dz = p.z - foot.z, d = Math.hypot(dx, dz); if (d < 0.7 && d > 1e-4) { p.x = foot.x + dx / d * 0.7; p.z = foot.z + dz / d * 0.7; } }
    p.phase += sp * dt * 2.4;
    const near = Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < 160;
    p.m.group.visible = near;
    if (near) { p.m.group.position.set(p.x, groundHeight(p.x, p.z), p.z); p.m.group.rotation.y = p.h; animatePerson(p.m, p.state === 'angry' ? t * 3 : p.phase, sp > 0 ? 1 : 0, mode); }
  }
  pedPenaltyT -= dt;
}
function updateBalls(dt) {
  const b = body(), onFoot = !cur, R = 0.6;
  for (const ball of balls) {
    const v = ball.userData.v, dx = ball.position.x - b.x, dz = ball.position.z - b.z, d = Math.hypot(dx, dz) || 1;
    if (!onFoot && d < 1.9 && ball.position.y < b.y + 2.5) { const sp = Math.hypot(b.vx, b.vz); v.set(b.vx * 1.3 + dx / d * 4, 4 + sp * 0.35, b.vz * 1.3 + dz / d * 4); blip(220, 0.1, 'sine', 0.15, 0.6); }
    else if (onFoot && d < 1.0 && ball.position.y < b.y + 1.5) { const sp = Math.hypot(b.vx, b.vz); v.set(dx / d * (5 + sp), 5 + sp * 0.4, dz / d * (5 + sp)); blip(260, 0.1, 'sine', 0.15, 0.6); unlock('futbol'); }
    v.y -= 20 * dt; ball.position.addScaledVector(v, dt);
    const gy = sandY(ball.position.z) + R;
    if (ball.position.y < gy) { ball.position.y = gy; v.y = Math.abs(v.y) > 1.5 ? -v.y * 0.55 : 0; v.x *= 0.96; v.z *= 0.96; }
    v.x *= Math.exp(-0.4 * dt); v.z *= Math.exp(-0.4 * dt);
    ball.rotation.x += v.z * dt / R; ball.rotation.z -= v.x * dt / R;
    if (ball.position.z < SHORE_Z) v.z = Math.abs(v.z) * 0.5;
    if (ball.position.z > -13 && ball.position.y < 1) { v.z = -Math.abs(v.z) * 0.6; ball.position.z = -13; }
    ball.position.x = clamp(ball.position.x, XMIN, XMAX);
  }
}
const dummy = new THREE.Object3D();
function updateStars(t) {
  const b = body(); let all = true;
  starPts.forEach((s, i) => {
    if (!s.got && S.mode === 'play' && Math.hypot(b.x - s.x, b.z - s.z) < 2.2 && Math.abs(b.y + 1 - s.y) < 2.6) {
      s.got = true; P.stars++; SV.cash += 10; markDirty(); blip(1100, 0.15, 'square', 0.08, 1.6); toast(`⭐ ${P.stars}/${STAR_N}`, '#ffd166', 0.8);
    }
    if (!s.got) all = false;
    dummy.position.set(s.x, s.y + Math.sin(t * 2 + i) * 0.25, s.z); dummy.rotation.set(0, t * 2 + i, 0); dummy.scale.setScalar(s.got ? 0 : 0.9);
    dummy.updateMatrix(); collect.setMatrixAt(i, dummy.matrix);
  });
  collect.instanceMatrix.needsUpdate = true;
  if (all && starPts.length && S.mode === 'play') { SV.cash += 150; markDirty(); unlock('estrellas'); toast('¡Todas las estrellas! +$150', '#ffd166', 2.5); placeStars(); P.stars = 0; }
}
function updateMission(dt, speed, t) {
  const b = body(), d = Math.hypot(b.x - M.target.x, b.z - M.target.z), playing = S.mode === 'play';
  beacon.position.copy(M.target); ring.position.set(M.target.x, groundHeight(M.target.x, M.target.z) + 0.3, M.target.z); ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
  beaconMat.opacity = 0.18 + 0.12 * Math.sin(t * 3);
  arrow.position.set(b.x, b.y + (cur ? (cur.type === 'jeep' ? 4.2 : 3.6) : 2.6), b.z); arrow.rotation.y = Math.atan2(-(M.target.x - b.x), -(M.target.z - b.z));
  arrow.visible = playing && d > 12 && M.stage !== 'expired'; beacon.visible = ring.visible = playing && M.stage !== 'expired';
  if (M.stage === 'pickup') { passenger.group.rotation.y = Math.atan2(-(b.x - M.target.x), -(b.z - M.target.z)); animatePerson(passenger, t * 2, 0, d < 60 ? 'wave' : 'walk'); }
  if (M.dropT > 0) {
    M.dropT -= dt; const f = M.dropFrom; f.z += f.dz * dt * 1.4; f.x += f.dx * dt * 1.4;
    passenger.group.position.set(f.x, groundHeight(f.x, f.z), f.z); passenger.group.rotation.y = Math.atan2(-f.dx, -f.dz); animatePerson(passenger, t * 6, 1);
    if (M.dropT <= 0 && M.stage !== 'pickup') passenger.group.visible = false;
    if (M.dropT <= 0 && M.stage === 'pickup') { passenger.group.position.set(M.target.x, groundHeight(M.target.x, M.target.z), M.target.z); }
  }
  if (!playing) { passenger.group.visible = false; return; }
  const dist = `${Math.round(d)} m`;
  if (M.stage === 'pickup') {
    if (M.dropT <= 0) passenger.group.visible = true;
    $('mTitle').textContent = `Recoge a ${M.name}`;
    $('mSub').textContent = cur ? `${dist} · detente dentro del círculo amarillo` : `${dist} · necesitas un vehículo (súbete a uno o pide prestado)`;
    if (cur && d < 4.5 && speed < 4) {
      M.stage = 'deliver'; passenger.group.visible = false; let s; do s = randomSpot(); while (s.distanceTo(M.target) < 160);
      M.timer = Math.round(s.distanceTo(M.target) / 11 + 15); M.target = s; setMissionColor(0x7cff6b);
      toast(`${M.name}: "¡Llévame a ${M.place}!"`, '#7cff6b', 2.2); blip(520, 0.2, 'triangle', 0.15, 1.5);
    }
  } else if (M.stage === 'deliver') {
    if (cur) M.timer -= dt; else M.timer -= dt * 0.5;
    $('mTitle').textContent = `Lleva a ${M.name} → ${M.place}`;
    $('mSub').textContent = `${dist} · ⏱ ${Math.max(0, Math.ceil(M.timer))} s` + (M.airBonus ? ` · propina por saltos +$${M.airBonus}` : '') + (cur ? '' : ' · ¡tu pasajero espera en el auto!');
    if (cur && d < 4.5 && speed < 4) {
      const pay = 25 + Math.max(0, Math.round(M.timer * 2)) + M.airBonus; SV.cash += pay; SV.stats.missions++; markDirty();
      toast(`¡Viaje completado! +$${pay}`, '#7cff6b', 2); blip(660, 0.12, 'square', 0.1, 1.5); setTimeout(() => blip(990, 0.2, 'square', 0.1, 1.5), 120);
      unlock('primer'); if (SV.stats.missions >= 10) unlock('taxista'); if (night > 0.6) unlock('nocturno');
      const ang = Math.random() * 6.28; M.dropFrom = { x: M.target.x + 2, z: M.target.z, dx: Math.cos(ang), dz: Math.sin(ang) }; M.dropT = 3; passenger.group.visible = true;
      showOffer(`📺 ¿Duplicar el pago? (+$${pay})`, () => { SV.cash += pay; markDirty(); toast(`Pago duplicado +$${pay} 💵`, '#7cff6b', 2); });
      newMission(); passenger.group.visible = true; M.dropT = 3;
    } else if (M.timer <= 0) {
      M.stage = 'expired'; toast(`${M.name} se está impacientando 😤`, '#ff4d6d', 2);
      showOffer('📺 ¿+30 s para terminar el viaje?', () => { M.stage = 'deliver'; M.timer = 30; toast('+30 s ⏱', '#7cff6b'); }, 8, () => { if (M.stage === 'expired') { toast(`${M.name} se bajó molesto`, '#ff4d6d', 2); newMission(); } });
    }
  } else if (M.stage === 'expired') { $('mTitle').textContent = 'Se acabó el tiempo'; $('mSub').textContent = 'Mira un anuncio para seguir el viaje, o espera una nueva misión'; }
}

// ======================= Camera =======================
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3();
function updateCamera(dt, speed, t) {
  const b = body(), fx = -Math.sin(b.h), fz = -Math.cos(b.h), dist = S.camDist;
  let desired, look, k = 1 - Math.exp(-6 * dt);
  if (cur) {
    if (!drag) S.camYaw *= Math.exp(-1.5 * dt);
    const yaw = b.h + S.camYaw, bx = Math.sin(yaw), bz = Math.cos(yaw);
    if (S.cam === 0) { const back = (8 + speed * 0.08) * dist; desired = tmpV.set(b.x + bx * back, b.y + 3.2 * dist + 0.6, b.z + bz * back); look = camLook.set(b.x + fx * 6, b.y + 1.2, b.z + fz * 6); }
    else if (S.cam === 1) { const a = t * 0.15 + S.camYaw; desired = tmpV.set(b.x + Math.cos(a) * 22 * dist, b.y + 8 * dist, b.z + Math.sin(a) * 22 * dist); look = camLook.set(b.x, b.y + 1.5, b.z); k = 1 - Math.exp(-3 * dt); }
    else if (S.cam === 2) { const hh = { jeep: 2.4, moped: 2.1, jetski: 1.7 }[cur.type] ?? 1.6; desired = tmpV.set(b.x + fx * 0.4, b.y + hh, b.z + fz * 0.4); look = camLook.set(b.x + fx * 20, b.y + hh - 0.6, b.z + fz * 20); k = 1; }
    else { desired = tmpV.set(b.x + bx * 18 * dist, b.y + 38 * dist, b.z + bz * 18 * dist); look = camLook.set(b.x, b.y, b.z); }
  } else {
    const yaw = S.footYaw, bx = Math.sin(yaw), bz = Math.cos(yaw), headY = b.y + (foot.swim ? 1.3 : 1.6);
    if (S.cam === 0) { desired = tmpV.set(b.x + bx * 4.6 * dist, headY + 0.9 * dist, b.z + bz * 4.6 * dist); look = camLook.set(b.x - bx * 2, headY - 0.1, b.z - bz * 2); k = 1 - Math.exp(-10 * dt); }
    else if (S.cam === 1) { const a = t * 0.15 + yaw; desired = tmpV.set(b.x + Math.cos(a) * 10 * dist, headY + 3 * dist, b.z + Math.sin(a) * 10 * dist); look = camLook.set(b.x, headY - 0.4, b.z); k = 1 - Math.exp(-3 * dt); }
    else if (S.cam === 2) { desired = tmpV.set(b.x, headY + 0.1, b.z); look = camLook.set(b.x - bx * 10, headY, b.z - bz * 10); k = 1; }
    else { desired = tmpV.set(b.x + bx * 10 * dist, b.y + 24 * dist, b.z + bz * 10 * dist); look = camLook.set(b.x, b.y, b.z); }
    hero.group.visible = S.cam !== 2;
  }
  camPos.lerp(desired, k);
  const minY = Math.max(groundHeight(camPos.x, camPos.z), camPos.z < WATER_Z ? waterHeight(camPos.x, camPos.z, t) : -10) + 0.4;
  if (camPos.y < minY) camPos.y = minY;
  camera.position.copy(camPos);
  if (S.shake > 0) { camera.position.x += (Math.random() - 0.5) * S.shake; camera.position.y += (Math.random() - 0.5) * S.shake; S.shake = Math.max(0, S.shake - dt * 1.5); }
  camera.lookAt(look);
  camera.fov = lerp(camera.fov, (S.cam === 2 ? 72 : 60) + (cur ? speed * 0.3 : 0), 0.06); camera.updateProjectionMatrix();
}

// ======================= Minimap =======================
const mm = $('minimap').getContext('2d');
const MZ0 = -110, MZ1 = 140;
function drawMinimap() {
  const W = 480, H = 200, sx = x => (x - XMIN) / (XMAX - XMIN) * W, sz = z => (z - MZ0) / (MZ1 - MZ0) * H;
  mm.fillStyle = '#ccb7c4'; mm.fillRect(0, 0, W, H);
  mm.fillStyle = '#1f6f9a'; mm.fillRect(0, 0, W, sz(WATER_Z)); mm.fillStyle = '#f0d9a8'; mm.fillRect(0, sz(WATER_Z), W, sz(-12) - sz(WATER_Z));
  mm.fillStyle = '#e8a5c4'; for (const c of colliders) mm.fillRect(sx(c.x0), sz(c.z0), sx(c.x1) - sx(c.x0), sz(c.z1) - sz(c.z0));
  mm.fillStyle = '#3a3346'; for (const z of [OD_Z, COL_Z]) mm.fillRect(0, sz(z - ROAD_HW), W, sz(z + ROAD_HW) - sz(z - ROAD_HW));
  for (const x of CROSS) mm.fillRect(sx(x - CROSS_HW), sz(OD_Z), sx(x + CROSS_HW) - sx(x - CROSS_HW), sz(COL_Z) - sz(OD_Z));
  mm.fillStyle = '#ff4fa8'; for (const r of ramps) mm.fillRect(sx(r.cx) - 3, sz(r.cz) - 3, 6, 6);
  mm.fillStyle = '#ffd166'; for (const s of starPts) if (!s.got) { mm.beginPath(); mm.arc(sx(s.x), sz(s.z), 2.5, 0, 7); mm.fill(); }
  for (const v of vehicles) if (v !== cur) { mm.fillStyle = v.kind === 'owned' ? '#24e7ff' : '#9a90a8'; mm.fillRect(sx(v.s.x) - 3, sz(v.s.z) - 3, 6, 6); }
  mm.fillStyle = '#111'; mm.font = 'bold 18px sans-serif'; mm.textAlign = 'center'; mm.textBaseline = 'middle';
  mm.beginPath(); mm.arc(sx(GARAGE.x), sz(GARAGE.z) + 8, 10, 0, 7); mm.fillStyle = '#ffd166'; mm.fill(); mm.fillStyle = '#111'; mm.fillText('G', sx(GARAGE.x), sz(GARAGE.z) + 9);
  if (S.mode === 'play' && M.stage !== 'expired') { mm.fillStyle = M.stage === 'pickup' ? '#ffd166' : '#7cff6b'; mm.beginPath(); mm.arc(sx(M.target.x), sz(M.target.z), 7, 0, 7); mm.fill(); mm.strokeStyle = '#000'; mm.lineWidth = 2; mm.stroke(); }
  const b = body(); mm.save(); mm.translate(sx(b.x), sz(b.z)); mm.rotate(-b.h + Math.PI);
  mm.fillStyle = cur ? '#fff' : '#ff4fa8'; mm.strokeStyle = '#000'; mm.lineWidth = 2; mm.beginPath(); mm.moveTo(0, 9); mm.lineTo(6, -6); mm.lineTo(-6, -6); mm.closePath(); mm.fill(); mm.stroke(); mm.restore();
}

// ======================= GPU harness =======================
const gl = renderer.getContext();
(() => {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), v = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  $('gRenderer').textContent = r; $('gRenderer').title = `${v} — ${r}`; $('gApi').textContent = renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1';
  window.__gpu = { vendor: v, renderer: r, webgl2: renderer.capabilities.isWebGL2, maxTexture: renderer.capabilities.maxTextureSize, nvidia: /nvidia|geforce|rtx|quadro/i.test(r) };
  if (window.__gpu.nvidia) $('gRenderer').style.color = '#76b900';
})();
const tq = renderer.capabilities.isWebGL2 ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
const pendingQ = []; let gpuMs = null;
function gpuBegin() { if (!tq || pendingQ.length > 4) return null; const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); return q; }
function gpuEnd(q) { if (q) { gl.endQuery(tq.TIME_ELAPSED_EXT); pendingQ.push(q); } }
function gpuPoll() { while (pendingQ.length) { const q = pendingQ[0]; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
  if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q); pendingQ.shift(); } }
const graph = $('gGraph').getContext('2d'), hist = [];
let fAcc = 0, fN = 0, info = { calls: 0, tris: 0 };
function harnessUI(ms) {
  hist.push(ms); if (hist.length > 160) hist.shift(); fAcc += ms; fN++;
  if (fAcc > 300) {
    const avg = fAcc / fN; $('gFps').textContent = `${(1000 / avg).toFixed(0)} fps · ${avg.toFixed(1)} ms`;
    $('gGpu').textContent = gpuMs != null ? `${gpuMs.toFixed(2)} ms` : 'n/a (no timer ext)';
    $('gCalls').textContent = info.calls; $('gTris').textContent = info.tris.toLocaleString();
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); $('gRes').textContent = `${sz.x}×${sz.y} · ${quality}`; fAcc = fN = 0;
  }
  const W = 320, H = 38; graph.clearRect(0, 0, W, H);
  graph.strokeStyle = 'rgba(255,255,255,.25)'; graph.beginPath(); graph.moveTo(0, H - 16.7 / 50 * H); graph.lineTo(W, H - 16.7 / 50 * H); graph.stroke();
  graph.strokeStyle = '#7cf5c8'; graph.beginPath(); hist.forEach((v, i) => { const y = H - Math.min(v, 50) / 50 * H; i ? graph.lineTo(i * 2, y) : graph.moveTo(0, y); }); graph.stroke();
}
$('gpuToggle').onclick = () => { $('gpu').classList.toggle('collapsed'); $('gpuToggle').textContent = $('gpu').classList.contains('collapsed') ? '+' : '–'; };
let bench = null, benchReport = null;
function startBenchmark(sec = 30) {
  if (S.mode === 'play') save();
  for (const v of [...vehicles]) removeVehicle(v);
  cur = createVehicle('convertible', SV.color, -300, -3.5, -Math.PI / 2, 'owned'); applyCosmetics(cur); hero.group.visible = false;
  S.wp = 0; S.mode = 'bench'; S.cam = 0; clearOffer(false);
  bench = { t0: performance.now(), dur: sec * 1000, frames: [], gpu: [], calls: 0, tris: 0, tod0: S.tod };
  $('menu').classList.add('hidden'); $('benchBtn').disabled = true; $('benchBtn').textContent = 'Midiendo…'; toast('GPU BENCHMARK', '#7cf5c8');
}
function finishBenchmark() {
  const f = bench.frames.slice(Math.min(15, bench.frames.length >> 2)).sort((a, b) => a - b), avg = f.reduce((a, b) => a + b, 0) / f.length, pct = p => f[Math.min(f.length - 1, Math.floor(f.length * p))];
  const low = f.slice(Math.floor(f.length * 0.99)), lowFps = 1000 / (low.reduce((a, b) => a + b, 0) / low.length);
  const g = bench.gpu.length ? bench.gpu.reduce((a, b) => a + b, 0) / bench.gpu.length : null, sz = renderer.getDrawingBufferSize(new THREE.Vector2());
  benchReport = { game: 'Miami Beach Drive', version: 2, date: new Date().toISOString(), preset: quality, resolution: `${sz.x}x${sz.y}`, gpu: window.__gpu, userAgent: navigator.userAgent,
    durationS: bench.dur / 1000, frames: f.length, avgFps: +(1000 / avg).toFixed(1), avgFrameMs: +avg.toFixed(2), p50Ms: +pct(0.5).toFixed(2), p95Ms: +pct(0.95).toFixed(2),
    p99Ms: +pct(0.99).toFixed(2), onePercentLowFps: +lowFps.toFixed(1), avgGpuMs: g != null ? +g.toFixed(2) : null,
    avgDrawCalls: Math.round(bench.calls / bench.frames.length), avgTriangles: Math.round(bench.tris / bench.frames.length),
    scenario: 'autopilot loop with traffic and pedestrians; time of day sweeps afternoon → night' };
  benchReport.grade = benchReport.avgFps >= 144 ? 'S' : benchReport.avgFps >= 90 ? 'A' : benchReport.avgFps >= 60 ? 'B' : benchReport.avgFps >= 30 ? 'C' : 'D';
  window.__bench = benchReport; console.log('BENCH', JSON.stringify(benchReport));
  S.tod = bench.tod0; $('tod').value = S.tod; bench = null; S.mode = 'attract'; startAttract();
  $('benchBtn').disabled = false; $('benchBtn').textContent = 'Benchmark (30 s)'; $('dlBtn').disabled = false;
  $('menu').classList.remove('hidden'); $('menuTitle').innerHTML = `Nota ${benchReport.grade}<br><small style="font-size:.45em">${benchReport.avgFps} fps</small>`;
  $('menuText').textContent = `Preset ${quality} · ${benchReport.resolution} · ${window.__gpu.renderer}`; $('playBtn').textContent = '¡Vamos!'; renderMenu();
  const r = $('benchResult'); r.hidden = false;
  r.textContent = `avg       ${benchReport.avgFps} fps (${benchReport.avgFrameMs} ms)\n1% low    ${benchReport.onePercentLowFps} fps\np50/95/99 ${benchReport.p50Ms} / ${benchReport.p95Ms} / ${benchReport.p99Ms} ms\nGPU time  ${g != null ? benchReport.avgGpuMs + ' ms' : 'n/a (timer query ext missing)'}\ndraws ${benchReport.avgDrawCalls} · tris ${benchReport.avgTriangles.toLocaleString()}`;
}
$('benchBtn').onclick = () => startBenchmark(); $('menuBench').onclick = () => startBenchmark();
$('dlBtn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(benchReport, null, 2)], { type: 'application/json' })); a.download = `miami-beach-drive-bench-${quality}.json`; a.click(); };

// ======================= Main loop =======================
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
addEventListener('beforeunload', () => { if (saveDirty) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveDirty) save(); });
applyQuality(quality); placeStars(); startAttract(); newMission(); renderMenu();
$('tod').value = S.tod; renderer.info.autoReset = false;
Ads.init();
const clock = new THREE.Clock(); let last = performance.now(), hudT = 0, clockT = 0;
function frame() {
  const now = performance.now(), ms = now - last; last = now;
  const dt = Math.min(clock.getDelta(), 1 / 20), t = clock.elapsedTime; clockT = t;
  if (S.todAuto && S.mode === 'play') { S.tod = (S.tod + dt / 240) % 1; $('tod').value = S.tod; }
  if (bench) S.tod = lerp(0.15, 0.95, Math.min(1, (now - bench.t0) / bench.dur));
  applyTimeOfDay(S.tod);
  let speed = 0;
  const active = S.mode === 'play' || S.mode === 'attract' || S.mode === 'bench';
  if (active) {
    const inp = S.mode === 'play' ? readInput() : null;
    if (inp?.act) interact();
    for (const v of [...vehicles]) {
      const vin = v === cur ? (S.mode === 'play' ? inp : autopilot(v.s)) : { steer: 0, gas: 0, brake: 0.3, hand: 0 };
      const r = updateVehicle(v, dt, vin, t);
      v.s.wheelSpin += r.fwd * dt; syncVehicle(v);
      if (v === cur) {
        speed = r.speed;
        if (S.mode === 'play') {
          if (!v.s.air && Math.abs(r.lat) > 3.5 && r.speed > 10 && v.type !== 'jetski') { P.drift += Math.abs(r.lat) * dt * 6; P.driftT = 0.5; }
          else if (P.driftT > 0 && (P.driftT -= dt) <= 0 && P.drift > 5) {
            const pts = Math.round(P.drift), cash = Math.round(pts / 4); SV.cash += cash; markDirty(); toast(`Derrape +$${cash}`, '#24e7ff'); blip(660, 0.15, 'triangle', 0.12, 1.5);
            if (pts >= 300) unlock('derrape'); SV.stats.bestDrift = Math.max(SV.stats.bestDrift, pts); P.drift = 0;
          }
          if (r.landed > 0.6) {
            const bonus = Math.round(r.landed * 15); SV.cash += bonus; markDirty(); toast(`¡Salto ${r.landed.toFixed(1)} s! +$${bonus}`, '#ff4fa8');
            if (M.stage === 'deliver') M.airBonus += 5; if (r.landed > 2) unlock('volador'); SV.stats.bestJump = Math.max(SV.stats.bestJump, +r.landed.toFixed(2));
          }
        }
      }
    }
    $('combo').style.opacity = P.drift > 5 ? 1 : 0; if (P.drift > 5) $('combo').textContent = `DERRAPE ${Math.round(P.drift)}`;
    if (!cur && inp) speed = updateFoot(dt, inp, t);
    updateTraffic(dt); updatePeds(dt, t); updateBalls(dt); updateStars(t); updateMission(dt, speed, t);
    if (ac) {
      const on = S.mode === 'play' && !!cur;
      engOsc.frequency.setTargetAtTime(45 + speed * 4.2 + (inp?.gas ? 15 : 0), ac.currentTime, 0.05); engFilter.frequency.setTargetAtTime(400 + speed * 40, ac.currentTime, 0.05);
      engGain.gain.setTargetAtTime(on ? 0.05 + (inp?.gas || 0) * 0.03 : 0, ac.currentTime, 0.1); hornGain.gain.setTargetAtTime(on && inp?.horn ? 0.12 : 0, ac.currentTime, 0.02);
    }
    if (cur && inp?.horn) trafficCars.forEach(c => { if (Math.hypot(c.position.x - cur.s.x, c.position.z - cur.s.z) < 25) c.userData.speed *= 0.97; });
    updateCamera(dt, speed, t);
    // context prompt
    if (S.mode === 'play') {
      const it = interactTarget(), pr = $('prompt');
      if (cur) { pr.innerHTML = Math.hypot(cur.s.vx, cur.s.vz) < 9 ? '<kbd>F</kbd> Bajarse' : ''; }
      else pr.innerHTML = it ? `<kbd>F</kbd> ${it.label}` : '';
      pr.classList.toggle('hidden', !pr.innerHTML || (cur && speed > 2));
    } else $('prompt').classList.add('hidden');
  }
  Object.assign(prevKeys, keys);
  // offers
  if (offer) { const left = offer.until - t; $('offerBar').style.width = `${clamp(left / offer.dur, 0, 1) * 100}%`; if (left <= 0 && S.mode === 'play') clearOffer(true); }
  // world-follow items
  const b = body();
  sun.position.set(b.x + sunDir.x * 200, sunDir.y * 200, b.z + sunDir.z * 200); sun.target.position.set(b.x, 0, b.z);
  moonMesh.position.set(camera.position.x + 500, 600, camera.position.z - 1100);
  oceanU.uTime.value = t; sky.position.copy(camera.position); nightStars.position.copy(camera.position);
  garageRing.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
  if (cur) { const s = cur.s, hz = cur.model.headZ, fx = -Math.sin(s.h), fz = -Math.cos(s.h); headlight.position.set(s.x - fx * hz, s.y + 1, s.z - fz * hz); headlight.target.position.set(s.x + fx * 20, 0, s.z + fz * 20); headlight.intensity = 160 * night; }
  else headlight.intensity = 0;
  if (night > 0.01) lampPos.map(p => [p, (p.x - b.x) ** 2 + (p.z - b.z) ** 2]).sort((a, c) => a[1] - c[1]).slice(0, lampLights.length).forEach(([p], i) => { lampLights[i].position.set(p.x, 5.8, p.z); lampLights[i].intensity = 60 * night; });
  else lampLights.forEach(l => l.intensity = 0);
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  if ((hudT += dt) > 0.1) {
    hudT = 0; $('cash').textContent = fmt(SV.cash); $('speed').textContent = Math.round(speed * 3.6); $('speedLabel').textContent = cur ? 'Velocidad' : (foot.swim ? 'Nadando' : 'A pie');
    $('stars').textContent = `${P.stars}/${STAR_N}`; drawMinimap(); $('mission').style.display = S.mode === 'play' ? '' : 'none';
  }
  if (S.mode === 'play' && saveDirty && (saveT += dt) > 5) { saveT = 0; save(); }
  renderer.info.reset();
  const q = gpuBegin(); composer.render(); gpuEnd(q); if (tq) gpuPoll();
  info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  if (S.photo) { S.photo = false; renderer.domElement.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `miami-beach-${Date.now()}.png`; a.click(); }); toast('📸 ¡Foto guardada!', '#fff', 1); }
  harnessUI(ms);
  if (bench) { bench.frames.push(ms); bench.calls += info.calls; bench.tris += info.tris; if (gpuMs != null) bench.gpu.push(gpuMs); if (now - bench.t0 > bench.dur) finishBenchmark(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('bench')) startBenchmark(+params.get('bench') || 30);
// Debug / test hooks
window.__game = { S, P, SV, M, foot, vehicles, trafficCars, peds, get cur() { return cur; }, interact, summon, openShop, closeShop, acceptOffer, Ads, save };

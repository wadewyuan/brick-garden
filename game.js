/* Brick Garden · scene, building, celebrations and screens. Missions live in models.js. */
import * as THREE from './vendor/three/three.module.min.js';      // Three.js 0.170.0, kept in the project so nothing loads from a CDN
import { RoundedBoxGeometry } from './vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from './vendor/three/addons/environments/RoomEnvironment.js';
import { sfx } from './audio.js';

const { COLORS, WORLDS, MISSIONS, PLATE, tall } = window.BRICKS;
const FREE = 24;                    // studs along each side of the free-build plate
const H = 1.2;                      // brick height in stud widths, as on real bricks: 9.6 mm tall on an 8 mm stud grid
let SIZE = PLATE, HALF = SIZE / 2;  // the plate in use: 8×8 for missions, 24×24 for free build
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const rand = a => a[Math.floor(Math.random() * a.length)];
const clampI = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// —— saved progress ——
const KEY = 'brick-garden.v1';
const save = { done: [], bricks: [], free: [], voice: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { }
{ // older saves: painted windows and doors became real bricks, and free build moved to the big plate
  const frame = { 2: 7, 3: 9 };
  save.bricks = [...new Set(save.bricks.map(k => { const p = k.split(','); return frame[p[3]] && !+p[4] ? [p[0], p[1], p[2], 0, frame[p[3]]].join() : k; }))];
  const shift = save.plate === FREE ? 0 : (FREE - PLATE) / 2;
  const tex = e => save.v === 2 ? ([1, 2, 3, 4].includes(e) || /^#[0-9a-zA-Z]$/.test(e) ? e : 0) : e === 1 ? 1 : 0;     // before v2 only eyes existed
  save.free = (save.free || []).map(b => [b[0], b[1], b[2] + shift, b[3], b[4] + shift, b[5], tex(b[6]), b[7] || 0, b[8] ?? (tex(b[6]) && tex(b[6]) !== 1 && b[0] < b[1] ? 1 : 0)]);
  save.v = 2;
  save.plate = FREE;
}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { } };

// —— voice ——
function say(text) {
  if (!save.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = .85; u.pitch = 1.15;
    speechSynthesis.speak(u);
  } catch { }
}

// —— renderer and scene ——
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, .1, 200);
const env = (() => { const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); return t; })();
scene.environment = env; scene.environmentIntensity = .45;

function addLights(s, shadows) {
  s.add(new THREE.HemisphereLight('#ffffff', '#b8c8a0', 1.1));
  const sun = new THREE.DirectionalLight('#fff6e6', 2.2); sun.position.set(6, 14, 9);
  if (shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  }
  s.add(sun);
  return sun;
}
const sun = addLights(scene, true);

// —— bricks ——
// A brick's form: 0 block, 1..4 slope (running down toward +x, +z, -x, -z), 5 wheels on an axle, 6 round,
// 7/8 window frame (two layers tall), 9/10 door frame (three layers tall), 11/12 arch (two layers tall);
// 8, 10 and 12 are turned a quarter. 13 cone, 14 pointed roof, 15 tall block (two layers).
// A brick's texture (the `deco` slot), on two opposite sides that turn with the brick: 1 eyes, 2 wall, 3 waves, 4 grass,
// or one character written as '#A'. Patterns and characters are free-build only, on plain and tall blocks.
// real brick sizes, in stud pitches (8 mm): studs are 0.6 wide and 0.2125 tall; a brick's body stops 0.0125 short of each grid line
const SH = .2125, GAP = .025;
const STUD = new THREE.CylinderGeometry(.3, .3, SH, 20);
const geoCache = {}, matCache = {}, edgeCache = {};
const flat = parts => mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
const isSlope = s => s >= 1 && s <= 4;
const formOf = s => isSlope(s) ? 1 : s === 8 ? 7 : s === 10 ? 9 : s === 12 ? 11 : (s || 0);      // the kind of brick, whichever way it is turned
const isFrame = s => formOf(s) === 7 || formOf(s) === 9;
const faces = s => isFrame(s) || formOf(s) === 11;      // bricks with two ways to face: windows, doors, arches
const POST = .3, LINTEL = .26, sillOf = s => formOf(s) === 7 ? .2 : .08;
// a ramp `run` studs long that goes down toward +x; with room for it, the high end keeps one row of studs
function slopeGeo(run, width) {
  const a = run / 2 - GAP / 2, top = run >= 2 ? 1 - run / 2 : .14 - run / 2;
  const side = new THREE.Shape([[-a, 0], [a, 0], [a, .16], [top, H], [-a, H]].map(p => new THREE.Vector2(...p)));
  const parts = [new THREE.ExtrudeGeometry(side, { depth: width - GAP, bevelEnabled: false }).translate(0, 0, -(width - GAP) / 2)];
  if (run >= 2) for (let k = 0; k < width; k++) parts.push(STUD.clone().translate(.5 - run / 2, H + SH / 2, k + .5 - width / 2));
  return flat(parts);
}
function blockGeo(w, d, h = H) {
  const parts = [new RoundedBoxGeometry(w - GAP, h, d - GAP, 3, .07).translate(0, h / 2, 0)];
  for (let i = 0; i < w; i++) for (let k = 0; k < d; k++) parts.push(STUD.clone().translate(i + .5 - w / 2, h + SH / 2, k + .5 - d / 2));
  return flat(parts);
}
function roundGeo(w) {
  const parts = [new THREE.CylinderGeometry(w / 2 - GAP / 2, w / 2 - GAP / 2, H, 28).translate(0, H / 2, 0)];
  const pull = w > 1 ? .78 : 1;       // studs sit a little closer together, inside the round edge
  for (let i = 0; i < w; i++) for (let k = 0; k < w; k++) parts.push(STUD.clone().translate((i + .5 - w / 2) * pull, H + SH / 2, (k + .5 - w / 2) * pull));
  return flat(parts);
}
// a frame you look through along z: two posts, a sill and a lintel with studs on top
function frameGeo(w, d, form) {
  const T = tall(form) * H, sill = sillOf(form);
  const box = (bw, bh, x, y) => new RoundedBoxGeometry(bw, bh, d - GAP, 2, .05).translate(x, y, 0);
  const parts = [box(POST, T, -(w - GAP - POST) / 2, T / 2), box(POST, T, (w - GAP - POST) / 2, T / 2),
    box(w - GAP, LINTEL, 0, T - LINTEL / 2), box(w - GAP, sill, 0, sill / 2)];
  for (let i = 0; i < w; i++) for (let k = 0; k < d; k++) parts.push(STUD.clone().translate(i + .5 - w / 2, T + SH / 2, k + .5 - d / 2));
  return flat(parts);
}
// the raised block between two wheels, on an axle; the wheels stand taller and wider than its ends
const WHEEL = .75, AXLE = .6;
function axleGeo(w, d) {
  const long = Math.max(w, d), bw = w >= d ? Math.max(1, w - 2) : w, bd = w >= d ? d : Math.max(1, d - 2);
  const parts = [new RoundedBoxGeometry(bw - GAP, H - AXLE, bd - GAP, 3, .07).translate(0, (H + AXLE) / 2, 0)];
  const rod = new THREE.CylinderGeometry(.14, .14, long - .6, 12); w >= d ? rod.rotateZ(Math.PI / 2) : rod.rotateX(Math.PI / 2);
  parts.push(rod.translate(0, WHEEL, 0));
  for (let i = 0; i < bw; i++) for (let k = 0; k < bd; k++) parts.push(STUD.clone().translate(i + .5 - bw / 2, H + SH / 2, k + .5 - bd / 2));
  return flat(parts);
}
// an arch spanning `w` studs along x: two legs, a round opening underneath, studs on top
function archGeo(w, d) {
  const T = 2 * H, W = w / 2 - GAP / 2, a = Math.max(.3, w / 2 - .85), foot = .2, ry = T - .42 - foot, pts = [[-W, 0], [-a, 0]];
  for (let i = 0; i <= 20; i++) { const t = Math.PI * (1 - i / 20); pts.push([a * Math.cos(t), foot + ry * Math.sin(t)]); }
  pts.push([a, 0], [W, 0], [W, T], [-W, T]);
  const parts = [new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(...p))), { depth: d - GAP, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -(d - GAP) / 2)];
  for (let i = 0; i < w; i++) for (let k = 0; k < d; k++) parts.push(STUD.clone().translate(i + .5 - w / 2, T + SH / 2, k + .5 - d / 2));
  return flat(parts);
}
// bricks that end in a point: a round cone, or a roof with four sides. They stand a little taller than their layer.
const pointH = w => w > 1 ? H * 1.4 : H * 1.1;
const coneGeo = w => new THREE.CylinderGeometry(.09 * w, w / 2 - .04, pointH(w), 28).translate(0, pointH(w) / 2, 0);
const roofGeo = w => new THREE.ConeGeometry((w / 2 - GAP / 2) * Math.SQRT2, pointH(w), 4).rotateY(Math.PI / 4).translate(0, pointH(w) / 2, 0);
function brickGeo(w, d, form = 0) {
  return geoCache[w + 'x' + d + 's' + form] ||= (() => {
    if (form === 15) return blockGeo(w, d, 2 * H);
    if (form === 13) return flat([coneGeo(Math.min(w, d))]);
    if (form === 14) return flat([roofGeo(Math.min(w, d))]);
    if (formOf(form) === 11) return form === 11 ? archGeo(w, d) : archGeo(d, w).rotateY(Math.PI / 2);
    if (isFrame(form)) return form === formOf(form) ? frameGeo(w, d, form) : frameGeo(d, w, form).rotateY(Math.PI / 2);
    if (isSlope(form)) { const dir = form - 1, odd = dir % 2; return slopeGeo(odd ? d : w, odd ? w : d).rotateY(-dir * Math.PI / 2); }
    if (form === 5) return axleGeo(w, d);
    if (form === 6) return roundGeo(Math.min(w, d));
    return blockGeo(w, d);
  })();
}
const edgeGeo = (w, d, n = 1) => edgeCache[w + 'x' + d + 'x' + n] ||= new THREE.EdgesGeometry(new THREE.BoxGeometry(w, n * H, d).translate(0, n * H / 2, 0));
const brickMat = c => matCache[c] ||= new THREE.MeshPhysicalMaterial({ color: COLORS[c], roughness: .38, clearcoat: .6, clearcoatRoughness: .3,
  ...(c === 'clear' ? { transparent: true, opacity: .5, roughness: .08 } : c === 'glow' ? { emissive: '#ffe23a', emissiveIntensity: .9 } : {}) });
const plain = (color, roughness = .5) => new THREE.MeshStandardMaterial({ color, roughness });
const eyeGeo = new THREE.SphereGeometry(.2, 16, 12), eyeMat = plain('#1d1d25', .2);
const whiteGeo = new THREE.SphereGeometry(.26, 16, 12), whiteMat = plain('#ffffff', .4);
const glintGeo = new THREE.SphereGeometry(.065, 8, 8), glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const UNIT = new THREE.BoxGeometry(1, 1, 1), doorMat = plain('#b07a45'), knobMat = plain('#ffd21f', .3);
const glassMat = new THREE.MeshStandardMaterial({ color: '#9fdcff', roughness: .1, transparent: true, opacity: .45, depthWrite: false });
const tireGeo = new THREE.CylinderGeometry(WHEEL, WHEEL, .5, 32).rotateX(Math.PI / 2), tireMat = plain('#25252c', .7);
const hubGeo = new THREE.CylinderGeometry(.4, .4, .56, 20).rotateX(Math.PI / 2), hubMat = plain('#8f99a6', .4);
const boltGeo = new THREE.CylinderGeometry(.08, .08, .6, 8).rotateX(Math.PI / 2);

// —— textures: drawn once per ink color on a small canvas, then laid over a brick's sides ——
// The ink is the brick's own color made darker or lighter, whichever stands out more against it.
const lumOf = c => .2126 * c.r + .7152 * c.g + .0722 * c.b;       // THREE.Color keeps linear values, as contrast math wants
const inks = {};
function inkOf(color) {
  return inks[color] ||= (() => {
    const base = new THREE.Color(COLORS[color]), dark = base.clone().lerp(new THREE.Color('#000000'), .62), light = base.clone().lerp(new THREE.Color('#ffffff'), .8);
    const ratio = o => { const a = lumOf(base) + .05, b = lumOf(o) + .05; return Math.max(a, b) / Math.min(a, b); };
    return '#' + (ratio(dark) >= ratio(light) ? dark : light).getHexString();
  })();
}
const texCache = {}, texMats = {}, faceGeos = {};
function texOf(kind, ink) {
  return texCache[kind + ink] ||= (() => {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); g.strokeStyle = g.fillStyle = ink; g.lineCap = g.lineJoin = 'round';
    if (kind === 2) {              // wall: three rows of little bricks, every other row shifted
      g.lineWidth = 12; g.beginPath();
      for (const y of [0, S / 3, S * 2 / 3, S]) { g.moveTo(0, y); g.lineTo(S, y); }
      for (const [x, r] of [[S / 2, 0], [0, 1], [S, 1], [S / 2, 2]]) { g.moveTo(x, r * S / 3); g.lineTo(x, (r + 1) * S / 3); }
      g.stroke();
    } else if (kind === 3) {       // waves: two wavy lines
      g.lineWidth = 16;
      for (const y0 of [72, 184]) { g.beginPath(); for (let x = -8; x <= S + 8; x += 8) g.lineTo(x, y0 + Math.sin(x / S * Math.PI * 2) * 26); g.stroke(); }
    } else if (kind === 4) {       // grass: blades growing from the bottom edge
      const tips = [150, 96, 168, 70, 140, 110, 176, 88];
      g.beginPath(); g.moveTo(0, S);
      tips.forEach((y, i) => { const x0 = i * S / 8; g.lineTo(x0 + S / 32, y + (i % 2 ? 0 : 12)); g.lineTo(x0 + S / 16, y); g.lineTo(x0 + S / 8, S - 40); });
      g.lineTo(S, S); g.closePath(); g.fill();
    } else {                       // one bold character
      g.font = `900 ${S * .82}px ui-rounded, "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const ch = kind[1], mt = g.measureText(ch), top = mt.actualBoundingBoxAscent, low = mt.actualBoundingBoxDescent;
      g.fillText(ch, S / 2, S / 2 + (top - low) / 2);       // centered on the ink, so "g" and "T" both sit in the middle
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  })();
}
const texMat = (kind, ink) => texMats[kind + ink] ||= new THREE.MeshStandardMaterial({ map: texOf(kind, ink), transparent: true, roughness: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
// a flat sheet for one side of a brick; the picture repeats `u` times across and `v` times up
function faceGeo(fw, fh, u, v) {
  return faceGeos[[fw, fh, u, v]] ||= (() => {
    const g = new THREE.PlaneGeometry(fw, fh), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    return g;
  })();
}
const canTex = s => !s || s === 15;      // plain blocks and tall blocks have flat sides to draw on
function addTexture(m, w, d, color, deco, layers, face) {
  const mat = texMat(deco, inkOf(color)), h = layers * H, char = typeof deco === 'string';
  // textures go on two opposite sides: front and back, or left and right once the brick is turned (`face` 1)
  for (const [len, off, turn] of face ? [[d, w / 2, Math.PI / 2], [d, w / 2, -Math.PI / 2]] : [[w, d / 2, 0], [w, d / 2, Math.PI]]) {
    const side = char ? Math.min(len, h) - .14 : 0;
    const geo = char ? faceGeo(side, side, 1, 1) : deco === 4 ? faceGeo(len - .1, H - .1, len, 1) : faceGeo(len - .1, h - .1, len, layers);
    const o = new THREE.Mesh(geo, mat);
    o.position.y = char ? h / 2 : deco === 4 ? H / 2 : h / 2;
    o.rotation.y = turn; o.translateZ(off - GAP / 2 + .004); m.add(o);
  }
}

// `face`: which pair of sides carries the texture, 0 front and back, 1 left and right; left out, a pattern takes the long sides
function makeBrick(w, d, color, deco, form, face) {
  const m = new THREE.Mesh(brickGeo(w, d, form), brickMat(color));
  m.castShadow = m.receiveShadow = true;
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); m.add(o); return o; };
  if (deco && deco !== 1 && canTex(form)) addTexture(m, w, d, color, deco, tall(form), face ?? (w >= d ? 0 : 1));
  if (deco === 1) {
    const eyes = new THREE.Group(), half = (face ? w : d) / 2; if (face) eyes.rotation.y = Math.PI / 2; m.add(eyes);
    const put = (geo, mat, x, y, z, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.z = sz; eyes.add(o); };
    for (const s of [1, -1]) {
      put(whiteGeo, whiteMat, .06, H * .55, s * (half - .06), .3);
      put(eyeGeo, eyeMat, .08, H * .55, s * (half - .03), .45);
      put(glintGeo, glintMat, .15, H * .55 + .08, s * (half + .05));
    }
  }
  if (isFrame(form)) {      // what fills the frame: glass with a white cross, or a door on a hinge
    const g = new THREE.Group(), turn = form !== formOf(form), fw = turn ? d : w, fd = turn ? w : d;
    g.rotation.y = (turn ? Math.PI / 2 : 0) + (face && formOf(form) === 9 ? Math.PI : 0);       // a door has a front: `face` 1 turns it right round
    m.add(g);
    const T = tall(form) * H, sill = sillOf(form), ow = fw - 2 * POST, oh = T - LINTEL - sill + .04, mid = sill + oh / 2 - .02;
    const part = (to, geo, mat, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); to.add(o); return o; };
    if (formOf(form) === 7) {
      part(g, UNIT, glassMat, 0, mid, 0, ow, oh, .06);
      part(g, UNIT, whiteMat, 0, mid, 0, .09, oh, .12); part(g, UNIT, whiteMat, 0, mid, 0, ow, .09, .12);
    } else {
      const hinge = new THREE.Group(), z = fd / 2 - .2; hinge.position.set(-ow / 2, 0, z); hinge.userData.door = true; g.add(hinge);
      part(hinge, UNIT, doorMat, ow / 2, mid, 0, ow - .06, oh - .06, .14).castShadow = true;
      part(hinge, UNIT, glassMat, ow / 2, sill + oh * .72, 0, ow * .5, oh * .26, .17);
      for (const s of [1, -1]) part(hinge, glintGeo, knobMat, ow - .28, sill + oh * .42, s * .1, 1.6, 1.6, 1.6);
    }
  }
  if (form === 5) for (const s of [1, -1]) {       // a wheel at each end of the long side
    const wheel = new THREE.Group(), end = Math.max(w, d) / 2 - .5;
    for (const [g, mt, x] of [[tireGeo, tireMat, 0], [hubGeo, hubMat, 0], [boltGeo, whiteMat, .22]]) { const o = new THREE.Mesh(g, mt); o.position.x = x; o.castShadow = true; wheel.add(o); }
    if (w >= d) { wheel.rotation.y = Math.PI / 2; wheel.position.set(s * end, WHEEL, 0); }
    else { wheel.position.set(0, WHEEL, s * end); wheel.userData.wheel = true; }
    m.add(wheel);
  }
  return m;
}
const meshOf = b => makeBrick(b[0], b[1], b[5], b[6], b[7], b[8]);
// world position of a brick's bottom centre
const brickPos = ([w, d, x, y, z]) => new THREE.Vector3(x + w / 2 - HALF, y * H, z + d / 2 - HALF);
// centre of a model's footprint: the pivot it sways, spins and waddles around
function pivotOf(bricks) {
  let x0 = 99, x1 = -99, z0 = 99, z1 = -99;
  for (const [w, d, x, , z] of bricks) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + w); z0 = Math.min(z0, z); z1 = Math.max(z1, z + d); }
  return new THREE.Vector3((x0 + x1) / 2 - HALF, 0, (z0 + z1) / 2 - HALF);
}
const topOf = b => tall(b[7]) * H;      // how high a brick stands above its own base
const heightOf = bricks => Math.max(...bricks.map(b => b[3] + tall(b[7]))) * H;

// —— table and plate ——
let plateMesh, studMesh;
const table = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, .4, 64), new THREE.MeshStandardMaterial({ color: '#fff1d0', roughness: .9 }));
table.position.y = -.5; table.receiveShadow = true; scene.add(table);
const plateMat = new THREE.MeshPhysicalMaterial({ color: '#6fbdf0', roughness: .45, clearcoat: .4 });
function setPlate(n) {
  if (plateMesh && n === SIZE) return;
  if (plateMesh) { scene.remove(plateMesh, studMesh); plateMesh.geometry.dispose(); studMesh.dispose(); }
  SIZE = n; HALF = n / 2;
  plateMesh = new THREE.Mesh(new RoundedBoxGeometry(n + .5, .3, n + .5, 3, .1), plateMat);
  plateMesh.position.y = -.15; plateMesh.receiveShadow = true; scene.add(plateMesh);
  studMesh = new THREE.InstancedMesh(STUD, plateMat, n * n); studMesh.receiveShadow = true;
  const mx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) studMesh.setMatrixAt(i * n + k, mx.makeTranslation(i + .5 - HALF, SH / 2, k + .5 - HALF));
  scene.add(studMesh);
  const big = n > PLATE, r = big ? n * .8 : 9;       // the table and the sun's shadow grow with the plate
  table.scale.set(n / PLATE, 1, n / PLATE);
  sun.position.set(6, 14, 9).multiplyScalar(big ? 2.2 : 1);
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, far: big ? 90 : 40 });
  sun.shadow.normalBias = big ? .06 : .03; sun.shadow.camera.updateProjectionMatrix();
  resize();
}

// —— glowing spot for the next brick ——
const ghost = new THREE.Group(); ghost.visible = false; scene.add(ghost);
const ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .5, depthWrite: false });
const ghostBody = new THREE.Mesh(STUD, ghostMat); ghost.add(ghostBody);
// the outline ignores depth, so a spot behind other bricks still shows
const ghostEdge = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true }));
ghostEdge.renderOrder = 9; ghost.add(ghostEdge);
const arrow = new THREE.Mesh(new THREE.ConeGeometry(.42, .8, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffc400', depthTest: false, transparent: true }));
arrow.renderOrder = 10; ghost.add(arrow);

// —— glowing spots for mission bricks: one at a time, a whole layer, or a short hint ——
const spots = [];
const spotEdgeMat = new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true });
function makeSpot(i, b, ttl = Infinity) {
  const g = new THREE.Group(); g.position.copy(brickPos(b));
  const mat = new THREE.MeshBasicMaterial({ color: COLORS[b[5]], transparent: true, opacity: .5, depthWrite: false });
  g.add(new THREE.Mesh(brickGeo(b[0], b[1], b[7]), mat));
  const edge = new THREE.LineSegments(edgeGeo(b[0], b[1], tall(b[7])), spotEdgeMat); edge.renderOrder = 9; g.add(edge);
  const ar = new THREE.Mesh(arrow.geometry, arrow.material); ar.renderOrder = 10; g.add(ar);
  scene.add(g);
  const s = { i, b, g, mat, ar, key: keyOf(b), ttl }; spots.push(s); return s;
}
function dropSpot(k) { const [s] = spots.splice(k, 1); scene.remove(s.g); s.mat.dispose(); }
function clearSpots() { while (spots.length) dropSpot(0); }

// —— little flying bits: sparkles on each brick, confetti at the end ——
const BITS = 260, bits = [];
const bitMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.16, .16, .04), new THREE.MeshBasicMaterial(), BITS);
bitMesh.frustumCulled = false; bitMesh.count = 0; scene.add(bitMesh);
const PARTY = ['#e53935', '#ff8a1f', '#ffd21f', '#3fae49', '#2f8fe0', '#b45cf0', '#ffffff'].map(c => new THREE.Color(c));
function burst(at, n, { speed = 4, up = 4, gravity = 12, life = 1, spread = .3 } = {}) {
  for (let i = 0; i < n && bits.length < BITS; i++) {
    const a = Math.random() * 6.283, r = Math.random() * speed;
    bits.push({
      p: at.clone().add(new THREE.Vector3((Math.random() - .5) * spread, 0, (Math.random() - .5) * spread)),
      v: new THREE.Vector3(Math.cos(a) * r, up * (.4 + Math.random() * .8), Math.sin(a) * r),
      rot: Math.random() * 6, spin: (Math.random() - .5) * 14, g: gravity, life: life * (.7 + Math.random() * .6), c: rand(PARTY),
    });
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
function updateBits(dt) {
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i]; b.life -= dt; if (b.life <= 0) { bits.splice(i, 1); continue; }
    b.v.y -= b.g * dt; b.p.addScaledVector(b.v, dt); b.rot += b.spin * dt;
  }
  bits.forEach((b, i) => {
    _s.setScalar(Math.min(1, b.life * 3));
    bitMesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(_e.set(b.rot, b.rot * .7, b.rot * 1.3)), _s));
    bitMesh.setColorAt(i, b.c);
  });
  bitMesh.count = bits.length; bitMesh.instanceMatrix.needsUpdate = true;
  if (bitMesh.instanceColor) bitMesh.instanceColor.needsUpdate = true;
}

// —— tiny tween helper ——
const tweens = [];
const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.fn(k);
    if (k >= 1) { tweens.splice(i, 1); w.done?.(); }
  }
}

// —— camera: orbits the plate at a fixed tilt ——
const cam = { yaw: .45, yawTo: .45, tilt: .4, target: new THREE.Vector3(0, 1.5, 0), targetTo: new THREE.Vector3(0, 1.5, 0), dist: 30, zoom: 1, zoomTo: 1, home: .45 };
const camPosAt = (yaw, out = new THREE.Vector3()) =>
  out.set(Math.sin(yaw) * Math.cos(cam.tilt), Math.sin(cam.tilt), Math.cos(yaw) * Math.cos(cam.tilt)).multiplyScalar(cam.dist * cam.zoom).add(cam.target);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  cam.dist = (SIZE * .72 + 1.15) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect * .95);
}
addEventListener('resize', resize); setPlate(PLATE);

// —— pictures for cards and the tray, drawn with the same renderer ——
const thumbScene = new THREE.Scene(); thumbScene.environment = env; thumbScene.environmentIntensity = .45; addLights(thumbScene, false);
const thumbCam = new THREE.PerspectiveCamera(28, 1, .1, 100);
const thumbCv = document.createElement('canvas'), thumbCtx = thumbCv.getContext('2d');
function snap(bricks, px, radius) {
  const g = new THREE.Group();
  for (const b of bricks) { const m = meshOf(b); m.position.copy(brickPos(b)); g.add(m); }
  thumbScene.add(g);
  const sphere = new THREE.Box3().setFromObject(g).getBoundingSphere(new THREE.Sphere());
  const r = radius || sphere.radius;
  thumbCam.position.set(.42, .36, .8).normalize().multiplyScalar(r / Math.sin(THREE.MathUtils.degToRad(14)) * 1.04).add(sphere.center);
  thumbCam.lookAt(sphere.center);
  renderer.setPixelRatio(1); renderer.setSize(px, px, false);
  renderer.render(thumbScene, thumbCam);
  thumbCv.width = thumbCv.height = px; thumbCtx.drawImage(canvas, 0, 0);   // copy before the frame is presented
  thumbScene.remove(g); resize();
  return thumbCv.toDataURL();
}
const brickPics = {};
const brickPic = (w, d, c, e, s, f) => brickPics[[w, d, c, e || 0, s || 0, f]] ||= snap([[w, d, 0, 0, 0, c, e || 0, s || 0, f]], 200, Math.max(2.8, Math.hypot(w, d) / 2 + .4));
const picOf = o => brickPic(o.w, o.d, o.c, o.e, o.s);
// how an owned brick is remembered in the save: "w,d,color" plus eyes and slope when it has them
const brickKey = ([w, d, c, e, s]) => [w, d, c, ...(e || s ? [e || 0] : []), ...(s ? [s] : [])].join();
// bricks from every finished mission are owned, also ones added to a gift after it was opened
for (const m of MISSIONS) if (save.done.includes(m.id)) for (const g of m.gift || []) if (!save.bricks.includes(brickKey(g))) save.bricks.push(brickKey(g));
if (params.has('unlock')) { save.done = MISSIONS.map(m => m.id); save.bricks = [...new Set([...save.bricks, ...MISSIONS.flatMap(m => (m.gift || []).map(brickKey))])]; persist(); }   // index.html?unlock opens everything
const cardPics = [];      // drawn the first time a card is shown, so start-up stays quick
const cardPic = i => cardPics[i] ||= snap(MISSIONS[i].bricks, 320);
const freePic = snap([[4, 2, 0, 0, 0, 'red'], [2, 2, 0, 1, 0, 'yellow'], [2, 2, 2, 1, 0, 'green'], [2, 2, 1, 2, 0, 'orange'], [1, 1, 3, 2, 1, 'white']], 320);

// —— game state ——
let state = 'home';   // home | build | alive | free
let cur = null;       // { m, i, group, pivot, picked, busy, wrongs, opts, aliveT }
let lastAct = 0, clock = 0;

function show(which) {
  $('home').hidden = which !== 'home'; $('hud').hidden = which !== 'build'; $('win').hidden = which !== 'win';
  document.body.classList.toggle('free', state === 'free');
}

// —— home ——
const unlocked = i => i === 0 || save.done.includes(MISSIONS[i - 1].id);
function renderHome() {
  closeMenus();
  state = 'home'; show('home'); ghost.visible = false; clearSpots();
  if (cur) { scene.remove(cur.group); cur = null; }
  const nextUp = MISSIONS.findIndex((m, i) => unlocked(i) && !save.done.includes(m.id));
  if (!WORLDS.some(w => w.id === save.world)) save.world = WORLDS[0].id;
  const shake = el => { sfx.wrong(); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

  const tabs = $('worlds'); tabs.textContent = '';
  for (const w of WORLDS) {
    const mine = MISSIONS.filter(m => m.world === w.id), open = unlocked(MISSIONS.indexOf(mine[0]));
    const el = document.createElement('button');
    el.className = 'tab' + (w.id === save.world ? ' on' : '') + (open ? '' : ' locked');
    el.style.setProperty('--c', w.color);
    el.textContent = (mine.every(m => save.done.includes(m.id)) ? '★ ' : '') + w.word;
    el.onclick = () => {
      sfx.unlock();
      if (!open) return shake(el);
      sfx.pick(); say(w.word); save.world = w.id; persist(); renderHome();
    };
    tabs.append(el);
  }

  const box = $('cards'); box.textContent = '';
  MISSIONS.forEach((m, i) => {
    if (m.world !== save.world) return;
    const el = document.createElement('button'), open = unlocked(i);
    el.className = 'card' + (open ? '' : ' locked') + (i === nextUp ? ' next' : '');
    el.innerHTML = `<img alt="" src="${cardPic(i)}"><div class="w">${m.word}</div>` + (save.done.includes(m.id) ? '<div class="st">★</div>' : '');
    el.onclick = () => { sfx.unlock(); if (open) { sfx.pop(); startMission(m); } else shake(el); };
    box.append(el);
  });
  const el = document.createElement('button');
  el.className = 'card free';
  el.innerHTML = `<img alt="" src="${freePic}"><div class="w">build</div>`;
  el.onclick = () => { sfx.unlock(); sfx.pop(); startFree(); };
  box.append(el);
}
$('logo').innerHTML = [...'Brick Garden'].map(ch => ch === ' ' ? ' ' : `<span>${ch}</span>`).join('');

// —— building a mission ——
// mode 1 hands over the brick · 2 pick from three · 3 pick from five · 4 a whole layer glows · 5 copy the picture, no glow
const typeKey = (w, d, c, e, s) => [Math.min(w, d), Math.max(w, d), c, e || 0, formOf(s)].join();   // same brick, whichever way it is turned
const keyOf = b => typeKey(b[0], b[1], b[5], b[6], b[7]);
const optOf = b => ({ w: b[0], d: b[1], c: b[5], e: b[6] || 0, s: b[7] || 0, key: keyOf(b), ok: true });
const overlap = (a, b) => a[2] < b[2] + b[0] && a[2] + a[0] > b[2] && a[4] < b[4] + b[1] && a[4] + a[1] > b[4];

function startMission(m) {
  if (cur) scene.remove(cur.group);
  clearSpots(); showAim(undefined);
  const pivot = pivotOf(m.bricks), group = new THREE.Group();
  group.position.copy(pivot); scene.add(group);
  cur = { m, group, pivot, placed: new Set(), bricks: [], flying: 0, sel: null, wrongs: 0, misses: 0, opts: [], layer: -1, decoy: null, aliveT: 0 };
  state = 'build'; show('build');
  setPlate(PLATE); cam.tilt = .4;
  cam.zoom = cam.zoomTo = Math.max(1, (heightOf(m.bricks) + 4) / 7.6);
  cam.yaw = cam.yawTo = .45; cam.targetTo.set(0, heightOf(m.bricks) * .5 - 1.1, 0); cam.target.copy(cam.targetTo);
  $('say').textContent = `Build a ${m.word}!`;
  $('dots').innerHTML = m.bricks.map(() => '<i></i>').join('');
  $('ref').hidden = m.mode !== 5; if (m.mode === 5) $('ref').src = cardPic(MISSIONS.indexOf(m));
  say(`Build a ${m.word}!`);
  advance(true);
}

// the bricks that may go on right now
function pending() {
  const { m, placed } = cur, B = m.bricks, left = B.map((_, i) => i).filter(i => !placed.has(i));
  if (!left.length) return [];
  if (m.mode === 5) return left.filter(i => B.every((o, j) => placed.has(j) || o[3] + tall(o[7]) !== B[i][3] || !overlap(o, B[i])));   // everything under it is on
  if (m.mode === 4) return left.filter(i => B[i][3] === B[left[0]][3]);
  return [left[0]];
}

const CLASH = { red: ['orange', 'pink'], orange: ['red', 'yellow'], yellow: ['orange', 'glow'], brown: ['black'], black: ['brown', 'gray'], pink: ['red'], blue: ['gray', 'purple'], gray: ['blue', 'white'], white: ['gray', 'clear'],
  tan: ['yellow', 'white'], purple: ['blue', 'pink'], clear: ['white'], glow: ['yellow'] };
const SHAPES = [[1, 1], [1, 2], [2, 2], [2, 4]];
// the right brick plus wrong ones; `hard` adds look-alikes (a near color, a second shape)
function makeOptions(b, hard) {
  const [w, d, , , , c, e = 0, s = 0] = b, lo = Math.min(w, d), hi = Math.max(w, d), clash = CLASH[c] || [];
  const far = Object.keys(COLORS).filter(k => k !== c && !clash.includes(k)).sort(() => Math.random() - .5);
  const shapes = SHAPES.filter(q => q[0] !== lo || q[1] !== hi).sort(() => Math.random() - .5);
  const shaped = ([slo, shi]) => w >= d ? { w: shi, d: slo, c } : { w: slo, d: shi, c };
  const opts = [], want = hard ? 5 : 3;
  const push = o => { o = { e: 0, s: 0, ...o }; o.key = typeKey(o.w, o.d, o.c, o.e, o.s); if (opts.length < want && !opts.some(p => p.key === o.key)) opts.push(o); };
  push({ w, d, c, e, s, ok: true });
  push({ w, d, c: far[0], e, s });
  if (e || s) push({ w, d, c });                     // the same brick without its eyes, slope, wheels or frame
  if (isFrame(s)) push({ w, d, c, s: formOf(s) === 7 ? 9 : 7 });      // a door where a window goes, or the other way round
  push(shaped(shapes[0]));
  if (hard) { push({ w, d, c: clash.length ? rand(clash) : far[1], e, s }); push(shaped(shapes[1])); }
  for (const k of far) push({ w, d, c: k, e, s });
  return opts.sort(() => Math.random() - .5);
}

// after every change: light up what can go on next and refill the tray
function advance(first) {
  const { m } = cur, B = m.bricks, pend = pending();
  [...$('dots').children].forEach((d, i) => d.classList.toggle('on', i < cur.placed.size));
  for (let k = spots.length - 1; k >= 0; k--) if (cur.placed.has(spots[k].i)) dropSpot(k);
  if (!pend.length) { $('tray').textContent = ''; return; }        // finish() runs when the last brick lands
  lastAct = clock;
  if (m.mode !== 5) {
    const fresh = pend.filter(i => !spots.some(s => s.i === i));
    for (const i of fresh) makeSpot(i, B[i]);
    if (fresh.length) faceSpot(B[fresh[0]]);
  }

  let opts;
  if (m.mode === 1) opts = [optOf(B[pend[0]])];
  else if (m.mode <= 3) { opts = makeOptions(B[pend[0]], m.mode === 3); cur.wrongs = 0; }
  else {
    opts = [];      // one tile per kind of brick still needed: this layer (mode 4) or the whole model (mode 5)
    for (const i of m.mode === 4 ? pend : B.map((_, i) => i).filter(i => !cur.placed.has(i))) {
      const o = opts.find(o => o.key === keyOf(B[i]));
      if (o) o.n++; else opts.push({ ...optOf(B[i]), n: 1 });
    }
    if (m.mode === 4) {       // plus one brick that does not belong
      const y = B[pend[0]][3];
      if (cur.layer !== y) { cur.layer = y; cur.decoy = makeOptions(B[pend[0]], true).find(o => !o.ok && !opts.some(p => p.key === o.key)); cur.decoyAt = Math.floor(Math.random() * (opts.length + 1)); }
      if (cur.decoy) opts.splice(Math.min(cur.decoyAt, opts.length), 0, { ...cur.decoy, ok: false });
    }
  }
  const keep = cur.sel?.key;
  cur.opts = opts;
  cur.sel = m.mode === 1 ? opts[0] : (m.mode >= 4 && opts.find(o => o.ok && o.key === keep)) || null;
  const tray = $('tray'); tray.textContent = '';
  for (const o of opts) {
    const el = document.createElement('button');
    el.className = 'opt' + (o === cur.sel ? ' sel' : '');
    el.innerHTML = `<img alt="" src="${picOf(o)}">` + (o.n > 1 ? `<b class="n">${o.n}</b>` : '');
    el.onclick = () => pick(o, el);
    o.el = el; tray.append(el);
  }
  setHint();
  if (!first && m.mode <= 3) say(nameOf(B[pend[0]][5], B[pend[0]][7]));
}
const NAMES = { 5: 'wheels', 7: 'window', 9: 'door', 11: 'arch', 13: 'cone', 14: 'roof' };
const nameOf = (c, s) => NAMES[formOf(s)] ? `${c} ${NAMES[formOf(s)]}` : c;      // spoken: "red", "red door"
const hintOf = (c, s) => `<b style="color:${COLORS[c]}">${c}</b> ${NAMES[formOf(s)] || 'brick'}`;
function setHint() {
  const { m } = cur, b = m.mode <= 3 ? m.bricks[pending()[0]] : cur.sel && [, , , , , cur.sel.c, , cur.sel.s];
  $('hint').innerHTML = b ? hintOf(b[5], b[7]) : 'Pick a brick';
}

function pick(o, el) {
  if (state !== 'build') return;
  lastAct = clock;
  if (!o.ok) {
    sfx.wrong(); el.classList.remove('shake', 'nudge'); void el.offsetWidth; el.classList.add('shake');
    if (++cur.wrongs >= 2) nudge();
    return;
  }
  if (cur.sel !== o) { sfx.pick(); if (cur.m.mode >= 4) say(nameOf(o.c, o.s)); }
  cur.sel = o;
  cur.opts.forEach(x => x.el.classList.toggle('sel', x === o));
  setHint();
}
// wiggle a tray brick that can go on now
function nudge() {
  const B = cur.m.bricks, keys = pending().map(i => keyOf(B[i]));
  const el = cur.opts.find(o => o.ok && keys.includes(o.key))?.el; if (!el) return;
  el.classList.remove('nudge', 'shake'); void el.offsetWidth; el.classList.add('nudge');
}

// turn the camera if placed bricks hide a new glowing spot
const ray = new THREE.Raycaster();
function faceSpot(b) {
  const at = brickPos(b).add(new THREE.Vector3(0, topOf(b) * .6, 0));
  for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const from = camPosAt(cam.yawTo + turn), dir = at.clone().sub(from), far = dir.length();
    ray.set(from, dir.normalize()); ray.far = far - .6;
    if (!ray.intersectObjects(cur.group.children, true).length) { cam.yawTo += turn; return; }
  }
}

function placeBrick(i) {
  const c = cur, { m } = c, b = m.bricks[i], n = c.placed.size;
  c.placed.add(i); c.bricks.push(b); c.flying++; c.misses = 0;
  const mesh = meshOf(b), rest = brickPos(b).sub(c.pivot);
  mesh.position.copy(rest); mesh.position.y += 7; c.group.add(mesh);
  advance();
  tween(.3, k => { mesh.position.y = rest.y + 7 * (1 - k * k); }, () => {
    if (cur !== c) return;
    sfx.click(n); burst(brickPos(b).add(new THREE.Vector3(0, topOf(b), 0)), 12, { speed: 3, up: 3.5, life: .7 });
    tween(.22, k => { const s = Math.sin(k * Math.PI); mesh.scale.set(1 + .1 * s, 1 - .22 * s, 1 + .1 * s); }, () => {
      if (cur !== c || state !== 'build') return;
      if (!--c.flying && c.placed.size === m.bricks.length) finish();
    });
  });
}

// mode 5: the finger aims the picked brick; it snaps onto the nearest place where that brick belongs
function aimMission(px, py) {
  const B = cur.m.bricks, o = cur.sel, pend = pending();
  const t = B[pend.find(i => keyOf(B[i]) === o.key) ?? B.findIndex((b, i) => !cur.placed.has(i) && keyOf(b) === o.key)];
  const at = boardSpot(px, py, t[0], t[1], tall(t[7]));
  return at ? [t[0], t[1], at.x, at.y, at.z, o.c, o.e, t[7] || 0] : at;
}
function dropMission() {
  const b = aim; showAim(undefined);
  if (!b) return;
  lastAct = clock;
  const B = cur.m.bricks;
  let best = -1, near = 99;
  for (const i of pending()) {
    const t = B[i]; if (keyOf(t) !== cur.sel.key) continue;
    const far = Math.hypot(t[2] + t[0] / 2 - b[2] - b[0] / 2, t[4] + t[1] / 2 - b[4] - b[1] / 2) + Math.abs(t[3] - b[3]) * .5;
    if (far < near) { near = far; best = i; }
  }
  if (best >= 0 && near <= 1.9) return placeBrick(best);      // close enough: within a stud or so each way
  sfx.wrong();
  if (best < 0) return nudge();                       // this brick has nothing to sit on yet
  if (++cur.misses >= 2) hintSpot(best);
}
function hintSpot(i) { if (!spots.some(s => s.i === i)) makeSpot(i, cur.m.bricks[i], 3); }

// —— free build: any unlocked brick, anywhere; bricks drop onto whatever is below ——
const STARTER = ['2,2,brown', '2,2,green', '4,2,green'];
const myBricks = () => {
  const mine = [...new Set([...STARTER, ...save.bricks])].map(k => { const [w, d, c, e, s] = k.split(','); return { w: +w, d: +d, c, e: +e || 0, s: +s || 0 }; });
  // every plain 2×2 and 2×4 also comes as a tall brick, two layers high, so buildings go up faster
  const plain = mine.filter(o => !o.e && !o.s);
  // and every color of the 2×4 also comes as a long 1×8
  return [...mine, ...plain.filter(o => Math.min(o.w, o.d) === 2).map(o => ({ ...o, s: 15 })), ...plain.filter(o => o.w * o.d === 8).map(o => ({ ...o, w: 8, d: 1 }))];
};
// the selected brick after `rot` quarter turns: [w, d, slope]
function turned(o, rot) {
  const odd = rot % 2;
  return [odd ? o.d : o.w, odd ? o.w : o.d, isSlope(o.s) ? (o.s - 1 + rot) % 4 + 1 : faces(o.s) ? formOf(o.s) + odd : o.s];
}
// owned bricks grouped by shape; each shape lists the colors it comes in and whether it can have eyes
function shapesOwned() {
  const map = new Map();
  for (const o of myBricks()) {
    const [w, d] = isSlope(o.s) ? [o.w, o.d] : [Math.max(o.w, o.d), Math.min(o.w, o.d)];
    const k = w + 'x' + d + 'f' + formOf(o.s);
    if (!map.has(k)) map.set(k, { w, d, s: o.s, colors: [], decos: new Set() });
    const g = map.get(k);
    if (!g.colors.includes(o.c)) g.colors.push(o.c);
    if (o.e) g.decos.add(o.e);
  }
  const rank = g => g.s === 15 ? .5 : formOf(g.s);       // tall blocks come right after the plain ones
  return [...map.values()].sort((a, b) => rank(a) - rank(b) || a.w * a.d - b.w * b.d);
}
function startFree() {
  if (cur) scene.remove(cur.group);
  const group = new THREE.Group(); scene.add(group);
  cur = { free: true, group, pivot: new THREE.Vector3(), bricks: [], undo: [], sel: null, rot: 0, shapes: shapesOwned(), shape: null, color: '', deco: 0, view: NEAR };
  state = 'free'; show('build'); ghost.visible = false; clearSpots(); $('ref').hidden = true;
  setPlate(FREE); cam.tilt = .55;
  cam.yaw = cam.yawTo = .45; cam.zoom = cam.zoomTo = cur.view;
  for (const b of save.free || []) addFree(b, false);
  const mid = cur.bricks.length ? pivotOf(cur.bricks) : new THREE.Vector3();    // start looking at what is already built
  cam.targetTo.set(mid.x, 0, mid.z); panBy(0, 0);
  frameFree(true);
  $('say').textContent = 'Build anything!'; $('dots').textContent = '';
  say('Build anything!');
  const tray = $('tray'); tray.textContent = ''; tray.scrollLeft = 0;
  for (const g of cur.shapes) {
    const el = document.createElement('button');
    el.className = 'opt'; el.innerHTML = '<img alt="">';
    el.onclick = () => { if (state !== 'free') return; sfx.pick(); cur.shape = g; cur.rot = 0; cur.hand = cur.erase = cur.grab = false; refreshFree(); };
    g.el = el; tray.append(el);
  }
  cur.shape = cur.shapes.find(g => g.w === 2 && g.d === 2 && !g.s) || cur.shapes[0];
  refreshFree();
}
// redraw the two pickers after the shape, color, eyes or angle changed
function refreshFree() {
  const g = cur.shape;
  if (!g.colors.includes(cur.color)) cur.color = g.colors[0];
  const deco = canTex(g.s) ? cur.deco : 0;       // the chosen texture is kept for the next block shape
  cur.sel = { w: g.w, d: g.d, c: cur.color, e: deco, s: g.s };
  for (const h of cur.shapes) {         // every shape is drawn in the chosen color when it comes in that color
    const c = h.colors.includes(cur.color) ? cur.color : h.colors[0];
    const [w, d, s] = h === g ? turned(cur.sel, cur.rot) : [h.w, h.d, h.s];
    h.el.firstChild.src = brickPic(w, d, c, h === g ? deco : 0, s, h === g && (deco || formOf(g.s) === 9) ? faceOf(cur.sel) : undefined);
    h.el.classList.toggle('sel', h === g);
  }
  const sw = $('swatches'); sw.textContent = '';
  for (const c of g.colors) {
    const el = document.createElement('button');
    el.className = 'sw' + (c === cur.color ? ' on' : ''); el.style.background = COLORS[c]; el.setAttribute('aria-label', c);
    el.onclick = () => { if (state !== 'free') return; sfx.pick(); say(nameOf(c, g.s)); cur.color = c; refreshFree(); };
    sw.append(el);
  }
  $('tex').hidden = !canTex(g.s); $('tex').classList.toggle('on', !!deco);
  for (const el of $('texmenu').children) el.classList.toggle('on', el.dataset.t === (typeof cur.deco === 'string' ? 'abc' : String(cur.deco)));
  $('turn').hidden = g.w === g.d && !isSlope(g.s) && !faces(g.s) && !deco;       // a square block turns too once it has a texture to show
  $('hint').innerHTML = hintOf(cur.color, g.s);
  $('hand').classList.toggle('on', !!cur.hand); $('trash').classList.toggle('on', !!cur.erase); $('grab').classList.toggle('on', !!cur.grab);
  if (cur.erase) $('hint').textContent = 'Tap what to remove';
  if (cur.grab) $('hint').textContent = 'Move a brick';
}
// the hand: while it is on, one finger slides the plate instead of placing bricks; picking a brick turns it off
$('hand').onclick = () => { if (state !== 'free') return; sfx.pick(); cur.hand = !cur.hand; cur.erase = cur.grab = false; refreshFree(); };
// the texture menu: none, eyes, wall, waves, grass, or a character picked from a big keypad
const closeMenus = () => { $('texmenu').hidden = $('keys').hidden = true; };
$('tex').onclick = () => { if (state !== 'free') return; sfx.pick(); const open = $('texmenu').hidden; closeMenus(); $('texmenu').hidden = !open; };
for (const el of $('texmenu').children) el.onclick = () => {
  if (state !== 'free') return;
  sfx.pick(); closeMenus();
  if (el.dataset.t === 'abc') { $('keys').hidden = false; return; }
  cur.deco = +el.dataset.t; refreshFree();
};
for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz') {
  const el = document.createElement('button'); el.textContent = ch;
  el.onclick = () => { if (state !== 'free') return; sfx.pick(); say(ch); closeMenus(); cur.deco = '#' + ch; refreshFree(); };
  $('keys').append(el);
}
addEventListener('keydown', e => { if (state === 'free' && !$('keys').hidden && /^[0-9a-zA-Z]$/.test(e.key)) { closeMenus(); cur.deco = '#' + e.key; refreshFree(); } });
function addFree(b, drop) {
  const mesh = meshOf(b), rest = brickPos(b);
  mesh.userData.b = b; mesh.position.copy(rest); cur.group.add(mesh); cur.bricks.push(b);
  if (!drop) return;
  mesh.position.y += 7;
  tween(.25, k => { mesh.position.y = rest.y + 7 * (1 - k * k); }, () => {
    sfx.click(b[3]); burst(rest.clone().add(new THREE.Vector3(0, topOf(b), 0)), 10, { speed: 3, up: 3.5, life: .7 });
    tween(.22, k => { const s = Math.sin(k * Math.PI); mesh.scale.set(1 + .1 * s, 1 - .22 * s, 1 + .1 * s); });
  });
}
// the free-build view: `cur.view` is how much of the big plate shows (1 = all of it); two fingers slide and pinch it
const NEAR = .5, zoomBy = k => { cur.view = clampI(cur.view * k, .28, 1.1); };
function panBy(dx, dy) {        // slide the view by a finger movement in pixels
  const k = 2 * cam.dist * cam.zoom * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight, f = dy * k / Math.sin(cam.tilt), t = cam.targetTo;
  t.x = clampI(t.x - Math.cos(cam.yaw) * dx * k - Math.sin(cam.yaw) * f, -HALF, HALF);
  t.z = clampI(t.z + Math.sin(cam.yaw) * dx * k - Math.cos(cam.yaw) * f, -HALF, HALF);
  cam.target.x = t.x; cam.target.z = t.z;
}
function frameFree(now) {
  cam.targetTo.y = (cur.bricks.length ? heightOf(cur.bricks) : 0) * .3 - .6;       // the view rises with the building
  if (now) cam.target.copy(cam.targetTo);
}
$('zoom').onclick = () => { if (state !== 'free') return; sfx.pick(); cur.view = cur.view > .75 ? NEAR : 1; };
function changedFree() { save.free = cur.bricks; persist(); frameFree(); }

// Where would the selected brick land for a finger at (px, py)?
// undefined: not on the board. null: on the board, but the stack is already too tall.
const ndc = new THREE.Vector2();
// Where would a w×d brick land for a finger at (px, py)?
// undefined: not on the board. null: on the board, but the stack is already too tall.
// What the finger is touching. A top means "on here"; a brick's side means "next to it".
// The side of a stud counts as the top it stands on.
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function touchAt(px, py) {
  ray.far = Infinity; ray.setFromCamera(ndc.set(px / innerWidth * 2 - 1, 1 - py / innerHeight * 2), camera);
  const hit = ray.intersectObjects([plateMesh, ...cur.group.children], true)[0];
  if (!hit && state === 'free') {       // just past the plate's edge still counts, so a brick can be pulled out into an overhang
    const p = ray.ray.intersectPlane(GROUND, new THREE.Vector3());
    return p && Math.abs(p.x) < HALF + 1.5 && Math.abs(p.z) < HALF + 1.5 ? { hit: { point: p }, up: true, q: p } : undefined;
  }
  if (!hit) return undefined;
  const nrm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld), p = hit.point;
  const stud = Math.hypot(p.x + HALF - Math.floor(p.x + HALF) - .5, p.z + HALF - Math.floor(p.z + HALF) - .5) < .33;
  const up = nrm.y > .5 || stud;
  return { hit, up, q: up ? p.clone().setY(p.y - .05) : p.clone().addScaledVector(nrm, .3) };
}
function boardSpot(px, py, w, d, n = 1) {
  const t = touchAt(px, py); if (!t) return undefined;
  const { hit, up, q } = t;
  const x = clampI(Math.round(q.x + HALF - w / 2), 0, SIZE - w);     // centred under the finger
  const z = clampI(Math.round(q.z + HALF - d / 2), 0, SIZE - d);
  let y = 0;
  for (const b of cur.bricks) if (b[2] < x + w && b[2] + b[0] > x && b[4] < z + d && b[4] + b[1] > z) y = Math.max(y, b[3] + tall(b[7]));
  return { x, y, z };
}
// Free build: bricks pull toward a tidy place, like magnets. Near the finger, a spot that sits squarely on the brick
// below, or flush against a neighbour, wins over the exact spot under the finger; moving a stud further overrides it.
const landY = (x, z, w, d) => { let y = 0; for (const b of cur.bricks) if (b[2] < x + w && b[2] + b[0] > x && b[4] < z + d && b[4] + b[1] > z) y = Math.max(y, b[3] + tall(b[7])); return y; };
// Free build lets a brick stick out one stud past the plate's edge, for eaves, as long as it rests on another brick.
const EAVE = 1, onPlate = (x, z, w, d) => x >= 0 && z >= 0 && x + w <= SIZE && z + d <= SIZE;
function magnetSpot(px, py, w, d, n) {
  const t = touchAt(px, py); if (!t) return undefined;
  const { hit, up, q } = t;
  const fx = q.x + HALF - w / 2, fz = q.z + HALF - d / 2;                 // where the finger says, before rounding to studs
  const rx = clampI(Math.round(fx), -EAVE, SIZE - w + EAVE), rz = clampI(Math.round(fz), -EAVE, SIZE - d + EAVE);
  const want = up ? Math.round(hit.point.y / H) : landY(rx, rz, w, d);   // the level the finger is touching
  const k = w + ',' + d;
  let best = null, top = -Infinity;
  for (let x = Math.max(-EAVE, rx - 1); x <= Math.min(SIZE - w + EAVE, rx + 1); x++) for (let z = Math.max(-EAVE, rz - 1); z <= Math.min(SIZE - d + EAVE, rz + 1); z++) {
    const y = landY(x, z, w, d);
    if (!y && !onPlate(x, z, w, d)) continue;       // only a brick resting on another may hang over the edge
    let s = (y === want ? 100 : 0) - 12 * Math.hypot(x - fx, z - fz), on = 0;
    if (cur.stick && cur.stick.k === k && cur.stick.x === x && cur.stick.z === z) s += 2;      // a little force is needed to pull it away
    for (const b of cur.bricks) {
      const bt = b[3] + tall(b[7]), ox = Math.min(x + w, b[2] + b[0]) - Math.max(x, b[2]), oz = Math.min(z + d, b[4] + b[1]) - Math.max(z, b[4]);
      if (bt === y && ox > 0 && oz > 0) { on += ox * oz; s += ((x === b[2]) + (x + w === b[2] + b[0]) + (z === b[4]) + (z + d === b[4] + b[1])); }   // resting on it
      else if (b[3] < y + n && bt > y) {                                                                                                           // beside it
        if (ox === 0 && oz > 0) s += 3 * oz + 3 * ((z === b[4]) + (z + d === b[4] + b[1]));
        else if (oz === 0 && ox > 0) s += 3 * ox + 3 * ((x === b[2]) + (x + w === b[2] + b[0]));
      }
    }
    s += 6 * on / (w * d);
    if (s > top) { top = s; best = { x, y, z }; }
  }
  cur.stick = { k, x: best.x, z: best.z };
  return best;
}
// which way round the picked brick is: a texture's pair of sides, or a door's front after a half turn
const faceOf = o => formOf(o.s) === 9 ? +(cur.rot >= 2) : o.e ? cur.rot % 2 : 0;
function spotAt(px, py) {
  const o = cur.sel, [w, d, s] = turned(o, cur.rot), at = magnetSpot(px, py, w, d, tall(s));
  return at ? [w, d, at.x, at.y, at.z, o.c, o.e, s, faceOf(o)] : at;
}
// the see-through brick that follows the finger; letting go drops the real one there
let aim = null, aimKey = '';
function showAim(b) {
  aim = b; ghost.visible = !!b;
  if (!b) return;
  const key = b[0] + 'x' + b[1] + 's' + b[7];
  if (key !== aimKey) {
    aimKey = key; ghostBody.geometry = brickGeo(b[0], b[1], b[7]); ghostEdge.geometry = edgeGeo(b[0], b[1], tall(b[7]));
  }
  ghostMat.color.set(COLORS[b[5]]); ghost.position.copy(brickPos(b)); arrow.userData.top = topOf(b);
}
function dropAim() {
  const b = aim; showAim(undefined);
  if (b === null) return sfx.wrong();
  if (b) { addFree(b, true); cur.undo.push({ add: b }); changedFree(); }
}
// turn the picked brick a quarter; also works while a finger is holding the see-through brick over the plate
let lastTurn = 0;
function turnBrick() {
  if (state !== 'free' || $('turn').hidden || performance.now() - lastTurn < 180) return;
  lastTurn = performance.now();
  cur.rot = (cur.rot + 1) % (isSlope(cur.sel.s) || formOf(cur.sel.s) === 9 ? 4 : 2); sfx.pick(); refreshFree();
  if (down?.aim) showAim(spotAt(down.px, down.py));
}
$('turn').addEventListener('pointerdown', turnBrick);      // pointerdown, so a second finger can press it while the first one aims
addEventListener('keydown', e => { if ((e.key === 'r' || e.key === ' ') && $('keys').hidden) held ? turnHeld() : turnBrick(); });
$('undo').onclick = () => {
  if (state !== 'free') return;
  const u = cur.undo.pop(); if (!u) { sfx.wrong(); return; }
  sfx.pop();
  if (u.move) for (const { b, from } of u.move) { from.forEach((v, i) => { b[i] = v; }); remesh(b, cur.group.children.find(m => m.userData.b === b), cur.group); }
  else if (u.add) {
    cur.bricks.splice(cur.bricks.indexOf(u.add), 1);
    cur.group.remove(cur.group.children.find(m => m.userData.b === u.add));
  } else for (const b of u.clear || u.remove) addFree(b, false);
  changedFree();
};
// The grab tool: touch a brick and carry it somewhere else. Whatever is stacked on it comes along.
// No magnets here: it lands exactly under the finger.
const carry = new THREE.Group(); scene.add(carry);
let held = null;      // { anchor, set: [{ b, mesh, from }], d: [dx, dy, dz] }
function grabAt(px, py) {
  ray.far = Infinity; ray.setFromCamera(ndc.set(px / innerWidth * 2 - 1, 1 - py / innerHeight * 2), camera);
  let o = ray.intersectObjects(cur.group.children, true)[0]?.object;
  while (o && !o.userData.b) o = o.parent;
  if (!o) return false;
  const list = [o.userData.b];       // the brick and everything resting on it, all the way up
  const rests = (a, b) => b[3] === a[3] + tall(a[7]) && a[2] < b[2] + b[0] && a[2] + a[0] > b[2] && a[4] < b[4] + b[1] && a[4] + a[1] > b[4];
  for (let i = 0; i < list.length; i++) for (const b of cur.bricks) if (!list.includes(b) && rests(list[i], b)) list.push(b);
  held = { anchor: list[0], d: [0, 0, 0], set: list.map(b => ({ b, from: [...b], mesh: cur.group.children.find(m => m.userData.b === b) })) };
  for (const h of held.set) { cur.bricks.splice(cur.bricks.indexOf(h.b), 1); carry.add(h.mesh); }
  carry.position.set(0, .25, 0); sfx.pick();
  return true;
}
function moveHeld(px, py) {
  const t = touchAt(px, py); if (!t) return;       // off the board: stay where it was last
  const a = held.anchor, bs = held.set.map(h => h.b);
  let dx = Math.round(t.q.x + HALF - a[0] / 2) - a[2], dz = Math.round(t.q.z + HALF - a[1] / 2) - a[4];
  const x0 = Math.min(...bs.map(b => b[2])), x1 = Math.max(...bs.map(b => b[2] + b[0])), z0 = Math.min(...bs.map(b => b[4])), z1 = Math.max(...bs.map(b => b[4] + b[1]));
  const fit = m => [clampI(dx, -x0 - m, SIZE - x1 + m), clampI(dz, -z0 - m, SIZE - z1 + m)];
  const drop = (ex, ez) => Math.max(...bs.map(b => landY(b[2] + ex, b[4] + ez, b[0], b[1]) - b[3]));      // the whole stack comes down until one brick rests on something
  let dy;
  [dx, dz] = fit(EAVE); dy = drop(dx, dz);
  if (bs.some(b => !(b[3] + dy) && !onPlate(b[2] + dx, b[4] + dz, b[0], b[1]))) { [dx, dz] = fit(0); dy = drop(dx, dz); }      // nothing on the ground may hang over the edge
  held.d = [dx, dy, dz]; carry.position.set(dx, dy * H + .25, dz);
}
// a fresh mesh for a brick whose shape or place changed
function remesh(b, old, parent) {
  old?.removeFromParent();
  const m = meshOf(b); m.userData.b = b; m.position.copy(brickPos(b)); parent.add(m); return m;
}
// turn everything being carried a quarter, around the grabbed brick
let lastSpin = 0;
function turnHeld() {
  if (!held || performance.now() - lastSpin < 180) return;
  lastSpin = performance.now(); sfx.pick();
  const a = held.anchor, sum = Math.floor(a[2] + a[0] / 2 + a[4] + a[1] / 2), dif = Math.floor(a[4] + a[1] / 2 - a[2] - a[0] / 2);
  for (const h of held.set) {
    const [w, d, x, , z, , , s = 0] = h.b;
    h.b[0] = d; h.b[1] = w; h.b[2] = sum - z - d; h.b[4] = dif + x;
    h.b[7] = isSlope(s) ? s % 4 + 1 : faces(s) ? (s === formOf(s) ? s + 1 : s - 1) : s;
    if (formOf(s) !== 9 || s === 10) h.b[8] = h.b[8] ? 0 : 1;       // its texture turns with it; a door goes right round in four quarter turns
    h.mesh = remesh(h.b, h.mesh, carry);
  }
  if (down?.grab) moveHeld(down.px, down.py);
}
// is the finger over the bin? While something is carried the bin stays on screen as a place to drop it
function overBin(px, py) { const r = $('trash').getBoundingClientRect(); return px > r.left - 24 && px < r.right + 24 && py > r.top - 24 && py < r.bottom + 24; }
function dropHeld(cancel, bin) {
  if (!held) return;
  document.body.classList.remove('grabbing'); $('trash').classList.remove('hot');
  if (bin && !cancel) {        // dropped on the bin: what was carried is thrown away (undo brings it back where it was)
    const at = new THREE.Vector3(); ray.setFromCamera(ndc.set(-.75, .35), camera); ray.ray.at(cam.dist * cam.zoom * .7, at);
    for (const h of held.set) { h.from.forEach((v, i) => { h.b[i] = v; }); h.mesh.removeFromParent(); }
    cur.undo.push({ remove: held.set.map(h => h.b) }); sfx.pop(); burst(at, 24, { speed: 4, up: 4, life: .8 });
    held = null; changedFree(); return;
  }
  const [dx, dy, dz] = cancel ? [0, 0, 0] : held.d;
  for (const h of held.set) {
    if (cancel) h.from.forEach((v, i) => { h.b[i] = v; });
    h.b[2] += dx; h.b[3] += dy; h.b[4] += dz;
    h.mesh = remesh(h.b, h.mesh, cur.group); cur.bricks.push(h.b);
  }
  const moved = held.set.some(h => h.from.some((v, i) => h.b[i] !== v));
  if (moved) { cur.undo.push({ move: held.set.map(h => ({ b: h.b, from: h.from })) }); sfx.click(held.anchor[3]); changedFree(); }
  held = null;
}
$('grab').onclick = () => { if (state !== 'free') return; sfx.pick(); cur.grab = !cur.grab; cur.hand = cur.erase = false; refreshFree(); };

// The bin: tap it, then tap something on the plate. Everything joined to that brick (stacked or touching) goes at once.
// The undo button brings it back. Holding the bin clears the whole plate.
const joined = (a, b) => {
  const ox = Math.min(a[2] + a[0], b[2] + b[0]) - Math.max(a[2], b[2]), oz = Math.min(a[4] + a[1], b[4] + b[1]) - Math.max(a[4], b[4]);
  const oy = Math.min(a[3] + tall(a[7]), b[3] + tall(b[7])) - Math.max(a[3], b[3]);
  return (ox > 0 && oz > 0 && oy === 0) || (oy > 0 && ((ox === 0 && oz > 0) || (oz === 0 && ox > 0)));
};
function removeBricks(list, how) {
  sfx.pop(); cur.undo.push({ [how]: list });
  for (const b of list.slice(-40)) burst(brickPos(b).add(new THREE.Vector3(0, topOf(b) / 2, 0)), 6, { speed: 4, up: 4, life: .8 });
  for (const b of list) { cur.bricks.splice(cur.bricks.indexOf(b), 1); cur.group.remove(cur.group.children.find(m => m.userData.b === b)); }
  changedFree();
}
function eraseAt(px, py) {
  ray.far = Infinity; ray.setFromCamera(ndc.set(px / innerWidth * 2 - 1, 1 - py / innerHeight * 2), camera);
  let o = ray.intersectObjects(cur.group.children, true)[0]?.object;
  while (o && !o.userData.b) o = o.parent;
  if (!o) return sfx.wrong();
  const group = [o.userData.b];
  for (let i = 0; i < group.length; i++) for (const b of cur.bricks) if (!group.includes(b) && joined(group[i], b)) group.push(b);
  removeBricks(group, 'remove'); cur.erase = false; refreshFree();
}
{
  let hold, held = false;
  const bin = $('trash');
  bin.addEventListener('pointerdown', () => { held = false; hold = setTimeout(() => { held = true; if (state === 'free' && cur.bricks.length) { removeBricks([...cur.bricks], 'clear'); cur.erase = false; refreshFree(); } }, 900); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) bin.addEventListener(ev, () => clearTimeout(hold));
  bin.onclick = () => {
    if (state !== 'free' || held) return;
    if (!cur.bricks.length) return sfx.wrong();
    sfx.pick(); cur.erase = !cur.erase; cur.hand = cur.grab = false; refreshFree();
  };
}

// —— finished: the model comes alive ——
function finish() {
  state = 'alive'; cur.aliveT = 0; ghost.visible = false; clearSpots(); $('hud').hidden = true;
  const { m } = cur, first = !save.done.includes(m.id);
  sfx.fanfare(); say(`You built a ${m.word}!`);
  const top = new THREE.Vector3(cur.pivot.x, heightOf(m.bricks) + 4, cur.pivot.z);
  burst(top, 150, { speed: 6, up: 5, gravity: 5, life: 3.2, spread: 5 });
  cam.targetTo.y -= .5;
  cam.home = .45 + Math.round((cam.yawTo - .45) / (Math.PI * 2)) * Math.PI * 2;   // nearest front view
  if (first) { save.done.push(m.id); persist(); }
  const hasGift = first && m.gift?.length;
  $('word').textContent = m.word;
  $('gift').hidden = !hasGift; $('newbricks').hidden = true; $('next').hidden = !!hasGift;
  setTimeout(() => { if (state === 'alive' && cur?.m === m) $('win').hidden = false; }, 2000);
}
$('wordcard').onclick = () => say(cur.m.word);
$('gift').onclick = () => {
  const { m } = cur;
  sfx.pop(); sfx.fanfare(); say('New bricks!');
  $('gift').hidden = true;
  $('nbimgs').innerHTML = m.gift.map(g => `<img alt="" src="${brickPic(...g)}">`).join('');
  $('newbricks').hidden = false; $('next').hidden = false;
  for (const g of m.gift) { const k = brickKey(g); if (!save.bricks.includes(k)) save.bricks.push(k); }
  persist();
  burst(new THREE.Vector3(cur.pivot.x, heightOf(m.bricks) + 3, cur.pivot.z), 80, { speed: 6, up: 5, gravity: 5, life: 2.5, spread: 4 });
};
$('next').onclick = () => {
  sfx.pop();
  const up = MISSIONS.find((m, i) => unlocked(i) && !save.done.includes(m.id));   // move on to the next world when this one is finished
  if (up && up.world !== save.world) { save.world = up.world; persist(); }
  renderHome();
};
$('back').onclick = () => { sfx.pop(); try { speechSynthesis.cancel(); } catch { } renderHome(); };
$('spin').onclick = () => { sfx.pick(); cam.yawTo += Math.PI / 2; lastAct = clock; };

let lastSound = 0;
function alive(t) {
  const g = cur.group, p = cur.pivot;
  switch (cur.m.alive) {
    case 'sway': g.rotation.z = Math.sin(t * 2.6) * .1; g.rotation.x = Math.sin(t * 1.7) * .04; break;
    case 'spin': g.rotation.y = t * 1.6; g.position.y = Math.abs(Math.sin(t * 3.2)) * .5; break;
    case 'bounce': {
      const hop = Math.abs(Math.sin(t * 4)); g.position.y = hop * 1.1;
      const sq = Math.max(0, 1 - hop * 5) * .2; g.scale.set(1 + sq, 1 - sq, 1 + sq); break;
    }
    case 'crawl': g.position.x = p.x + Math.sin(t * .9) * 1; g.scale.x = 1 + Math.sin(t * 6) * .05; break;
    case 'waddle': {
      const a = t * 1.1, r = 1.4;
      g.position.set(p.x + Math.sin(a) * r, Math.abs(Math.sin(t * 8)) * .2, p.z + Math.cos(a) * r - r);
      g.rotation.set(0, a, Math.sin(t * 8) * .1, 'YXZ');
      break;
    }
    case 'drive': {
      const x = Math.sin(t * 1.1) * 1.4;
      g.position.set(p.x + x, Math.abs(Math.sin(t * 13)) * .03, p.z);
      g.traverse(o => { if (o.userData.wheel) o.rotation.z = -x / WHEEL; });
      break;
    }
    case 'hover':
      g.position.set(p.x + Math.sin(t * .8) * 1.2, 1.3 + Math.sin(t * 2.4) * .4, p.z);
      g.rotation.set(Math.sin(t * 1.9) * .08, t * 1.2, Math.sin(t * 1.5) * .1); break;
    case 'launch': {          // shake, lift off, float back down
      const c = t % 6, up = c < 1 ? 0 : c < 2.8 ? (c - 1) ** 2 * 2.6 : Math.max(0, 8.4 * (1 - (c - 2.8) / 2.4));
      g.position.set(p.x + (c < 1.6 ? Math.sin(t * 60) * .04 : 0), up, p.z);
      if (c > .8 && c < 2.8) burst(new THREE.Vector3(p.x, up, p.z), 2, { speed: 1.5, up: -3, gravity: 3, life: .5 });
      break;
    }
    case 'trot':
      g.position.set(p.x + Math.sin(t * 1.3) * 1.1, Math.abs(Math.sin(t * 9)) * .18, p.z);
      g.rotation.z = Math.sin(t * 9) * .05; break;
  }
  if (cur.m.bricks.some(b => formOf(b[7]) === 9)) { const a = -Math.max(0, Math.sin(t * 1.6 - .8)) * 1.4; g.traverse(o => { if (o.userData.door) o.rotation.y = a; }); }   // doors swing open
  const snd = cur.m.sound;
  if (snd && (t - lastSound > 1.7 || t < lastSound) && t > .9) { lastSound = t; sfx[snd](); }
  cam.yawTo = cam.home + Math.sin(t * .45) * .3;
}

// —— taps and drags on the 3D view ——
let down = null, pinch = null;
const fingers = new Map();
const aiming = () => state === 'free' || (state === 'build' && cur.m.mode === 5);
const spread = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
canvas.addEventListener('pointerdown', e => {
  closeMenus();
  sfx.unlock(); fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size > 1) {
    // a second finger while the first one has been aiming a brick for a moment: turn the brick
    if (down?.aim && state === 'free' && performance.now() - down.t > 300) return turnBrick();
    if (down?.grab && performance.now() - down.t > 300) return turnHeld();       // the same for a brick being carried
    // otherwise stop aiming; in free build two fingers slide and pinch the view
    down = null; showAim(undefined); dropHeld(true); document.body.classList.remove('placing');
    pinch = state === 'free' && fingers.size === 2 ? spread() : null;
    return;
  }
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, px: e.clientX, py: e.clientY, drag: false, id: e.pointerId, t: performance.now() };
  if (state === 'free' && (cur.hand || e.button > 0)) { down.pan = true; return; }     // the hand (or a right mouse button) slides the plate
  if (state === 'free' && cur.erase) return;       // the bin is on: a tap picks what to remove
  if (state === 'free' && cur.grab) {              // the grab tool is on: pick up the brick under the finger
    if (grabAt(e.clientX, e.clientY)) { down.grab = true; document.body.classList.add('placing', 'grabbing'); moveHeld(e.clientX, e.clientY); }
    return;
  }
  if (!aiming()) return;
  // finger on the board: aim a brick. Finger on the background: turn the view.
  if (boardSpot(e.clientX, e.clientY, 1, 1) === undefined) return;
  if (!cur.sel) { down = null; sfx.hint(); nudge(); return; }
  down.aim = true; cur.stick = null; document.body.classList.add('placing');      // the buttons get out of the way while a brick is held
  showAim(state === 'free' ? spotAt(e.clientX, e.clientY) : aimMission(e.clientX, e.clientY));
});
canvas.addEventListener('pointermove', e => {
  const f = fingers.get(e.pointerId); if (f) { f.x = e.clientX; f.y = e.clientY; }
  if (pinch && state === 'free' && fingers.size === 2) {
    const now = spread(); zoomBy(pinch.d / now.d); cam.zoom = cam.zoomTo = cur.view; panBy(now.x - pinch.x, now.y - pinch.y); pinch = now;
    return;
  }
  if (!down || e.pointerId !== down.id) return;
  if (down.grab) { down.px = e.clientX; down.py = e.clientY; $('trash').classList.toggle('hot', overBin(e.clientX, e.clientY)); return moveHeld(e.clientX, e.clientY); }
  if (down.pan) { if (state === 'free') panBy(e.clientX - down.lx, e.clientY - down.ly); down.lx = e.clientX; down.ly = e.clientY; return; }
  if (down.aim) { down.px = e.clientX; down.py = e.clientY; return aiming() && showAim(state === 'free' ? spotAt(e.clientX, e.clientY) : aimMission(e.clientX, e.clientY)); }
  if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 16) down.drag = true;
  if (down.drag) { cam.yawTo -= (e.clientX - down.lx) * .007; cam.yaw = cam.yawTo; down.lx = e.clientX; }
});
addEventListener('pointerup', e => {
  fingers.delete(e.pointerId); pinch = null;
  if (!down || e.pointerId !== down.id) return;
  const d = down; down = null; document.body.classList.remove('placing');
  if (d.pan) return;
  if (d.grab) return dropHeld(false, overBin(e.clientX, e.clientY));
  if (d.aim) return state === 'free' ? dropAim() : aiming() ? dropMission() : showAim(undefined);
  if (!d.drag) tap(e.clientX, e.clientY);
});
addEventListener('pointercancel', e => { fingers.delete(e.pointerId); pinch = null; down = null; showAim(undefined); dropHeld(true); document.body.classList.remove('placing'); });
// the mouse wheel zooms; while a brick is being aimed it turns the brick instead
canvas.addEventListener('wheel', e => { if (state !== 'free') return; if (down?.grab) turnHeld(); else if (down?.aim) turnBrick(); else zoomBy(Math.exp(e.deltaY * .0015)); }, { passive: true });

const _v = new THREE.Vector3();
const toScreen = v => { _v.copy(v).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; };
// a tap on a glowing spot puts the picked brick there
function tap(x, y) {
  if (state === 'free' && cur.erase) return eraseAt(x, y);
  if (state !== 'build' || !spots.length) return;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  let hit = null, best = 1, mine = null, bestMine = 1;      // the nearest spot, and the nearest one the picked brick fits
  for (const s of spots) {
    const mid = s.g.position.clone().add(new THREE.Vector3(0, topOf(s.b) / 2, 0)), [gx, gy] = toScreen(mid);
    // how big the spot looks on screen, so the tap target is generous but still means "here"
    const [ex, ey] = toScreen(mid.clone().addScaledVector(right, Math.max(s.b[0], s.b[1]) / 2 + .4));
    const reach = Math.max(64, Math.hypot(ex - gx, ey - gy) * (spots.length > 1 ? 1.1 : 1.5));
    const far = Math.hypot(x - gx, y - gy) / reach;
    if (far < best) { best = far; hit = s; }
    if (far < bestMine && s.key === cur.sel?.key) { bestMine = far; mine = s; }
  }
  hit = mine || hit;
  if (!hit) return;
  lastAct = clock;
  if (!cur.sel) { sfx.hint(); nudge(); return; }
  if (hit.key !== cur.sel.key) { sfx.wrong(); return; }
  placeBrick(hit.i);
}

// —— grown-ups menu: press and hold the gear ——
{
  let hold;
  const gear = $('gear');
  gear.addEventListener('pointerdown', () => { hold = setTimeout(openParent, 1200); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) gear.addEventListener(ev, () => clearTimeout(hold));
  gear.addEventListener('contextmenu', e => e.preventDefault());
  function openParent() { $('pVoice').textContent = `Voice: ${save.voice ? 'on' : 'off'}`; $('pReset').textContent = 'Reset progress'; $('parent').hidden = false; }
  $('pVoice').onclick = () => { save.voice = !save.voice; persist(); openParent(); if (save.voice) say('Hello!'); };
  $('pUnlock').onclick = () => {
    save.done = MISSIONS.map(m => m.id);
    save.bricks = [...new Set(MISSIONS.flatMap(m => (m.gift || []).map(brickKey)))]; persist(); $('parent').hidden = true; renderHome(); };
  let armed = false;
  $('pReset').onclick = () => {
    if (!armed) { armed = true; $('pReset').textContent = 'Tap again to erase all progress'; return; }
    armed = false; save.done = []; save.bricks = []; save.free = []; persist(); $('parent').hidden = true; renderHome();
  };
  $('pClose').onclick = () => { armed = false; $('parent').hidden = true; };
}
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

// —— main loop ——
let prev = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - prev) / 1000); prev = now; clock += dt;
  requestAnimationFrame(frame);
  if (state === 'home') return;
  updateTweens(dt); updateBits(dt);

  const pulse = .5 + .5 * Math.sin(clock * 5), hop = 1.1 + Math.abs(Math.sin(clock * 4)) * .5;
  if (ghost.visible) {            // the brick being aimed with a finger
    ghostMat.opacity = .4 + pulse * .28; ghostEdge.material.opacity = .5 + pulse * .5;
    arrow.position.y = hop + (arrow.userData.top || H); arrow.rotation.y = clock * 2;
  }
  spotEdgeMat.opacity = .5 + pulse * .5;
  for (let k = spots.length - 1; k >= 0; k--) {
    const s = spots[k], live = cur.sel?.key === s.key;
    s.mat.opacity = (live ? .4 : .26) + pulse * .28;
    s.ar.visible = live; s.ar.position.y = hop + topOf(s.b); s.ar.rotation.y = clock * 2;
    if ((s.ttl -= dt) <= 0) dropSpot(k);
  }
  if (state === 'build' && clock - lastAct > 6 && !cur.flying && pending().length) {   // stuck? point at what to do next
    lastAct = clock; sfx.hint();
    const B = cur.m.bricks, mine = cur.sel && pending().filter(i => keyOf(B[i]) === cur.sel.key);
    if (!mine?.length) nudge();
    else if (cur.m.mode === 5) hintSpot(mine[0]);
    else for (const i of mine) burst(brickPos(B[i]).add(new THREE.Vector3(0, H, 0)), 8, { speed: 2.5, up: 3, life: .6 });
  }
  if (state === 'alive') { cur.aliveT += dt; alive(cur.aliveT); }

  const ease = 1 - Math.exp(-dt * 6);
  if (state === 'free') cam.zoomTo = cur.view;
  cam.yaw += (cam.yawTo - cam.yaw) * ease; cam.zoom += (cam.zoomTo - cam.zoom) * ease; cam.target.lerp(cam.targetTo, ease);
  camPosAt(cam.yaw, camera.position); camera.lookAt(cam.target);
  renderer.render(scene, camera);
}

renderHome();
$('boot').hidden = true;
requestAnimationFrame(frame);

// ?debug exposes a probe: where would the picked free-build brick go for a finger over plate position (x, y, z)?
if (params.has('debug')) window.scr = (x, y, z) => toScreen(new THREE.Vector3(x - HALF, y * H, z - HALF));
if (params.has('debug')) window.tapAt = (x, y, z) => tap(...toScreen(new THREE.Vector3(x - HALF, y * H, z - HALF)));
if (params.has('debug')) window.probe = (x, y, z, keep) => { if (!keep) cur.stick = null; const [px, py] = toScreen(new THREE.Vector3(x - HALF, y * H, z - HALF)); const b = spotAt(px, py); return b && [b[2], b[3], b[4]]; };

// —— test hooks: ?auto=duck plays a mission by itself, &stop=3 pauses after three bricks ——
if (params.get('auto')) {
  const m = MISSIONS.find(x => x.id === params.get('auto')) || MISSIONS[0], stop = +(params.get('stop') ?? 99);
  save.voice = false; startMission(m);
  setInterval(() => {
    if (state === 'alive' && !$('gift').hidden && params.get('open')) return $('gift').click();
    if (state !== 'build' || cur.flying || cur.placed.size >= stop) return;
    const i = pending()[0], b = m.bricks[i];
    if (cur.sel?.key !== keyOf(b)) return cur.opts.find(o => o.ok && o.key === keyOf(b)).el.click();
    if (m.mode === 5) return placeBrick(i);
    const [x, y] = toScreen(brickPos(b).add(new THREE.Vector3(0, topOf(b) / 2, 0)));
    tap(x, y);
  }, 300);
}

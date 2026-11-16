// Saibot Tower: the gray-box layout in the Wet neon night look, with the locked Saibot car (11/15/26 night).
// Plays scene/tower.glb (built by _source/blender/build_graybox.py) + scene/car.glb (_source/car/make_web_car.py)
// and wires every tap: START on the steering wheel, Skip, the elevator floor panel, the studio floor, office pages,
// plain links. Timings come from scene/tower.json, written by the Blender script.
// The opening: the visitor sits in the driver's seat, presses START on the wheel, the camera pulls out
// and the car drives straight into the open elevator.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Sound, STATIONS } from './audio.js';

const BUILD = '3p';
// office names in the studio's end-card face: Tigre images in type/<slug>.png (Tigre is images only, never a webfont)
const NAMES = { brand: 'Brand', content: 'Content', amazon: 'Amazon', '3d': '3D + Web', apps: 'Apps', automation: 'Automation', contact: 'Reception' };
const $ = (id) => document.getElementById(id);
const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);
const smooth = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;
const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const gauge = (p) => { if (window.__gauge) window.__gauge(p); };
gauge(0.12);

// localStorage can throw (private windows, sandboxed frames): never let it break the page
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};
const VISITED = 'saibotTower.visited', CALM = 'saibotTower.calm';

const ORDER = ['brand', 'content', 'amazon', '3d', 'apps', 'automation'];   // map order, left to right
const ALL = [...ORDER, 'contact'];

// ---------- sound: unlock on the finger lift only ----------
const sound = new Sound();
for (const ev of ['pointerup', 'touchend', 'click', 'keyup']) {
  window.addEventListener(ev, () => sound.wake(), { capture: true, passive: true });
}
for (const ev of ['pointerdown', 'keydown']) {      // finger down: build the audio graph, start nothing
  window.addEventListener(ev, () => sound.prepare(), { capture: true, passive: true });
}
document.addEventListener('visibilitychange', () => {
  sound.pageHidden(document.hidden);
  if (!filmOn) return;                    // the film is the ride's clock: it waits while the tab is away
  if (document.hidden) film.pause();
  else { const p = film.play(); if (p && p.catch) p.catch(() => filmFallback()); }
});

// ---------- renderer ----------
const canvas = $('gl');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  noGL();
  throw e;
}
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;      // = the Khronos PBR Neutral view the Blender looks were judged in
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const SKY = new THREE.Color('#07060E');                // Wet neon night
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 90, 420);
const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 1500);   // near 2 cm: the cockpit is close
camera.layers.enable(1);                               // layer 1 = what the wet street reflects (neon, lamps, sign, cab)
const hemi = new THREE.HemisphereLight(0x8c7ad6, 0x120d1c, 0.18);
const sun = new THREE.DirectionalLight(0xffffff, 0);   // night: only the studio floor gets daylight-ish fill
sun.position.set(-60, 140, 80);
const studioLamp = new THREE.SpotLight(0xfff2dc, 0, 0, 1.15, 0.7, 2);   // points down: lights the floor, not the ceiling
scene.add(hemi, sun, studioLamp, studioLamp.target);

// glow: neon, lamps, the START ring and the dash (half-resolution bloom keeps phones fast).
// The scene draws into the composer's own buffer, where the canvas's antialias flag does nothing, so that buffer
// gets its own 4x MSAA (without it every edge goes jagged the moment the glow pass is on).
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.35, 1.1);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR);
  composer.setSize(w, h);
  bloom.resolution.set(Math.round(w * DPR / 2), Math.round(h * DPR / 2));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ride keeps the Blender framing on wide screens; tall phones get a wider vertical angle.
// cockpit: ~80 deg across on wide screens (the Blender look), the wheel + START + windshield on tall phones
function fovFor(kind) {
  const a = camera.aspect;
  const V = kind === 'floor' ? 52 : kind === 'cockpit' ? 50 : 42, H = kind === 'floor' ? 66 : kind === 'cockpit' ? 64 : 60;
  if (a >= 1) return V;
  return Math.min(kind === 'cockpit' ? 92 : 96, Math.max(V, 2 * Math.atan(Math.tan((H * DEG) / 2) / a) / DEG));
}

// ---------- state ----------
let META = null, mixer = null, DUR = 0, RIDE_END = 10;
let camNode = null, cabNode = null, carNode = null;
const offices = {};                 // slug -> { slug, label, room, hit, trim, screen, label3d, center, tap, hi }
const hitList = [];
const fx = {};
let state = 'loading';              // curb | ride | floor | move | office
let clipT = 0, rideStart = 0, queued = null, move = null, openSlug = null;
let lights = { mode: 'ride', t0: 0 };   // ride: follows the ride clock; quick: 1.5 s light-up; on
let lit = null, hover = null;
let yaw = 0, pitch = 0, yawGoal = null, sway = 0, lastTouch = 0, tilt = 0;
const calmMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let calm = store.get(CALM) != null ? store.get(CALM) === '1' : !!(calmMq && calmMq.matches);
const finePointer = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
const F = {};                       // the floor view: eye, target, fwd, right (three.js space)
const carCenter = new THREE.Vector3();
const frames = { ride: [], floor: [], all: [], long: [] };
let realCar = null, cabGlow = null, startObj = null;
const wheels = [];                  // [gray-box wheel node (animated), real wheel node] pairs
const car = {};                     // the real car's materials the ride lights up
const startAt = new THREE.Vector3();
const START_LOCAL = new THREE.Vector3(-0.285, 0.6848, -0.1726);   // the START button in the car node's frame (car.glb)
const START_R = 0.026;              // the 3D button's radius (m)
// the driver's seat before START: drag to look around, inside the car and out at the city
let seatYaw = 0, seatPitch = 0, seatDrag = null, seatBlend = false;
const seatFrom = new THREE.Quaternion();
// floor 18: the driver's seat, or stepped out with a camera circling the car
let floorView = 'seat', viewTween = null, ringDim = 0;
const orbit = { ang: Math.PI + 0.65, el: 0.3, r: 6.0 };              // starts at the front-left three-quarter
const orbitC = new THREE.Vector3(), _tp = new THREE.Vector3(), _tq = new THREE.Quaternion(), _mid = new THREE.Vector3();

const b2t = (v) => new THREE.Vector3(v[0], v[2], -v[1]);    // Blender (Z up) -> three.js (Y up)

// ---------- loaders: Draco meshes; the private test link can't serve .glb/.hdr, so the same bytes ride in base64 .json ----------
const draco = new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/gltf/');
const gltfLoader = new GLTFLoader().setDRACOLoader(draco);
async function wrapped(url, onProgress) {          // <url>.json, big files split into <url>.partN.json
  const fl = new THREE.FileLoader().setResponseType('text');
  const head = JSON.parse(await fl.loadAsync(url + '.json', onProgress));
  const b64 = head.parts
    ? (await Promise.all(Array.from({ length: head.parts }, (_, i) => fl.loadAsync(url + '.part' + i + '.json').then((t) => JSON.parse(t).glb)))).join('')
    : head.glb;
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function loadGlb(url, onProgress) {
  try { return await gltfLoader.loadAsync(url, onProgress); }
  catch (err) { return await gltfLoader.parseAsync((await wrapped(url, onProgress)).buffer, ''); }
}
async function loadEnv(url) {
  let tex;
  try { tex = await new HDRLoader().loadAsync(url); }
  catch (err) {
    const blob = URL.createObjectURL(new Blob([await wrapped(url)]));
    tex = await new HDRLoader().loadAsync(blob);
    URL.revokeObjectURL(blob);
  }
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(tex).texture;     // a 360 Cycles render of this street (Blender look A)
  scene.environmentIntensity = 0.7;
  tex.dispose();
  pm.dispose();
}

// ---------- the driver's seat in 360: a Cycles render from this exact eye (_source/looks: build_looks.py pano) ----------
// shown on a sphere around the camera before START (looking around costs a phone almost nothing); the START ring is
// still projected from the real 3D button, which sits in the same place in the picture
const panoScene = new THREE.Scene();
const panoMesh = new THREE.Mesh(new THREE.SphereGeometry(20, 96, 48).scale(1, 1, -1),     // z flipped: three.js's equirect layout
  new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
panoScene.add(panoMesh);
// two of them: the street before START, and floor 18 from the seat (render_ride.py pano18), where the film hands over
let pano = null, pano18 = null, panoK = 1;
function panoGet(name) {
  const big = renderer.capabilities.maxTextureSize >= 6144;
  return new THREE.TextureLoader().loadAsync('scene/' + name + (big ? '' : '_4k') + '.jpg').then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
  }, (err) => { console.warn(name + ' did not load; live 3D stays', err); ensureLive(); return null; });
}
function loadPano18() {                     // the driver's seat on 18: needed when the ride lands, 12 s after START
  if (!pano18Promise) pano18Promise = panoGet('pano_seat18').then((t) => { pano18 = t; });
  return pano18Promise;
}
async function loadPano(floorNow) {
  await Promise.all([panoGet('pano_seat').then((t) => { pano = t; }), floorNow ? loadPano18() : null]);
}
function drawPano(tex, k) {              // the 360 picture round the camera; k < 1 lays it over the live frame (a crossfade)
  const m = panoMesh.material;
  if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
  m.transparent = k < 1;
  m.opacity = k;
  panoMesh.position.copy(camera.position);
  renderer.setRenderTarget(null);
  if (k < 1) { composer.render(); renderer.autoClear = false; }
  renderer.render(panoScene, camera);
  renderer.autoClear = true;
}

// ---------- the ride as a Blender film (_source/film: render_ride.py, encode_ride.py) ----------
// START plays it; its own sound is the ride mix. If you were looking around in the 360 seat, the view turns back to the
// road first (the film's camera holds still in the seat for its first second). At 10.0 s live 3D takes over in the
// driver's seat on 18 and the film fades while its sound runs out. Calm mode, or a phone that can't play it: live ride.
const film = $('film');
const IN_SEAT = 7.95;                     // build_graybox IN_CAR[0]: the camera swoops back into the seat
let filmOn = false, filmShown = false, filmTap = 0, filmTurn = false, filmWait = null;
function filmShape() { return window.innerWidth < window.innerHeight ? 'tall' : 'wide'; }
function filmPrep() {
  if (calm || !film) return;
  const want = 'scene/ride_' + filmShape() + '.mp4';
  if (film.getAttribute('src') !== want) { film.setAttribute('src', want); try { film.load(); } catch (e) { /* ignore */ } }
}
function filmOff() {
  filmOn = false; filmShown = false;
  if (filmWait) { clearTimeout(filmWait); filmWait = null; }
  film.classList.remove('on', 'out');
  try { film.pause(); } catch (e) { /* ignore */ }
}
function filmStart() {                     // inside the START tap, so play() may start with sound
  if (calm || !film || !film.getAttribute('src') || film.error) return false;
  filmOn = true; filmShown = false; filmTap = performance.now();
  film.classList.remove('on', 'out');
  film.muted = sound.muted;
  try { film.currentTime = 0; } catch (e) { /* not loaded yet */ }
  const p = film.play();
  if (p && p.catch) p.catch(() => filmFallback());
  filmWait = setTimeout(() => { if (filmOn && (film.paused || film.currentTime < 0.01)) filmFallback(); }, 3000);
  return true;
}
function filmFallback() {                  // the film did not start here: the live ride (and its sound) from where we are
  if (!filmOn) return;
  ensureLive();
  const t = film.currentTime || 0;
  filmOff();
  rideStart = performance.now() - t * 1000;
  sound.ride(t);
}
film.addEventListener('error', () => filmFallback());
film.addEventListener('ended', () => film.classList.remove('on', 'out'));

// ---------- the office flights as Blender films (render_ride.py offices, encode_offices.py) ----------
// From the seat on 18: the second tap plays the in-film (out of the roof, through the door, into the room); the room's
// last frame stays behind the (now see-through) office page; Back plays the same film reversed into the seat, where
// the floor-18 360 takes over. From the orbit view, in calm mode, or if a film won't play here: the live flight.
const flight = $('flight'), roomshot = $('roomshot');
let flightOn = null, flightBroken = false, flightWait = null;
const flightSrc = (slug, kind) => 'scene/office/' + slug + '_' + kind + '_' + filmShape() + '.mp4';
function flightPrep(slug, kind) {
  if (calm || flightBroken) return;
  const s = flightSrc(slug, kind);
  if (flight.getAttribute('src') !== s) { flight.setAttribute('src', s); try { flight.load(); } catch (e) { /* ignore */ } }
}
let roomShape = 'tall';                       // the shape of the room still on show (the wall's corners follow it)
function roomshotFor(slug) {
  roomShape = filmShape();
  const s = 'scene/office/' + slug + '_' + roomShape + '.jpg';
  if (roomshot.getAttribute('src') !== s) roomshot.setAttribute('src', s);
}
function flightPlay(slug, kind, done) {     // true if a film is on its way; false = do the live flight
  if (calm || flightBroken) return false;
  flightPrep(slug, kind);
  flightOn = { slug, kind, done, shown: false };
  try { flight.currentTime = 0; } catch (e) { /* not loaded yet */ }
  const p = flight.play();
  if (p && p.catch) p.catch(() => flightFail());
  flightWait = setTimeout(() => { if (flightOn && !flightOn.shown) flightFail(); }, 2500);
  return true;
}
function flightStop() {
  if (flightWait) { clearTimeout(flightWait); flightWait = null; }
  flightOn = null;
  flight.classList.remove('on');
  try { flight.pause(); } catch (e) { /* ignore */ }
}
function flightFail() {                     // this phone can't play it: the live flight, and no more films this visit
  const f = flightOn;
  flightBroken = true;
  ensureLive();
  flightStop();
  roomshot.classList.remove('on');
  if (!f) return;
  const seg = META.segments[f.slug];
  if (f.kind === 'in') startMove(seg.in[0], seg.in[1], { blend: 0.6, done: f.done, slug: f.slug, kind: 'in' });
  else startMove(seg.out[0], seg.out[1], { done: f.done, slug: f.slug, kind: 'out' });
}
flight.addEventListener('error', () => { if (flightOn) flightFail(); });
flight.addEventListener('ended', () => {
  if (!flightOn) return;
  const f = flightOn;
  if (flightWait) { clearTimeout(flightWait); flightWait = null; }
  flightOn = null;
  f.done();
});
window.addEventListener('resize', () => { if (state === 'curb') filmPrep(); });   // turned the phone in the seat

// ---------- the screen walls: the studio's service reels on each room's screen ----------
// The room still (the in-film's last frame) already shows the wall with each reel's first frame. In the room the same
// wall is laid over the screen in perspective (scene/office/walls.json: the screen's corners in the still, per shape,
// from render_ride.py; the three panels, from _source/screens) and the reels' muted web loops play on it.
// Reception keeps its rendered wordmark. No wall in calm mode or when the films can't play (no still to sit on).
const wallEl = $('wall');
let WALLS = null, wallSlug = null;
fetch('scene/office/walls.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => {
  WALLS = j;
  wallEl.style.width = j.tex[0] + 'px';
  wallEl.style.height = j.tex[1] + 'px';
  for (const [x, y, w, h] of j.panels) {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.setAttribute('disablepictureinpicture', '');
    Object.assign(v.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: j.radius + 'px' });
    wallEl.appendChild(v);
  }
  if (state === 'office' && openSlug) { wallShow(openSlug); renderPage(openSlug); }   // a deep link got here first
}).catch(() => { /* no walls: the still alone */ });

// ---------- the office pages ----------
// scene/office/pages.json holds the words (also read by _source/site/make_pages.py for each office's own page): the
// reels on the room's screen (thumb, title, what it shows), the lane's promise, blurb and what you get, the Amazon case
// link, and Start a project: a DM to Instagram with the room's word, or an email. No prices.
let PAGES = null;
fetch('scene/office/pages.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => {
  PAGES = j;
  if (state === 'office' && openSlug) renderPage(openSlug);
}).catch(() => { /* no copy: the page keeps its head */ });
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function renderPage(slug) {
  const pg = PAGES && PAGES.pages[slug];
  const work = $('owork'), gets = $('ogets'), links = $('olinks');
  work.textContent = ''; gets.textContent = ''; links.textContent = '';
  const letters = WALLS && WALLS.rooms[slug];
  if (pg && letters) {
    for (const k of letters) {
      const li = el('li'), img = el('img'), d = el('div');
      img.src = 'scene/office/reels/' + k + '.jpg';
      img.alt = ''; img.width = 40; img.height = 71; img.loading = 'lazy';
      d.append(el('b', null, PAGES.reels[k][0]), el('span', null, PAGES.reels[k][1]));
      li.append(img, d);
      work.appendChild(li);
    }
  }
  work.hidden = !work.children.length;
  $('opromise').textContent = pg ? pg.promise : '';
  $('oblurb').textContent = pg ? pg.blurb : '';
  for (const g of (pg && pg.gets) || []) gets.appendChild(el('li', null, g));
  const guard = $('oguard');
  guard.textContent = (pg && pg.guard) || '';
  guard.hidden = !(pg && pg.guard);
  for (const l of pg ? [pg.case, ...(pg.links || [])].filter(Boolean) : []) {
    const a = el('a', 'olink');
    a.href = l.url; a.target = '_blank'; a.rel = 'noopener';
    a.append(el('b', null, l.title), el('span', null, l.line));
    links.appendChild(a);
  }
  const word = pg ? pg.word : 'HELLO', ig = PAGES ? PAGES.ig : 'saibotstudioss', mail = PAGES ? PAGES.email : 'nastysaibot@me.com';
  const dm = $('odm');
  dm.href = 'https://ig.me/m/' + ig;
  dm.textContent = 'DM "' + word + '" on Instagram';
  $('omail').href = 'mailto:' + mail + '?subject=' +
    encodeURIComponent(slug === 'contact' ? 'Hello, from saibot.studio' : NAMES[slug] + ' project, from saibot.studio');
  $('onote').textContent = 'Instagram opens a chat with @' + ig + '. Send the word ' + word + ' and we take it from there.';
  $('ofine').hidden = slug !== 'contact';      // the credits link lives on Reception only (credits/index.html)
}
const wallVids = () => Array.from(wallEl.querySelectorAll('video'));
function wallPrep(slug) {                     // on the way in: the still and the three loops start loading
  if (!WALLS || !WALLS.rooms[slug] || calm || flightBroken) return false;
  wallEl.style.backgroundImage = 'url(scene/office/wall_' + slug + '.jpg)';
  wallVids().forEach((v, i) => {
    const s = 'scene/office/reels/' + WALLS.rooms[slug][i] + '.mp4';
    if (v.getAttribute('src') !== s) { v.preload = 'auto'; v.setAttribute('src', s); try { v.load(); } catch (e) { /* ignore */ } }
  });
  return true;
}
function wallShow(slug) {
  if (!wallPrep(slug)) { wallHide(); return; }
  wallSlug = slug;
  if (!wallPlace()) return;
  wallVids().forEach((v) => {
    try { v.currentTime = 0; } catch (e) { /* not loaded yet: it starts at 0 anyway */ }
    const p = v.play();
    if (p && p.catch) p.catch(() => { /* blocked: the still stays */ });
  });
  wallEl.classList.add('on');
}
function wallHide() {
  wallSlug = null;
  wallEl.classList.remove('on');
  wallVids().forEach((v) => { try { v.pause(); } catch (e) { /* ignore */ } });
  $('office').classList.remove('lit');
  $('ospace').style.height = '0px';
}
// the CSS transform that puts a w x h box onto the quad q (TL, TR, BR, BL, in px): square-to-quad (Heckbert), scaled
function quadMatrix(w, h, q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let g = 0, k = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    k = (dx1 * sy - sx * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  return 'matrix3d(' + [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].join(',') + ')';
}
function wallPlace() {                        // true when the wall sits on the screen (and the page opened its window)
  const quads = WALLS && WALLS.quads && WALLS.quads[roomShape];
  if (!wallSlug || !quads || !quads[wallSlug] || !WALLS.img[roomShape]) { wallEl.classList.remove('on'); return false; }
  const [iw, ih] = WALLS.img[roomShape];
  const r = roomshot.getBoundingClientRect();     // the still is object-fit: cover on this box
  const s = Math.max(r.width / iw, r.height / ih);
  const ox = r.left + (r.width - iw * s) / 2, oy = r.top + (r.height - ih * s) / 2;
  const p = quads[wallSlug].map(([x, y]) => [ox + x * s, oy + y * s]);
  wallEl.style.transform = quadMatrix(WALLS.tex[0], WALLS.tex[1], p);
  const o = $('office'), sp = $('ospace');
  const top = Math.min(p[0][1], p[1][1]);
  // phones: the room's set stands under the screen, so the window reaches halfway down what's left before the text
  const bot0 = Math.max(p[2][1], p[3][1]);
  const bot = bot0 + (r.height > r.width ? Math.round(Math.max(0, r.bottom - bot0) * 0.5) : 0);
  o.style.setProperty('--wTop', Math.round(top) + 'px');
  o.style.setProperty('--wBot', Math.round(bot) + 'px');
  o.classList.add('lit');
  sp.style.height = '0px';
  const y0 = sp.offsetTop;                  // where the text below would start without the gap (the page is inset 0;
  sp.style.height = Math.max(0, Math.round(bot + 14 - y0)) + 'px';   // offsetTop skips the page's rise animation)
  return true;
}
window.addEventListener('resize', () => { if (wallSlug) wallPlace(); });

// ---------- Step out, rendered ----------
// Step out plays scene/floor/stepout_<shape>.mp4 (render_ride.py orbit: from the seat up over the roof and round to
// the front-left), then the orbit is ORBIT_N Cycles stills round the car (scene/floor/orbit_<shape>/NNN.webp, 3 deg
// apart, still 0 = where the film lands; a drag picks the still). Get in swings back round to still 0 and plays
// getin_<shape>.mp4 (the same film reversed) into the seat, where the floor-18 360 takes over. The live camera keeps
// the still's angle so taps on offices still land; an office tapped out here gets back in first, then flies.
// Calm mode, or films that won't play here: the live orbit as before (orbitLive).
const ORBIT_N = 120, ORBIT_ANG0 = Math.PI + 0.65, ORBIT_STEP = (2 * Math.PI) / ORBIT_N;
const orbitCv = $('orbitshot'), orbitCtx = orbitCv.getContext('2d'), stepEl = $('stepfilm');
let orb = null, orbitLive = true, stepFilm = null, stepWait = null, orbSpin = null;
const orbitIdx = (a) => ((Math.round((a - ORBIT_ANG0) / ORBIT_STEP) % ORBIT_N) + ORBIT_N) % ORBIT_N;
function orbitLoad() {                        // this shape's stills, coarse to fine so a drag works early
  const shape = filmShape();
  if (orb && orb.shape === shape) return orb;
  const o = { shape, imgs: [], ok: new Set(), idx: orb ? orb.idx : 0, show: false };
  orb = o;
  const order = [];
  for (const s of [8, 4, 2, 1]) for (let i = 0; i < ORBIT_N; i += s) if (!order.includes(i)) order.push(i);
  let next = 0, active = 0;
  const pump = () => {
    while (active < 6 && next < order.length) {
      const i = order[next++];
      const im = new Image();
      active++;
      im.onload = () => {
        active--;
        const ready = () => { o.imgs[i] = im; o.ok.add(i); if (o === orb && (i === o.idx || o.drawn === undefined)) orbitDraw(); };
        if (im.decode) im.decode().then(ready, ready); else ready();
        pump();
      };
      im.onerror = () => { active--; pump(); };
      im.src = 'scene/floor/orbit_' + shape + '/' + String(i).padStart(3, '0') + '.webp';
    }
  };
  pump();
  return o;
}
function orbitDraw() {                        // the still for orb.idx (or the nearest one loaded), cover-fitted
  if (!orb) return false;
  let j = -1;
  for (let d = 0; d <= ORBIT_N / 2 && j < 0; d++) {
    if (orb.ok.has((orb.idx + d) % ORBIT_N)) j = (orb.idx + d) % ORBIT_N;
    else if (orb.ok.has((orb.idx - d + ORBIT_N) % ORBIT_N)) j = (orb.idx - d + ORBIT_N) % ORBIT_N;
  }
  const first = orb.show && !orbitCv.classList.contains('on');
  if (j < 0 || (first && j !== orb.idx)) return false;          // the hand-off from the film needs the exact still
  const im = orb.imgs[j], dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
  if (orbitCv.width !== w || orbitCv.height !== h) { orbitCv.width = w; orbitCv.height = h; }
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  orbitCtx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  orb.drawn = j;
  if (first) {                                // the film's last frame = still 0: swap under it, then lift the film
    orbitCv.classList.add('on');
    setTimeout(() => { if (!stepFilm) stepEl.classList.remove('on'); }, 170);
  }
  return true;
}
function stepPrep() {                         // on the floor: the step-out film loads ahead of the tap
  if (calm || flightBroken) return;
  const src = 'scene/floor/stepout_' + filmShape() + '.mp4';
  if (stepEl.getAttribute('src') !== src) { stepEl.setAttribute('src', src); try { stepEl.load(); } catch (e) { /* ignore */ } }
}
function stepPlay(kind, done) {               // 'out' = step out, 'in' = get in; true if a film is on its way
  if (calm || flightBroken) return false;
  const src = 'scene/floor/' + (kind === 'out' ? 'stepout' : 'getin') + '_' + filmShape() + '.mp4';
  if (stepEl.getAttribute('src') !== src) { stepEl.setAttribute('src', src); try { stepEl.load(); } catch (e) { /* ignore */ } }
  stepFilm = { kind, done, shown: false };
  try { stepEl.currentTime = 0; } catch (e) { /* not loaded yet: it starts at 0 */ }
  const p = stepEl.play();
  if (p && p.catch) p.catch(() => stepFail());
  clearTimeout(stepWait);
  stepWait = setTimeout(() => { if (stepFilm && !stepFilm.shown) stepFail(); }, 2500);
  return true;
}
function stepFail() {                         // the films won't play here: the live orbit, as before, for this visit
  const f = stepFilm;
  stepFilm = null;
  ensureLive();
  clearTimeout(stepWait);
  flightBroken = true;
  orbitLive = true;
  stepEl.classList.remove('on');
  orbitCv.classList.remove('on');
  try { stepEl.pause(); } catch (e) { /* ignore */ }
  if (!f) return;
  viewTween = { t0: performance.now(), dur: 1200, to: f.kind === 'out' ? 'orbit' : 'seat', fromP: camera.position.clone(),
    fromQ: camera.quaternion.clone() };
  if (f.kind === 'in') { floorView = 'seat'; renderView(); setTimeout(() => f.done(true), 1250); }
}
stepEl.addEventListener('ended', () => {
  if (!stepFilm) return;
  const f = stepFilm;
  stepFilm = null;
  clearTimeout(stepWait);
  f.done(false);
});
stepEl.addEventListener('error', () => { if (stepFilm) stepFail(); });
function stepOut() {
  floorView = 'orbit';
  orbit.ang = ORBIT_ANG0; orbit.el = 0.3; orbit.r = 6.0;   // every step out lands front-left, where the stills start
  lastTouch = performance.now();
  orbitLive = calm || flightBroken;
  if (!orbitLive) {
    const o = orbitLoad();
    o.idx = 0;
    o.show = false;
    if (stepPlay('out', () => { o.show = true; orbitDraw(); })) { renderView(); return; }
    orbitLive = true;
  }
  viewTween = { t0: performance.now(), dur: 1200, to: 'orbit', fromP: camera.position.clone(), fromQ: camera.quaternion.clone() };
  renderView();
}
function getIn(then) {                        // back into the seat; then(): what comes next (an office's flight)
  const land = (live) => {                    // the film ends in the seat: the 360 takes over, no crossfade
    floorView = 'seat';
    if (!live) viewTween = null;
    yaw = 0; pitch = 0; yawGoal = null; panoK = 1;
    lastTouch = performance.now();
    if (orb) orb.show = false;
    orbitCv.classList.remove('on');
    renderView();
    setTimeout(() => { if (!stepFilm) stepEl.classList.remove('on'); }, 120);
    if (then) then();
  };
  if (orbitLive || !orb) {
    viewTween = { t0: performance.now(), dur: 1200, to: 'seat', fromP: camera.position.clone(), fromQ: camera.quaternion.clone() };
    floorView = 'seat'; yaw = 0; pitch = 0; yawGoal = null;
    lastTouch = performance.now();
    renderView();
    if (then) setTimeout(then, 1250);
    return;
  }
  orbSpin = { then: () => { if (!stepPlay('in', land)) land(true); } };     // round to still 0, then the film
}
function stepSpin(dt) {                       // Get in: swing back round to still 0 the short way, fast
  if (!orb) { const s = orbSpin; orbSpin = null; s.then(); return; }
  const left = orb.idx === 0 ? 0 : orb.idx <= ORBIT_N / 2 ? -orb.idx : ORBIT_N - orb.idx;
  if (left === 0) { const s = orbSpin; orbSpin = null; s.then(); return; }
  const st = Math.sign(left) * Math.min(Math.abs(left), Math.max(1, Math.round(dt * 180)));
  orb.idx = (orb.idx + st + ORBIT_N) % ORBIT_N;
  orbitDraw();
}
window.addEventListener('resize', () => {
  if (state === 'floor' && floorView === 'orbit' && !orbitLive) { orbitLoad(); orbitDraw(); }
});

// ---------- the Wet neon night look ----------
const NOISE = `
float nh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nv(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(nh(i), nh(i + vec2(1.0, 0.0)), u.x), mix(nh(i + vec2(0.0, 1.0)), nh(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { return 0.5 * nv(p) + 0.25 * nv(p * 2.03) + 0.125 * nv(p * 4.01) + 0.0625 * nv(p * 8.02); }
float puddle(vec2 xz) { return smoothstep(0.47, 0.52, fbm(xz * 0.16)); }`;
const WORLD_VARY = (sh, v) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 ' + v + ';')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + v + ' = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 ' + v + ';' + NOISE);
};
function wetGround(m) {            // puddles: mirror-smooth and darker; the rest damp
  if (!m) return;
  m.onBeforeCompile = (sh) => {
    WORLD_VARY(sh, 'vWG');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat wetP = puddle(vWG.xz);\ndiffuseColor.rgb *= mix(1.0, 0.42, wetP);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.04, wetP);');
  };
  m.needsUpdate = true;
}
function facadeMaterial() {        // dark glass, a mullion grid (1.6 m x one floor) and offices lit at random
  const m = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.06, metalness: 0.0 });
  m.name = 'facade';
  m.onBeforeCompile = (sh) => {
    WORLD_VARY(sh, 'vFW');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
float fu = vFW.x - vFW.z, fv = vFW.y;
float mull = max(step(abs(fract(fu / 1.6 + 0.5) - 0.5) * 1.6, 0.045), step(abs(fract(fv / 4.0 + 0.5) - 0.5) * 4.0, 0.08));
roughnessFactor = mix(roughnessFactor, 0.35, mull);`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.85, mull);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float cellR = nh(floor(vec2(fu / 1.6, fv / 4.0)) + 0.37);
float litC = max(step(0.8, cellR) * (0.4 + 0.8 * cellR), step(fv, 4.0) * 0.5);
totalEmissiveRadiance += vec3(1.0, 0.77, 0.54) * litC * 0.12 * (1.0 - mull);`);
  };
  return m;
}
const WET_STREET = {               // the street mirror: only the bright things (layer 1), broken up where it is damp
  name: 'WetStreet',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uStrength: { value: 0.5 } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
void main() { vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uStrength; varying vec4 vUv; varying vec3 vW;${NOISE}
void main() {
  float wet = puddle(vW.xz);
  vec4 uv = vUv;
  uv.xy += (vec2(nv(vW.xz * 3.1), nv(vW.zx * 3.3)) - 0.5) * 0.02 * (1.0 - wet) * uv.w;
  vec3 r = texture2DProj(tDiffuse, uv).rgb;
  gl_FragColor = vec4(r * color * uStrength * mix(0.22, 1.0, wet), 1.0);
}`,
};
async function neonLook(root) {
  const mats = {};
  root.traverse((o) => { if (o.isMesh && o.material) mats[o.material.name] = o.material; });
  const set = (name, p) => {
    const m = mats[name];
    if (!m) return null;
    for (const [k, v] of Object.entries(p)) { if (k === 'color' || k === 'emissive') m[k].set(v); else m[k] = v; }
    m.needsUpdate = true;
    return m;
  };
  const emis = (name, col, k) => set(name, { color: '#000000', emissive: col, emissiveIntensity: k, roughness: 0.4, metalness: 0 });
  const glass = (name, col, a) => set(name, { color: col, opacity: a, transparent: true, roughness: 0.04, metalness: 0, depthWrite: false });
  set('M_ground', { color: '#050507', roughness: 0.3, metalness: 0 });
  wetGround(set('M_asphalt', { color: '#1b1c22', roughness: 0.32, metalness: 0 }));
  wetGround(set('M_sidewalk', { color: '#2a2b31', roughness: 0.42, metalness: 0 }));
  set('M_lane', { color: '#6f6f6a', roughness: 0.4 });
  const fac = facadeMaterial();
  root.traverse((o) => { if (o.isMesh && ['M_tower', 'M_window_lit', 'M_window_dark', 'M_band'].includes(o.material.name)) o.material = fac; });
  set('M_skyline', { color: '#0b0c12', roughness: 0.6 });
  emis('M_city_light', '#FFB070', 1.4);
  set('M_water', { color: '#05080c', roughness: 0.08 });
  set('M_shaft', { color: '#0a0a0c', roughness: 0.35, metalness: 0.85 });
  glass('M_glass_shaft', '#DDEBFF', 0.12);
  glass('M_cab_glass', '#F0F6FF', 0.16);
  set('M_cab_frame', { color: '#0a0a0c', roughness: 0.3, metalness: 0.9 });
  set('M_cab_floor', { color: '#151518', roughness: 0.12 });
  emis('M_cab_light', '#FFF0D8', 1.3);
  emis('M_cab_glow', '#F2F6FF', 0.75);
  emis('M_neon_pink', '#FF2E88', 2.2);
  emis('M_neon_cyan', '#29D8FF', 2.0);
  emis('M_neon_volt', '#D9FF3F', 1.2);
  emis('M_lamp_head', '#FFB066', 2.5);
  set('M_lamp_pole', { color: '#121214', roughness: 0.4, metalness: 0.6 });
  cabGlow = root.getObjectByName('cab_glow');
  // the bright things also live on layer 1: the street reflects only them (cheap on phones)
  for (const n of ['neon', 'lamps', 'cab_body', 'cab_glow']) {
    const o = root.getObjectByName(n);
    if (o) o.traverse((c) => c.layers.enable(1));
  }
  // the Tigre wordmark, lit, on the shaft above the cab
  const anchor = root.getObjectByName('sign_wordmark');
  if (anchor) {
    const tex = await new THREE.TextureLoader().loadAsync('brand/saibot-studio-wordmark.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const w = 5.0, h = w * tex.image.height / tex.image.width;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
    anchor.getWorldPosition(sign.position);
    sign.layers.enable(1);
    scene.add(sign);
  }
  // warm street lamps, pink and cyan spill from the neon (no shadows: cheap)
  for (let i = 0; i < 4; i++) {
    const e = root.getObjectByName('lamp_light_' + i);
    if (!e) continue;
    const s = new THREE.SpotLight(0xffb066, 55, 16, 1.0, 0.75, 2.0);
    e.getWorldPosition(s.position);
    s.target.position.copy(s.position).add(new THREE.Vector3(0, -6, 0));
    scene.add(s, s.target);
  }
  for (const [x, col, k] of [[-3.42, 0xff2e88, 7], [3.42, 0xff2e88, 7], [0, 0x29d8ff, 4]]) {
    const p = new THREE.PointLight(col, k, 14, 2.0);
    p.position.copy(b2t([x, -8.9, x === 0 ? 4.0 : 1.6]));
    scene.add(p);
  }
  // the wet street: a low-res mirror of layer 1, added on top of the asphalt (puddles strongest)
  const street = new Reflector(new THREE.PlaneGeometry(90, 40), { shader: WET_STREET, textureWidth: 512, textureHeight: 512,
    multisample: 0, color: 0xffffff, clipBias: 0.003 });
  street.material.transparent = true;
  street.material.blending = THREE.AdditiveBlending;
  street.material.depthWrite = false;
  street.rotation.x = -Math.PI / 2;
  street.position.copy(b2t([0, -17, 0.004]));
  scene.add(street);
  street.getReflectionCamera(camera).layers.set(1);
}

// ---------- the Saibot car (locked 11/15): rides on the gray box's animated 'car' node ----------
async function loadCar(onProgress) {
  let g;
  try { g = await loadGlb('scene/car.glb', onProgress); }
  catch (err) { console.warn('car.glb did not load; the gray-box car stays', err); return; }
  realCar = g.scene;
  carNode.add(realCar);
  for (const n of ['car_body', 'car_lights']) { const o = carNode.getObjectByName(n); if (o) o.visible = false; }
  for (const k of ['fl', 'fr', 'rl', 'rr']) {
    const gw = carNode.getObjectByName('car_wheel_' + k), rw = realCar.getObjectByName('wheel_' + k);
    if (gw) gw.visible = false;                                   // still animated: the real wheel copies its spin
    if (gw && rw) wheels.push([gw, rw]);
  }
  realCar.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      if (m.name === 'EXT_Glass_Emissive_Front') car.head = m;
      else if (m.name === 'EXT_Glass_Emissive_Rear') car.tail = m;
      else if (m.name === 'SAIBOT_start_led') car.led = m;
      else if (m.name === 'DISPLAY' || m.name === 'DISPLAY_SAS' || m.name === 'INT_LED') (car.dash = car.dash || []).push(m);
    }
  });
  for (const m of car.dash || []) { if (m.map) m.emissiveMap = m.map; m.emissive.set(0xffffff); m.emissiveIntensity = 0.35; m.needsUpdate = true; }
  if (car.head) car.head.emissive.set(0xf4f7ff);
  if (car.tail) car.tail.emissive.set(0xff1a12);
  if (car.led) car.led.emissive.set(0xff5f00);
  const fill = new THREE.PointLight(0xb9c8ff, 0.7, 1.8, 2);      // a dim light over the dash so the cockpit reads
  fill.position.copy(b2t([-0.25, 0.05, 1.05]));
  realCar.add(fill);
  startObj = realCar.getObjectByName('start_button');
}

// ---------- load ----------
async function load() {
  META = await (await fetch('scene/tower.json', { cache: 'no-cache' })).json();
  RIDE_END = META.ride.end;
  gauge(0.15);
  const progress = (from, span, bytes) => (e) => {
    const total = e.total || bytes;
    gauge(from + span * Math.min(1, e.loaded / total));
  };
  // (index.html preloads car.glb, so it downloads while the tower sets up)
  const gltf = await loadGlb('scene/tower.glb', progress(0.15, 0.2, META.glb_bytes || 6e5));
  const root = gltf.scene;
  scene.add(root);
  camNode = root.getObjectByName('cam');
  cabNode = root.getObjectByName('cab');
  carNode = root.getObjectByName('car');

  // one clip: the Blender export has one track set per object, all on the same 0-38.5 s clock
  const clip = new THREE.AnimationClip('tower', -1, gltf.animations.flatMap((a) => a.tracks));
  DUR = clip.duration;
  mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();

  const glow = (m, k) => { m.emissive.copy(m.color); m.emissiveIntensity = k; return m; };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.material && o.material.name;
    if (n === 'M_lightbar') fx.lightbar = glow(o.material, 0.15);
    if (n === 'M_headlight') fx.headlight = glow(o.material, 0.1);
    if (n === 'M_taillight') fx.taillight = glow(o.material, 0.2);
    if (n === 'M_ring') { fx.ring = glow(o.material, 0.2); fx.ring.color.set(0x000000); }   // pure neon: the studio lamp would light volt paint into a green bloom
  });
  for (const m of META.offices) {
    const r = root.getObjectByName('office_' + m.slug);
    const o = { slug: m.slug, label: m.label, room: m.room, hi: 0, center: new THREE.Vector3() };
    r.traverse((c) => {
      if (!c.isMesh) return;
      const n = c.material.name;
      if (n === 'M_trim') c.material = o.trim = glow(c.material.clone(), 0.08);        // own copy per office
      else if (n === 'M_label') c.material = o.label3d = glow(c.material.clone(), 0.25);
      else if (n.startsWith('M_screen')) c.material = o.screen = glow(c.material.clone(), 0.05);
    });
    o.hit = root.getObjectByName('hit_' + m.slug);
    o.hit.visible = false;                  // invisible, still catches the ray
    o.hit.userData.slug = m.slug;
    hitList.push(o.hit);
    offices[m.slug] = o;
  }
  root.updateMatrixWorld(true);
  for (const o of Object.values(offices)) {
    o.hit.parent.getWorldPosition(o.center);
    o.hit.geometry.computeBoundingBox();
    o.tap = o.hit.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(o.hit.matrixWorld);
  }
  F.eye = b2t(META.floor.eye);
  F.target = b2t(META.floor.target);
  F.fwd = F.target.clone().sub(F.eye).normalize();
  F.right = new THREE.Vector3(-F.fwd.z, 0, F.fwd.x).normalize();
  await tigreSigns(root);
  await neonLook(root);
  gauge(0.4);
  $('gcap').textContent = 'Bringing the car around';
  // speed pass (11/16): the real car (3.8 MB) and the street's reflections (1.6 MB) only matter to live 3D, which only
  // calm mode or a film that won't play ever shows; everyone else sees films, 360s and stills. The floor-18 360 waits
  // until the curb is up, unless you land on the floor (returning) or in an office (a link).
  const floorNow = store.get(VISITED) === '1' || !!slugFromHash() || !!START_OFFICE;
  await Promise.all([calm ? ensureLive(progress(0.4, 0.45, 4.5e6)) : null, loadPano(floorNow)]);
  studioLamp.position.copy(b2t([0, 16, META.studio_z + 8.2]));
  studioLamp.target.position.copy(b2t([0, 16, META.studio_z]));
  setClip(0);
  carNode.getWorldPosition(carCenter);
  carCenter.y += 0.7;
  scene.updateMatrixWorld(true);
  if (startObj) new THREE.Box3().setFromObject(startObj).getCenter(startAt);   // START on the wheel (the car is parked)
  else carNode.localToWorld(startAt.copy(START_LOCAL));                        // (the same spot, without the car file)
  poseFromClip();
  camera.fov = fovFor('cockpit');
  camera.updateProjectionMatrix();
  $('gcap').textContent = 'Warming up';
  if (calm) {                                // live 3D from the first frame: compile it now
    await renderer.compileAsync(scene, camera);
    composer.render();
  }
  gauge(1);
}
let livePromise = null, pano18Promise = null;
function ensureLive(onProgress) {           // the real car + the street's reflections, once, when live 3D will show
  if (!livePromise) {
    livePromise = Promise.all([loadCar(onProgress || (() => {})), loadEnv('scene/env_neon.hdr')])
      .then(() => scene.updateMatrixWorld(true))
      .catch((err) => console.warn('live 3D files', err));
  }
  return livePromise;
}

// the 3D office signs: swap Blender's placeholder text meshes for flat Tigre signs (same pre-rendered images)
async function tigreSigns(root) {
  const tl = new THREE.TextureLoader();
  await Promise.all(Object.values(offices).map(async (o) => {
    const old = root.getObjectByName(o.slug + '_label');
    if (!old) return;
    const tex = await tl.loadAsync('type/' + o.slug + '.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    old.geometry.computeBoundingBox();
    const mid = old.geometry.boundingBox.getCenter(new THREE.Vector3());
    const aspect = tex.image.width / tex.image.height;
    let h = o.slug === 'contact' ? 0.8 : 0.95, w = h * aspect;
    if (w > 5.0) { w = 5.0; h = w / aspect; }                        // never wider than the office front
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.02, toneMapped: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    sign.name = o.slug + '_sign';
    sign.position.copy(old.position).add(mid);
    sign.quaternion.copy(old.quaternion);
    old.parent.add(sign);
    old.visible = false;
    o.label3d = mat;
  }));
}

function noGL() {
  $('doorstep').hidden = true;
  $('links').hidden = false;
  $('links').querySelector('h2').textContent = '3D did not start here. The offices:';
}

// ---------- timeline + camera ----------
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _d = new THREE.Vector3(), _r = new THREE.Vector3(), _t = new THREE.Vector3(), _qy = new THREE.Quaternion();
let lastSet = -1;
function setClip(t) {
  const tt = Math.max(0, Math.min(t, DUR - 1e-3));
  if (tt !== lastSet) { mixer.setTime(tt); lastSet = tt; }
}
function poseFromClip() {
  camNode.updateWorldMatrix(true, false);
  camNode.matrixWorld.decompose(_p, _q, _s);
  camera.position.copy(_p);
  camera.quaternion.copy(_q);
}
function cockpitSway(now, k = 1) {          // the driver's seat: the head moves a little
  camera.rotateY(k * 0.010 * Math.sin(now / 2300));
  camera.rotateX(k * 0.006 * Math.sin(now / 3100 + 1.3));
}
const _sp = new THREE.Vector3(), _sr = new THREE.Vector3();
function placeStart() {                     // pin the START ring over the 3D button on the wheel
  _sp.copy(startAt).project(camera);
  _sr.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(START_R).add(startAt).project(camera);
  const W = window.innerWidth, H = window.innerHeight;
  const away = _sp.z > 1 || Math.abs(_sp.x) > 1.25 || Math.abs(_sp.y) > 1.25;     // looking away from the wheel
  startBtn.style.visibility = away ? 'hidden' : '';
  if (away) return;
  const x = ((_sp.x + 1) / 2) * W, y = ((1 - _sp.y) / 2) * H;
  const r = Math.hypot((_sr.x - _sp.x) * W / 2, (_sr.y - _sp.y) * H / 2);
  const d = Math.max(76, r * 2 * 1.7);
  startBtn.style.left = x.toFixed(1) + 'px';
  startBtn.style.top = y.toFixed(1) + 'px';
  startBtn.style.width = startBtn.style.height = d.toFixed(0) + 'px';
  startBtn.style.margin = (-d / 2).toFixed(0) + 'px 0 0 ' + (-d / 2).toFixed(0) + 'px';
}
function floorPose(dt, now) {
  if (!viewTween) { (floorView === 'orbit' ? orbitPose : seatPose)(dt, now); return; }
  // stepping out (or back in): up through the roof on a curve over the car, the gaze turning on the way
  const k = smooth(Math.min(1, (now - viewTween.t0) / viewTween.dur));
  (viewTween.to === 'orbit' ? orbitPose : seatPose)(0, now);           // where it lands
  _tp.copy(camera.position);
  _tq.copy(camera.quaternion);
  carNode.getWorldPosition(_mid);
  _mid.y += 2.6;
  const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
  camera.position.set(a * viewTween.fromP.x + b * _mid.x + c * _tp.x, a * viewTween.fromP.y + b * _mid.y + c * _tp.y,
    a * viewTween.fromP.z + b * _mid.z + c * _tp.z);
  camera.quaternion.slerpQuaternions(viewTween.fromQ, _tq, k);
  if (k >= 1) viewTween = null;
}
function orbitPose(dt, now) {               // stepped out: a camera circling the car (drag; it turns slowly when left alone)
  carNode.getWorldPosition(orbitC);
  orbitC.y += 0.75;
  if (!orbitLive && orb) {                  // the rendered stills: the camera sits where the still was shot (taps land)
    orbit.ang = ORBIT_ANG0 + orb.idx * ORBIT_STEP; orbit.el = 0.3; orbit.r = 6.0;
  } else if (dt > 0 && now - lastTouch > 4000 && !calm) orbit.ang += dt * 0.12;
  const ce = Math.cos(orbit.el);
  camera.position.set(orbitC.x + orbit.r * ce * Math.sin(orbit.ang), orbitC.y + orbit.r * Math.sin(orbit.el),
    orbitC.z + orbit.r * ce * Math.cos(orbit.ang));
  camera.up.set(0, 1, 0);
  camera.lookAt(orbitC);
}
function renderView() {
  const seat = floorView === 'seat';
  $('viewbtn').textContent = seat ? 'Step out' : 'Get in';
  $('viewbtn').setAttribute('aria-label', seat ? 'Step out of the car' : "Get back in the driver's seat");
  $('hint').textContent = seat ? (finePointer ? 'Hover an office, click to go in, drag to look' : 'Tap an office, drag to look')
    : (finePointer && orbitLive ? 'Drag to walk around the car, scroll to zoom' : 'Drag to walk around the car');
}
function seatPose(dt, now) {                // floor 18 from the driver's seat: the head turns, the car stays put
  if (yawGoal !== null) {
    yaw += (yawGoal - yaw) * (1 - Math.exp(-dt * 5));
    if (Math.abs(yawGoal - yaw) < 1e-3) yawGoal = null;
  }
  const idle = now - lastTouch > 5000 && !lit && !calm;
  sway += ((idle ? 1 : 0) - sway) * (1 - Math.exp(-dt * 0.7));
  const y = yaw + sway * 0.07 * Math.sin(now / 3800);
  camera.position.copy(F.eye);                       // floor 18 from the driver's seat: the head turns, the car stays put
  _d.copy(F.fwd).applyAxisAngle(Y, -y);
  _r.set(-_d.z, 0, _d.x).normalize();
  tilt += (1 - tilt) * (1 - Math.exp(-dt * 3));                     // eased in, so the hand-off from the clip never jumps
  _d.applyAxisAngle(_r, pitch + (camera.aspect < 1 ? -0.07 * tilt : 0));   // tall phones: a touch more floor, less ceiling
  camera.up.set(0, 1, 0);
  camera.lookAt(_t.copy(camera.position).add(_d));
}
const clampYaw = (v) => Math.max(-1.65, Math.min(1.65, v));        // out the side windows to the end offices
const clampPitch = (v) => Math.max(-0.45, Math.min(0.35, v));
function yawFor(slug) {
  const c = offices[slug].center;
  _d.set(c.x - F.eye.x, 0, c.z - F.eye.z).normalize();
  _t.set(F.fwd.x, 0, F.fwd.z).normalize();
  return clampYaw(Math.atan2(_d.dot(F.right), _d.dot(_t)));
}

// ---------- fades (calm mode) ----------
const fadeEl = $('fade');
let busy = false;                             // a fade is mid-way: ignore taps until it lands
function fadeTo(on) { fadeEl.style.transition = ''; fadeEl.style.opacity = ''; fadeEl.classList.toggle('on', on); }
function fadeThen(fn) {
  busy = true;
  fadeTo(true);
  setTimeout(() => { busy = false; fn(); requestAnimationFrame(() => requestAnimationFrame(() => fadeTo(false))); }, 330);
}
function fadeAlpha(a) { fadeEl.style.transition = 'none'; fadeEl.style.opacity = String(a); }
// calm: three held shots (the driver's seat, the arrival, the floor) joined by fades
const CALM_A = 2.8, calmB = () => META.ride.arrival[0] + 0.6;
function calmClip(t) { return t < CALM_A ? 0 : t < calmB() ? META.ride.arrival[0] : RIDE_END; }
function calmFade(t) { const d = Math.min(Math.abs(t - CALM_A), Math.abs(t - calmB())); return d < 0.3 ? 1 - d / 0.3 : 0; }

// ---------- HUD ----------
function setState(s) {
  state = s;
  $('curb').hidden = s !== 'curb';
  $('ride').hidden = s !== 'ride';
  $('skip').hidden = !(s === 'ride' || s === 'move');
  $('floor').hidden = s !== 'floor';
  $('bar').hidden = !(s === 'curb' || s === 'floor' || s === 'office');
  if (s !== 'floor') $('card').hidden = true;
  if (s !== 'ride') $('panel').hidden = true;
  canvas.style.cursor = s === 'floor' ? 'grab' : '';
  tag(true);
}
const pgrid = $('pgrid');
for (const slug of ORDER) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.slug = slug;
  const im = document.createElement('img');
  im.src = 'type/' + slug + '.png';
  im.alt = NAMES[slug];
  b.appendChild(im);
  pgrid.appendChild(b);
}
pgrid.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || state !== 'ride') return;
  queued = queued === b.dataset.slug ? null : b.dataset.slug;
  renderPanel();
  sound.ui('panel');
  if (queued) { flightPrep(queued, 'in'); roomshotFor(queued); }     // its flight loads during the climb
});
function renderPanel() {
  for (const b of pgrid.children) b.classList.toggle('on', b.dataset.slug === queued);
  $('plined').textContent = queued ? 'Lined up: ' + NAMES[queued] + '. Straight there on arrival.' : '';
}
let shownFloor = -1;
function floorCounter(rideT) {
  cabNode.getWorldPosition(_p);
  const f = Math.max(1, Math.min(99, 1 + Math.floor(_p.y / META.floor_h + 1e-3)));
  const arrived = rideT >= META.ride.arrival[0];
  const key = f * 10 + (arrived ? 1 : 0);
  if (key === shownFloor) return;
  shownFloor = key;
  $('floorno').querySelector('b').textContent = String(f).padStart(2, '0');
  $('flogo').hidden = !arrived;                // arrival: the wordmark joins the floor number
}
function renderSnd() {                       // sound on: the pill is the car radio (its station, an LED on the 808)
  const on = sound.running && !sound.muted, b = $('snd'), st = STATIONS[sound.station];
  b.classList.toggle('on', on);
  b.classList.toggle('radio', on);
  if (on) b.innerHTML = '<i class="led" aria-hidden="true"></i>' + st.name.split(' ')[0];
  else b.textContent = 'Sound off';
  b.setAttribute('aria-label', on ? `Car radio: ${st.name}. Open the radio` : 'Sound off. Turn on sound and the car radio');
}
let tagAt = 0, fpsNow = 0;
// the build/fps line is for testing: hidden on saibot.studio unless the address has ?dbg (the test link and local
// servers always show it). A lost graphics context still shows its message there.
const TAG_ON = !/(^|\.)saibot\.studio$/.test(location.hostname) || /[?&]dbg\b/.test(location.search);
$('tag').hidden = !TAG_ON;
function tag(force) {
  if (!TAG_ON) return;
  const now = performance.now();
  if (!force && now - tagAt < 500) return;
  tagAt = now;
  const a = frames.all.slice(-60);
  if (a.length) fpsNow = 1000 / (a.reduce((x, y) => x + y, 0) / a.length);
  $('tag').textContent = `build ${BUILD} · ${state === 'curb' ? 'seat' : state} · sound ${sound.muted ? 'muted' : sound.state} · ${fpsNow ? fpsNow.toFixed(0) + ' fps' : ''}${calm ? ' · calm' : ''}`;
}
sound.on(() => {
  renderSnd();
  if (sound.running && sound.wantAmb) sound.ambient(true);
  if (sound.running && sound.wantStereo) sound.stereo(true);
  tag(true);
});
// the car stereo (the 808 beat), heard from where the camera is: [in the car 0..1, away in an office 0..1]
function stereoPose(rideT, now) {
  if (state === 'curb') return [1, 0];
  if (state === 'ride') {                     // out through the roof at 1.0 s, back in the seat at IN_SEAT (as the film)
    const t = rideT || 0;
    return [1 - smooth((t - META.ride.pullout[0]) / 0.6) * (1 - smooth((t - IN_SEAT) / 0.5)), 0];
  }
  if (state === 'floor') {
    if (stepFilm) {                           // the step-out / get-in film: out of the car halfway through, or back in
      const u = clamp01(stepEl.currentTime / (stepEl.duration || 1.23));
      return [stepFilm.kind === 'out' ? 1 - smooth(u / 0.5) : smooth((u - 0.5) / 0.5), 0];
    }
    if (viewTween) {
      const k = smooth(Math.min(1, (now - viewTween.t0) / viewTween.dur));
      return [viewTween.to === 'orbit' ? 1 - k : k, 0];
    }
    return [floorView === 'seat' ? 1 : 0, 0];
  }
  if (state === 'move' && flightOn) {        // an office flight film: the same, on the film's clock
    const u = clamp01(flight.currentTime / (flight.duration || 1.5));
    return flightOn.kind === 'in' ? [1 - smooth(u / 0.3), u] : [smooth((u - 0.7) / 0.3), 1 - u];
  }
  if (state === 'move' && move) {            // flying to an office (out of the car) or back to the seat
    const u = clamp01((clipT - move.a) / (move.b - move.a));
    return move.kind === 'in' ? [1 - smooth(u / 0.3), u] : [smooth((u - 0.7) / 0.3), 1 - u];
  }
  if (state === 'office') return [0, 1];
  return [1, 0];
}

// ---------- the driver's seat + START (state 'curb' kept from the gray box) ----------
function enterCurb() {
  move = null; queued = null; lights = { mode: 'ride', t0: 0 }; clipT = 0;
  setLit(null);
  seatYaw = 0; seatPitch = 0; seatDrag = null;
  $('seathint').classList.remove('gone');
  setState('curb');
  canvas.style.cursor = 'grab';
  sound.ambient(true, 'seat');           // rain on the roof (heard once sound is unlocked: replay, or a tap before START)
  sound.stereo(true);                    // the car stereo: the 808 beat (starts with the first tap, never restarts)
  filmPrep();                            // the ride film starts downloading while you look around
}
const startBtn = $('start');
let armed = false;
startBtn.addEventListener('pointerdown', () => { armed = true; });
function tryStart() {
  if (state !== 'curb') return;
  sound.wake();                 // inside the lift, before anything else
  startRide();
}
startBtn.addEventListener('pointerup', () => { if (armed) { armed = false; tryStart(); } });
startBtn.addEventListener('click', tryStart);                 // keyboard + any browser that skips pointerup
startBtn.addEventListener('pointercancel', () => { armed = false; });

function startRide() {
  // the ride starts first; sound can never hold it back
  queued = null;
  sound.loadLate();                          // the floor room sound (and the live ride's mix) for when we land
  loadPano18();
  lights = { mode: 'ride', t0: 0 };
  seatFrom.copy(camera.quaternion);       // wherever you were looking: the head turns back to the road
  camNode.getWorldQuaternion(_q);
  filmTurn = seatFrom.angleTo(_q) > 0.05;
  seatBlend = true;
  seatYaw = 0; seatPitch = 0; seatDrag = null;
  rideStart = performance.now();
  frames.ride = [];
  setState('ride');
  renderPanel();
  sound.ambient(false);
  if (!filmStart()) sound.ride(0);         // the film carries the ride's sound itself
}
function finishRide() {
  if (filmOn) {                          // the film fades straight into the 360 on 18; its sound runs out underneath
    filmOn = false; filmShown = false; film.classList.add('out');
    panoK = 1;
  }
  store.set(VISITED, '1');
  lights = { mode: 'on', t0: 0 };
  if (calm) fadeTo(false);
  if (queued) { const s = queued; queued = null; flyIn(s, { fromRide: true }); }
  else enterFloor({});
}

// ---------- Skip: finish whatever is playing ----------
$('skip').addEventListener('click', skip);
$('skipcurb').addEventListener('click', () => { if (state !== 'curb') return; store.set(VISITED, '1'); enterFloor({ quick: true }); });
function skip() {
  if (state === 'ride') {
    sound.stopRide();
    filmOff();
    store.set(VISITED, '1');
    fadeTo(false);
    if (queued) { const s = queued; queued = null; snapToOffice(s); }
    else enterFloor({ quick: true });
  } else if (state === 'move' && move) {
    const m = move;
    move = null;
    clipT = m.b;
    m.done();
  } else if (state === 'move' && flightOn) {          // an office flight film: jump to its end ('ended' finishes it)
    try { flight.currentTime = Math.max(0, (flight.duration || 1.5) - 0.02); } catch (e) { /* ignore */ }
  }
}

// ---------- the floor ----------
function enterFloor({ quick = false } = {}) {
  move = null;
  loadPano18().then(() => { if (!pano18) ensureLive(); });   // no 360 on 18: the live floor needs its car
  clipT = RIDE_END;            // car parked, every door shut; the camera comes from floorPose()
  yaw = 0; pitch = 0; yawGoal = null; tilt = 0; lastTouch = performance.now();
  if (quick) { lights = { mode: 'quick', t0: performance.now() }; sound.lightsUp(); }
  else if (lights.mode === 'ride') lights = { mode: 'on', t0: 0 };
  setState('floor');
  sound.ambient(true, 'floor');
  sound.stereo(true);
  floorView = 'seat';                    // every arrival on 18 (ride, Back, reload) lands in the driver's seat
  viewTween = null;
  stepFilm = null; orbSpin = null; orbitLive = true;
  clearTimeout(stepWait);
  stepEl.classList.remove('on');
  orbitCv.classList.remove('on');
  if (orb) orb.show = false;
  stepPrep();                            // Step out's film loads while you look around
  renderView();
  if (lit) showCard(lit);
}
function setLit(slug) {
  lit = slug;
  if (!slug) { $('card').hidden = true; return; }
  showCard(slug);
}
function showCard(slug) {
  if (state !== 'floor') return;
  $('cname').src = 'type/' + slug + '.png';
  $('cname').alt = NAMES[slug];
  $('croom').textContent = offices[slug].room + (finePointer ? ' · click to go in' : '');
  $('card').hidden = false;
}
function lightOffice(slug, focus) {
  if (slug !== lit) sound.ui('tap');
  setLit(slug);
  if (focus) yawGoal = yawFor(slug);
  flightPrep(slug, 'in');                  // its flight starts downloading on the first tap
  roomshotFor(slug);
}
function step(dir) {
  const i = lit ? ALL.indexOf(lit) : (dir > 0 ? -1 : ALL.length);
  lightOffice(ALL[(i + dir + ALL.length) % ALL.length], true);
}
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('enter').addEventListener('click', () => { if (lit) flyIn(lit); });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(x, y) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(hitList, false)[0];
  return hit ? hit.object.userData.slug : null;
}
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'floor') return;
  down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, type: e.pointerType, yaw0: yaw, pitch0: pitch,
    ang0: orbit.ang, el0: orbit.el };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (e.pointerType === 'mouse') canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (state !== 'floor') return;
  if (down && e.pointerId === down.id) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.drag && Math.hypot(dx, dy) > 8) down.drag = true;
    if (down.drag && !viewTween) {
      if (floorView === 'orbit' && !orbitLive) {     // the rendered stills: the drag picks one (3 deg each)
        if (orb && !orbSpin && !stepFilm) {
          const i = orbitIdx(down.ang0 - (dx / window.innerWidth) * 3.4);
          if (i !== orb.idx) { orb.idx = i; orbitDraw(); }
        }
      } else if (floorView === 'orbit') {    // round the car (drag right: the car turns right), up and down a little
        orbit.ang = down.ang0 - (dx / window.innerWidth) * 3.4;
        orbit.el = Math.max(0.04, Math.min(1.0, down.el0 + (dy / window.innerHeight) * 1.4));
      } else {
        yaw = clampYaw(down.yaw0 - (dx / window.innerWidth) * 1.3);
        pitch = clampPitch(down.pitch0 + (dy / window.innerHeight) * 0.8);
        yawGoal = null;
      }
      lastTouch = performance.now();
    }
  } else if (e.pointerType === 'mouse') {
    const s = pickAt(e.clientX, e.clientY);
    if (s !== hover) {
      hover = s;
      if (s) { sound.ui('hover'); setLit(s); }
      canvas.style.cursor = s ? 'pointer' : 'grab';
    }
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (state !== 'floor' || !down || e.pointerId !== down.id) { down = null; return; }
  const d = down;
  down = null;
  lastTouch = performance.now();
  if (d.type === 'mouse') canvas.style.cursor = hover ? 'pointer' : 'grab';
  if (d.drag) return;
  const s = pickAt(e.clientX, e.clientY);
  if (d.type === 'mouse') { if (s) flyIn(s); else setLit(null); return; }
  if (!s) { setLit(null); return; }
  if (s === lit) flyIn(s);
  else lightOffice(s, floorView === 'seat');
});
// stepping out of the car and back in
$('viewbtn').addEventListener('click', () => {    // Step out / Get in: Blender films and stills (calm: the live tween)
  if (state !== 'floor' || viewTween || busy || stepFilm || orbSpin) return;
  if (floorView === 'seat') stepOut(); else getIn();
  sound.ui('door');
});
canvas.addEventListener('wheel', (e) => {   // outside the car: scroll to step closer or back (live orbit only)
  if (state !== 'floor' || floorView !== 'orbit' || !orbitLive) return;
  e.preventDefault();
  orbit.r = Math.max(3.6, Math.min(10, orbit.r * (1 + e.deltaY * 0.0012)));
  lastTouch = performance.now();
}, { passive: false });
canvas.addEventListener('pointercancel', () => { down = null; });
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !down) { hover = null; } });
// the driver's seat: drag to look around (the picture follows the finger), any way but up through the roof
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'curb') return;
  seatDrag = { x: e.clientX, y: e.clientY, id: e.pointerId, yaw0: seatYaw, pitch0: seatPitch };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (e.pointerType === 'mouse') canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (state !== 'curb' || !seatDrag || e.pointerId !== seatDrag.id) return;
  const vf = camera.fov * DEG, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  seatYaw = seatDrag.yaw0 + ((e.clientX - seatDrag.x) / window.innerWidth) * hf;
  seatPitch = Math.max(-1.05, Math.min(0.8, seatDrag.pitch0 + ((e.clientY - seatDrag.y) / window.innerHeight) * vf));
  if (Math.abs(e.clientX - seatDrag.x) + Math.abs(e.clientY - seatDrag.y) > 12) $('seathint').classList.add('gone');
});
const endSeatDrag = (e) => {
  if (!seatDrag || (e && e.pointerId !== seatDrag.id)) return;
  seatDrag = null;
  if (e && e.pointerType === 'mouse') canvas.style.cursor = 'grab';
};
canvas.addEventListener('pointerup', endSeatDrag);
canvas.addEventListener('pointercancel', endSeatDrag);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (radioOpen) closeRadio();
    else if (!$('links').hidden) closeLinks();
    else if (state === 'office') leaveOffice();
    else if (state === 'floor') setLit(null);
  } else if (state === 'curb' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    seatYaw += (e.key === 'ArrowLeft' ? 1 : -1) * 0.3;               // look around from the keyboard too
  } else if (state === 'floor' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    step(e.key === 'ArrowRight' ? 1 : -1);
  } else if (state === 'floor' && e.key === 'Enter' && lit && document.activeElement === document.body) {
    flyIn(lit);
  }
});

// ---------- offices: fly in, page, fly out ----------
function startMove(a, b, o) {
  move = {
    a, b, start: performance.now(), done: o.done, slug: o.slug, kind: o.kind, blend: o.blend || 0,
    from: o.blend ? { p: camera.position.clone(), q: camera.quaternion.clone() } : null,
  };
  setState('move');
}
function flyIn(slug, { fromRide = false } = {}) {
  const seg = META.segments[slug];
  if (!seg || state === 'move' || busy) return;
  if (state === 'floor' && floorView === 'orbit' && !orbitLive && !calm) {   // out by the car: back in first, then fly
    if (stepFilm || orbSpin) return;
    closeLinks();
    setLit(slug);
    getIn(() => flyIn(slug));
    return;
  }
  viewTween = null;                         // mid-step-out: the flight blends from wherever the camera is
  closeLinks();
  setLit(slug);
  sound.ui('in');
  wallPrep(slug);                           // the room's reels load while you fly in
  if (calm) { fadeThen(() => openOffice(slug)); return; }      // calm: a fade, no flight
  // from the driver's seat (on 18, or straight off the ride): the Blender flight
  if ((fromRide || (state === 'floor' && floorView === 'seat')) && !flightBroken) {
    yawGoal = 0; pitch = 0;
    roomshotFor(slug);
    setState('move');
    if (flightPlay(slug, 'in', () => openOffice(slug))) return;
  }
  startMove(seg.in[0], seg.in[1], { blend: fromRide ? 0 : 0.6, done: () => openOffice(slug), slug, kind: 'in' });
}
function snapToOffice(slug) {                // links, deep links, Skip with an office lined up
  if (!META.segments[slug]) return;
  move = null;
  lights = { mode: 'on', t0: 0 };
  fadeThen(() => openOffice(slug));
}
function openOffice(slug) {
  const o = offices[slug];
  move = null;
  openSlug = slug;
  clipT = META.segments[slug].in[1];        // the camera rests inside the room, behind the page
  setState('office');
  closeRadio();                            // the page's head sits where the radio drops down
  sound.ambient(true, 'floor');            // offices share floor 18's room sound (a lined-up office skips the floor)
  sound.stereo(true);                      // (deep links land here first)
  $('oname').src = 'type/' + slug + '.png';
  $('oname').alt = NAMES[slug];
  $('oroom').textContent = o.room;
  renderPage(slug);
  $('oaddr').textContent = '/' + slug;
  $('office').hidden = false;
  $('office').scrollTop = 0;
  if (!calm && !flightBroken) {             // the rendered room behind the page (the in-film's last frame)
    roomshotFor(slug);
    roomshot.classList.add('on');
    flight.classList.remove('on');
    flightPrep(slug, 'out');                // Back's film is ready before you are
    wallShow(slug);                         // and his reels play on its screen
  } else wallHide();
  try {                                     // on the office's own page (/amazon/) the address already says where you are
    if (slugFromHash() !== slug && START_OFFICE !== slug) history.pushState({ office: slug }, '', '#/' + slug);
  } catch (e) { /* sandboxed */ }
  try { $('back').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}
$('back').addEventListener('click', () => leaveOffice());
function leaveOffice() {
  if (state !== 'office' || busy) return;
  const slug = openSlug;
  openSlug = null;
  $('office').hidden = true;
  wallHide();                               // the screen goes back to the still the film starts on
  try { if (slugFromHash()) history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  toRootUrl();                              // left an office's own page: back to the tower's address
  sound.ui('out');
  const seg = META.segments[slug];
  if (calm) { fadeThen(() => { roomshot.classList.remove('on'); enterFloor({}); }); return; }
  setState('move');
  const back = () => {                      // the film lands in the seat: the floor-18 360 takes over, no crossfade
    enterFloor({});
    panoK = 1;
    flight.classList.remove('on');
    roomshot.classList.remove('on');
  };
  if (flightPlay(slug, 'out', back)) return;
  roomshot.classList.remove('on');
  startMove(seg.out[0], seg.out[1], { done: () => enterFloor({}), slug, kind: 'out' });
}

// ---------- plain links and addresses: #/amazon inside the tower; /amazon/ = the office's own page ----------
// Each office has a page of its own (web/<slug>/index.html, written by _source/site/make_pages.py: its title, description
// and link preview, <base href="../">, and window.__startOffice), which opens the tower straight into that room.
const SLUGS = new Set(ALL);
let START_OFFICE = SLUGS.has(window.__startOffice) ? window.__startOffice : null;
function slugFromHash() {
  // always "#/slug": a bare "#amazon" belongs to the old homepage's sections (redirected to /work/ at launch)
  const m = /^#\/([a-z0-9]+)/.exec(location.hash || '');
  return m && SLUGS.has(m[1]) ? m[1] : null;
}
function toRootUrl() {                        // leaving an office's own page: the address goes back to the tower's
  if (!START_OFFICE) return;
  START_OFFICE = null;
  try { history.replaceState(null, '', document.baseURI); } catch (e) { /* sandboxed */ }
}
$('links').addEventListener('click', (e) => {     // the list's real links move inside the tower, no reload
  const a = e.target.closest && e.target.closest('a[data-slug]');
  if (!a) return;
  e.preventDefault();
  if (slugFromHash() === a.dataset.slug) { closeLinks(); return; }
  location.hash = '#/' + a.dataset.slug;
});
function onRoute() {
  const s = slugFromHash();
  if (state === 'loading' || state === 'move' || busy) return;
  closeLinks();
  if (s && s !== openSlug) {
    if (state === 'floor') flyIn(s);
    else { if (state === 'ride') { sound.stopRide(); filmOff(); } store.set(VISITED, '1'); snapToOffice(s); }
  } else if (!s && state === 'office') leaveOffice();
}
window.addEventListener('hashchange', onRoute);
window.addEventListener('popstate', onRoute);
$('menu').addEventListener('click', () => { closeRadio(); $('calm').checked = calm; $('links').hidden = false; });
$('closelinks').addEventListener('click', closeLinks);
function closeLinks() { $('links').hidden = true; }
$('calm').addEventListener('change', (e) => {
  calm = e.target.checked;
  store.set(CALM, calm ? '1' : '0');
  if (calm) ensureLive();                   // calm mode is live 3D
  tag(true);
});
$('replay').addEventListener('click', () => {
  closeLinks();
  $('office').hidden = true;
  wallHide();
  stepFilm = null; orbSpin = null;
  stepEl.classList.remove('on');
  orbitCv.classList.remove('on');
  openSlug = null;
  try { if (slugFromHash()) history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  toRootUrl();                              // left an office's own page: back to the tower's address
  sound.stopRide();
  sound.ambient(false);
  filmOff();
  flightStop();
  roomshot.classList.remove('on');
  enterCurb();
  filmPrep();
});
// ---------- the car radio (look D, "Race MFD"): four 808 stations (audio.js STATIONS) ----------
// Sound off: the pill turns sound on and opens the radio. Sound on: the pill opens and closes it; MUTE is inside.
const radioEl = $('radio'), rspec = $('rspec'), rctx = rspec.getContext('2d');
const rleds = Array.from(radioEl.querySelectorAll('.leds i'));
const rbins = new Uint8Array(1024);
let radioOpen = false, rLevel = 0, rPeak = 0, rLed = 0;
function renderRadio() {
  const i = sound.station, st = STATIONS[i], on = sound.running && !sound.muted;
  $('rch').textContent = String(i + 1);
  $('rname').textContent = st.name;
  $('rbpm').textContent = String(st.bpm);
  $('rkey').textContent = st.short;
  $('rfm').textContent = st.fm;
  $('rmute').textContent = on ? 'MUTE' : 'SOUND ON';
  $('rmute').classList.toggle('lit', !on);
}
function openRadio() {
  radioOpen = true;
  radioEl.hidden = false;
  $('snd').setAttribute('aria-expanded', 'true');
  renderRadio();
}
function closeRadio() {
  if (!radioOpen) return;
  radioOpen = false;
  radioEl.hidden = true;
  $('snd').setAttribute('aria-expanded', 'false');
}
function soundOn() {                          // a tap on the radio means "let me hear it"
  sound.setMuted(false);
  sound.wake();
  film.muted = false;
  if (sound.wantAmb) sound.ambient(true);
  sound.stereo(true);
}
function tune(d) {
  const playing = sound.running && !sound.muted && !!sound.stereoSrc;
  sound.setStation(sound.station + d);        // playing: tuning static, then the next station from bar 1
  if (!playing) soundOn();                    // silent: it comes on straight on the new station
  sound.ui('tap');
  renderRadio(); renderSnd(); tag(true);
}
function radioTick() {                        // every frame: the pill's LED; with the panel open, the lights + spectrum
  const live = sound.radioLevels(rbins);
  const binHz = (sound.ctx ? sound.ctx.sampleRate : 48000) / 2048;
  let bass = 0;
  if (live) {                                  // the 808's band, 35-120 Hz
    const b0 = Math.max(1, Math.round(35 / binHz)), b1 = Math.round(120 / binHz);
    for (let k = b0; k <= b1; k++) bass += rbins[k];
    bass /= (b1 - b0 + 1) * 255;
  }
  rLevel += (bass - rLevel) * (bass > rLevel ? 0.55 : 0.12);
  $('snd').style.setProperty('--lvl', rLevel.toFixed(3));
  if (!radioOpen) return;
  // the shift lights pump: a fast bass level against its own slow average (a held 808 sits mid-scale, a hit slams
  // into the red, a gap drops out), since these 808s sustain and an absolute meter just sits full
  rLed += (bass - rLed) * (bass > rLed ? 0.8 : 0.3);
  rPeak += (bass - rPeak) * 0.03;
  const ratio = rPeak > 0.02 ? rLed / rPeak : 0;
  const lit = Math.round(Math.min(1, Math.max(0, (ratio - 0.86) / 0.26)) * rleds.length);
  rleds.forEach((el, k) => el.classList.toggle('on', k < lit));
  const W = rspec.width, H = rspec.height, n = 36, bw = W / n;
  rctx.clearRect(0, 0, W, H);
  rctx.fillStyle = '#ff3d3d';
  for (let k = 0; k < n; k++) {                // 36 bars, log-spaced 30 Hz to 9 kHz (each the loudest bin in its band)
    const a = Math.round(30 * Math.pow(300, k / n) / binHz), b = Math.max(a, Math.round(30 * Math.pow(300, (k + 1) / n) / binHz) - 1);
    let v = 0;
    if (live) for (let j = a; j <= b; j++) v = Math.max(v, rbins[j]);
    const h = Math.max(3, (live ? v / 255 : 0.04) * H);
    rctx.fillRect(k * bw + 2, H - h, bw - 5, h);
  }
}
$('snd').addEventListener('click', () => {
  if (sound.muted || !sound.running) { soundOn(); openRadio(); }
  else if (radioOpen) closeRadio();
  else openRadio();
  renderSnd(); renderRadio(); tag(true);
});
$('rprev').addEventListener('click', () => tune(-1));
$('rnext').addEventListener('click', () => tune(1));
$('rmute').addEventListener('click', () => {
  if (sound.muted || !sound.running) soundOn();
  else { sound.setMuted(true); film.muted = true; }
  renderRadio(); renderSnd(); tag(true);
});
sound.onStation(() => { renderRadio(); renderSnd(); });
document.addEventListener('pointerdown', (e) => {   // a tap anywhere else (the scene, a drag) closes it
  if (radioOpen && !radioEl.contains(e.target) && !$('snd').contains(e.target)) closeRadio();
}, true);

// ---------- lights: ignition, the studio, offices one by one ----------
function applyFx(now, rideT) {
  let L, inside, ign;
  if (lights.mode === 'ride') {
    const t = rideT == null ? -1 : rideT;
    L = t - META.lights_up.first; inside = smooth((t - (META.ride.arrival[0] - 0.2)) / 1.0); ign = t;
  }
  else if (lights.mode === 'quick') { L = (now - lights.t0) / 1000; inside = 1; ign = 99; if (L > 3) lights = { mode: 'on', t0: 0 }; }
  else { L = 99; inside = 1; ign = 99; }
  const up = smooth(L / 1.5);
  hemi.intensity = lerp(lerp(0.18, 0.22, inside), 0.85, up);          // night outside; the studio lights up as before
  sun.intensity = lerp(lerp(0.0, 0.25, inside), 0.55, up);
  studioLamp.intensity = 420 * up;
  fx.lightbar.emissiveIntensity = lerp(0.15, 2.6, smooth((ign - 0.05) / 0.22));
  fx.headlight.emissiveIntensity = lerp(0.1, 1.8, smooth((ign - 0.25) / 0.35));
  fx.taillight.emissiveIntensity = lerp(0.2, 1.4, smooth((ign - 0.05) / 0.3));
  // the Saibot car: START breathes while it waits, flashes on the press; the dash boots, the lights come on
  if (car.led) {
    const flash = ign >= 0 && ign < 0.4 ? 4.5 * (1 - Math.abs(Math.sin(ign * 26))) : 0;
    car.led.emissiveIntensity = state === 'curb' ? 1.4 + 1.2 * (0.5 + 0.5 * Math.sin(now / 260)) : 1.4 + flash;
  }
  for (const m of car.dash || []) m.emissiveIntensity = lerp(0.35, 1.25, smooth((ign - 0.12) / 0.5));
  if (car.head) car.head.emissiveIntensity = lerp(0.15, 6.0, smooth((ign - 0.25) / 0.35));
  if (car.tail) car.tail.emissiveIntensity = lerp(0.3, 4.0, smooth((ign - 0.05) / 0.3));
  if (cabGlow) cabGlow.visible = state === 'curb' || (state === 'ride' && rideT < META.ride.ascent[1]);
  // the platform ring; stood right next to it (stepped out) it would wash the screen with glow, so it calms down
  fx.ring.emissiveIntensity = lerp(0.2, 2.2, smooth((L - 1.1) / 0.3)) * (1 - 0.65 * ringDim);
  for (const o of Object.values(offices)) {
    const i = ORDER.indexOf(o.slug);
    const on = smooth((L - (i < 0 ? 1.2 : 0.2 * i)) / 0.15);
    const want = o.slug === lit || o.slug === hover || (move && move.slug === o.slug) || o.slug === openSlug ? 1 : 0;
    o.hi += (want - o.hi) * 0.2;
    let wake = 0;
    if (move && move.slug === o.slug) { const u = clamp01((clipT - move.a) / (move.b - move.a)); wake = move.kind === 'in' ? u : 1 - u; }
    else if (openSlug === o.slug) wake = 1;
    o.trim.emissiveIntensity = lerp(0.08, 1.0, on) + 2.2 * o.hi;
    o.screen.emissiveIntensity = lerp(0.05, 0.6, on) + 0.4 * o.hi + 1.2 * wake;
    o.label3d.color.setScalar(Math.min(1, lerp(0.38, 0.9, on) + 0.1 * o.hi));   // Tigre sign: unlit, dims until lights up
  }
}

// ---------- main loop ----------
let last = performance.now();
function loop(now) {
  const dtMs = Math.max(0.1, Math.min(250, now - last));      // the first frame can come in before the load clock
  last = now;
  const dt = dtMs / 1000;
  frames.all.push(dtMs);
  if (frames.all.length > 6000) frames.all.splice(0, 3000);
  if (dtMs > 30 && frames.long.length < 40) frames.long.push({ ms: Math.round(dtMs), state, clip: +clipT.toFixed(2), at: Math.round(now) });
  let rideT = null;

  if (state === 'ride') {
    rideT = filmOn ? (film.currentTime || 0) : Math.max(0, (now - rideStart) / 1000);     // the film is the clock
    if (filmOn && !filmShown && !film.paused && film.currentTime > 0.02 && now - filmTap > (filmTurn ? 330 : 0)) {
      filmShown = true;
      film.classList.add('on');
    }
    frames.ride.push(dtMs);
    clipT = calm ? calmClip(rideT) : Math.min(rideT, RIDE_END);
    if (calm) fadeAlpha(calmFade(rideT));
    const showPanel = rideT >= META.ride.ascent[0] && rideT < META.ride.arrival[1];
    if ($('panel').hidden === showPanel) $('panel').hidden = !showPanel;
  } else if (move) {
    clipT = Math.min(move.a + (now - move.start) / 1000, move.b);
  } else if (state === 'floor') {
    frames.floor.push(dtMs);
    if (frames.floor.length > 6000) frames.floor.splice(0, 3000);
  }
  setClip(clipT);
  for (const [gw, rw] of wheels) rw.quaternion.copy(gw.quaternion);   // the real wheels spin with the ride

  ringDim += ((state === 'floor' && floorView === 'orbit' ? 1 : 0) - ringDim) * (1 - Math.exp(-dt * 3));
  if (orbSpin) stepSpin(dt);
  if (state === 'floor') {
    floorPose(dt, now);
    camera.fov = fovFor('floor');
  } else {
    poseFromClip();
    if (state === 'curb') {
      camera.rotateOnWorldAxis(Y, seatYaw);
      camera.rotateX(seatPitch);
      cockpitSway(now);
      camera.fov = fovFor('cockpit');
    } else if (state === 'ride') {
      if (rideT < 0.6) cockpitSway(now, 1 - smooth(rideT / 0.6));
      if (seatBlend) {
        const kb = filmOn ? (now - filmTap) / 330 : rideT / 0.5;
        if (kb < 1) camera.quaternion.slerpQuaternions(seatFrom, camera.quaternion, smooth(kb));
        else seatBlend = false;
      }
      // the lens: as render_ride.py keys it (cockpit -> ride as it pulls out; -> floor as it swoops back into the seat)
      camera.fov = rideT < IN_SEAT ? lerp(fovFor('cockpit'), fovFor('ride'), smooth((rideT - META.ride.pullout[0]) / 1.2))
        : lerp(fovFor('ride'), fovFor('floor'), smooth((rideT - IN_SEAT) / 0.6));
      if (calm) camera.fov = rideT < CALM_A ? fovFor('cockpit') : rideT >= calmB() ? fovFor('floor') : fovFor('ride');
    } else {
      camera.fov = fovFor('floor');
      if (move && move.from) {
        const w = smooth((clipT - move.a) / move.blend);
        camera.position.lerpVectors(move.from.p, camera.position, w);
        camera.quaternion.slerpQuaternions(move.from.q, camera.quaternion, w);
      }
    }
  }
  camera.updateProjectionMatrix();
  if (state === 'ride') floorCounter(rideT);
  { const [ic, far] = stereoPose(rideT, now); sound.stereoAt(ic, far); }
  radioTick();
  if (state === 'curb') { camera.updateMatrixWorld(); placeStart(); }
  applyFx(now, rideT);

  // the seat before START is the 360 Cycles picture; the office page covers the screen: draw it once, then rest
  const filmCovers = state === 'ride' && filmOn && filmShown && rideT < RIDE_END - 0.7;
  const seat18 = state === 'floor' && floorView === 'seat' && !viewTween && pano18;
  if (flightOn && !flightOn.shown && !flight.paused && flight.currentTime > 0.02) {   // an office flight is on screen
    flightOn.shown = true;
    flight.classList.add('on');
    if (flightOn.kind === 'out') setTimeout(() => roomshot.classList.remove('on'), 170);
  }
  if (stepFilm && !stepFilm.shown && !stepEl.paused && stepEl.currentTime > 0.02) {      // a step film is on screen
    stepFilm.shown = true;
    stepEl.classList.add('on');
    if (stepFilm.kind === 'in') setTimeout(() => orbitCv.classList.remove('on'), 170);   // Get in: the still goes under it
  }
  if (!seat18) panoK = 0;                                            // coming back into the seat crossfades from live 3D
  if (flightOn && !flightOn.shown && flightOn.kind === 'in' && pano18) {
    drawPano(pano18, 1);                                             // the seat holds until the flight film plays
  } else if (flightOn && flightOn.shown) {
    // an office flight fills the screen: no 3D
  } else if (stepFilm && !stepFilm.shown && stepFilm.kind === 'out' && pano18) {
    drawPano(pano18, 1);                                             // the seat holds until the step-out film plays
  } else if (stepFilm || (state === 'floor' && orbitCv.classList.contains('on'))) {
    // a step film or the rendered stills fill the screen: no 3D
  } else if ((state === 'curb' || (state === 'ride' && filmOn && !filmShown)) && pano) {     // the 360 seat (turning back at START)
    drawPano(pano, 1);
  } else if (seat18) {                                               // floor 18 from the seat: the Cycles 360 too
    panoK = Math.min(1, panoK + dt / 0.35);
    drawPano(pano18, panoK);
  } else if (filmCovers) {
    // the film fills the screen: no 3D until just before live 3D takes over (phones stay cool)
  } else if (state !== 'office' || officeFrames++ < 2) composer.render();
  if (state !== 'office') officeFrames = 0;
  tag(false);

  if (move && clipT >= move.b) { const m = move; move = null; m.done(); }
  if (state === 'ride' && rideT >= RIDE_END) finishRide();
}
let officeFrames = 0;

// ---------- go ----------
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  $('tag').hidden = false;
  $('tag').textContent = '3D paused (graphics reset). Reload the page.';
});
load().then(() => {
  const deep = slugFromHash() || START_OFFICE;
  renderPanel();
  renderSnd();
  if (deep) { lights = { mode: 'on', t0: 0 }; openOffice(deep); }
  else if (store.get(VISITED) === '1') enterFloor({ quick: true });
  else enterCurb();
  last = performance.now();
  renderer.setAnimationLoop(loop);
  setTimeout(loadPano18, 1500);             // the curb is up: the 360 on 18 can come down now (needed 12 s after START)
  window.__gaugeDone = true;
  $('doorstep').classList.add('out');
  setTimeout(() => { $('doorstep').hidden = true; }, 800);
  window.__tower.ready = true;
}).catch((err) => {
  console.error(err);
  $('gcap').textContent = 'Could not load. Pull to refresh.';
});

// test hooks (used by the local checks; harmless for visitors)
function summary(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), avg = a.reduce((x, y) => x + y, 0) / a.length;
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { frames: a.length, avgFps: +(1000 / avg).toFixed(1), p50ms: +q(0.5).toFixed(2), p95ms: +q(0.95).toFixed(2),
    p99ms: +q(0.99).toFixed(2), worstMs: +s[s.length - 1].toFixed(1), over33ms: a.filter((x) => x > 33.4).length, over50ms: a.filter((x) => x > 50).length };
}
window.__tower = {
  build: BUILD, ready: false,
  startLocal: () => (carNode ? carNode.worldToLocal(startAt.clone()).toArray().map((v) => +v.toFixed(4)) : null),
  live: () => ({ car: !!realCar, env: !!scene.environment, pano: !!pano, pano18: !!pano18 }),
  get state() { return state; }, get clipT() { return clipT; }, get queued() { return queued; }, get lit() { return lit; },
  get calm() { return calm; }, audio: () => sound.state, muted: () => sound.muted,
  radio: () => ({ open: radioOpen, station: sound.station, name: STATIONS[sound.station].name, playing: !!sound.stereoSrc,
    playingBuf: sound.stereoSrc && sound.stereoSrc.buffer ? Math.round(sound.stereoSrc.buffer.duration * 100) / 100 : null,
    loaded: Object.keys(sound.buf).filter((k) => k.startsWith('stereo')).sort(), level: +rLevel.toFixed(3),
    leds: rleds.filter((e) => e.classList.contains('on')).length, pill: $('snd').textContent, muted: sound.muted,
    hiss: !!sound.staticSrc }),
  sounds: () => ({ loaded: Object.keys(sound.buf).sort(), ride: !!sound.rideSrc, loops: Object.keys(sound.loops), kind: sound.ambKind,
    stereo: !!sound.stereoSrc, stereoHz: Math.round(sound.stereoF || 0), stereoGain: +(sound.stereoG || 0).toFixed(2) }),
  seat: () => ({ yaw: +seatYaw.toFixed(3), pitch: +seatPitch.toFixed(3), pano: !!pano, hint: !$('seathint').classList.contains('gone') }),
  wall: () => ({ slug: wallSlug, on: wallEl.classList.contains('on'), lit: $('office').classList.contains('lit'), shape: roomShape,
    loaded: !!WALLS, transform: wallEl.style.transform, reels: $('owork').textContent,
    vids: wallVids().map((v) => ({ src: v.getAttribute('src'), paused: v.paused, ready: v.readyState, t: +(v.currentTime || 0).toFixed(2) })) }),
  flight: () => ({ on: !!flightOn, kind: flightOn && flightOn.kind, shown: !!(flightOn && flightOn.shown), broken: flightBroken,
    t: +(flight.currentTime || 0).toFixed(2), src: flight.getAttribute('src'), room: roomshot.classList.contains('on') }),
  film: () => ({ on: filmOn, shown: filmShown, t: +(film.currentTime || 0).toFixed(2), paused: film.paused,
    src: film.getAttribute('src'), err: film.error ? film.error.code : 0, ready: film.readyState }),
  view: () => ({ floorView, tween: !!viewTween, pano18: !!pano18, panoK: +panoK.toFixed(2), ang: +orbit.ang.toFixed(2), el: +orbit.el.toFixed(2), r: +orbit.r.toFixed(2),
    button: $('viewbtn').textContent, rendered: !orbitLive, idx: orb ? orb.idx : null, drawn: orb ? orb.drawn : null,
    stills: orb ? orb.ok.size : 0, step: stepFilm ? stepFilm.kind : null, spin: !!orbSpin, still: orbitCv.classList.contains('on'),
    film: stepEl.classList.contains('on') }),
  stats: () => {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { ride: summary(frames.ride), floor: summary(frames.floor), all: summary(frames.all), long: frames.long,
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, dpr: renderer.getPixelRatio(),
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a', size: [window.innerWidth, window.innerHeight] };
  },
  tapPoint(slug) {
    const v = offices[slug].tap.clone().project(camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight, front: v.z < 1 };
  },
  startPoint() {                      // where the START button on the wheel is on screen (the ring sits on it)
    const v = startAt.clone().project(camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight, real: !!startObj };
  },
  pick: pickAt, skip, flyIn, leaveOffice,
};

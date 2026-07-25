/**
 * Resin Culture rosin jar — procedural Three.js reconstruction.
 *
 * Built from spec.json (ObjectSculptSpec 2.1). Units are millimetres, Y up,
 * origin at the centre of the standing heel so the jar sits on y = 0.
 *
 * Geometry strategy (proceduralStrategy in the spec):
 *   jar body / cap        LatheGeometry over one continuous 2-D profile
 *   threads               TubeGeometry swept along a CatmullRom helix
 *   contents              lathe hugging the bore, displaced top surface
 *   labels                open-ended cylinder shells + CanvasTexture artwork
 *
 * The cap is rigged as a real screw: rotationY and positionY are coupled by the
 * thread pitch, so it cannot rise without turning. root.userData.sculptRuntime
 * exposes the named nodes, sockets, colliders and the open state.
 */
import * as THREE from 'three';
import { buildTopLabel, buildRosinMaps, mulberry32 } from './labelTextures.js';
// Body and skirt wraps were rebuilt from the close-up reference set, which showed
// three whole label zones the first pass never saw. See labelArt.js.
import { buildBodyLabel2 as buildBodyLabel, buildSkirtLabel2 as buildSkirtLabel } from './labelArt.js';

// ------------------------------------------------------------- dimensions
/**
 * Dimensions solved off the reference front view (renders/_ref_ruler.png).
 * Measured at D = 880 px, camera elevation 11.8 deg:
 *   silhouette H/D          0.839   (NOT the 0.91 a first eyeball read gives —
 *                                    the top ellipse fools you into over-counting)
 *   cap front face / D      0.367
 *   body below the seam / D 0.472
 *   exposed black band / D  0.055
 * Absolute scale is anchored on a 50 mm label OD (standard 5 ml jar); every other
 * number here is a measured ratio, so the proportions hold at any true diameter.
 */
export const DIM = {
  R: 25.0,              // outer label radius
  H_TOTAL: 42.0,        // 0.839 * D
  H_LID: 18.35,         // 0.367 * D
  Y_SEAM: 23.65,        // cap / jar split, 0.472 * D above the heel
  R_NECK: 21.0,
  R_BORE: 17.5,
  Y_NECK_BASE: 24.8,
  Y_RIM: 37.9,
  Y_FLOOR: 6.1,
  PITCH: 3.6,           // mm rise per turn — shared by BOTH helices
  TURNS: 2.25,
  THREAD_R: 0.5,        // bead cross-section radius
  BAND_BEVEL: 2.85,     // exposed black band above the printed skirt wrap
  LABEL_BODY_H: 21.8,   // body wrap height
  LABEL_BODY_Y: 1.60,   // body wrap lower edge
  LABEL_SKIRT_H: 15.40, // cap wrap height
  FILL_Y: 28.0,         // top of the product — packed full, not the part-used reference.
                        // High enough to clear the bore wall and stay visible from a
                        // three-quarter view, with headroom before the neck taper at 31.
};
DIM.LIFT = DIM.PITCH * DIM.TURNS;   // 8.1 mm of thread travel

// ------------------------------------------------------------- profiles
/**
 * Jar body: axis -> punt -> heel -> wall -> ledge -> neck -> rim -> bore -> floor -> axis.
 * The wall runs at full diameter right up to the seam and then steps in hard at the
 * ledge, the way a real jar does — that ledge IS the visible seam line, and it is what
 * lets the cap skirt's outer skin sit flush with the body label.
 */
function jarProfile() {
  return [
    [0.00, 1.05], [10.00, 0.95], [17.00, 0.72], [21.00, 0.28],
    [22.60, 0.00], [23.60, 0.00], [24.28, 0.48], [24.55, 1.25],
    [24.62, 5.00], [24.65, 12.00], [24.62, 19.00], [24.65, 23.40],
    [24.30, 23.50], [21.60, 23.58], [21.10, 23.90], [21.00, 24.80],
    [21.00, 36.30], [21.00, 37.55], [20.70, 37.90],
    [17.90, 37.90], [17.55, 37.55], [17.50, 31.00], [17.85, 20.00],
    [18.00, 12.00], [17.80, 9.10], [17.20, 7.30], [16.00, 6.45],
    [13.50, 6.15], [10.00, 6.10], [0.00, 6.10],
  ];
}

/** Cap: recessed top face -> bevel crown -> skirt -> lip -> bore -> 3 steps -> liner seat -> axis. */
function capProfile() {
  return [
    [0.00, 18.00], [12.00, 18.00], [21.00, 18.00], [23.30, 18.00],
    [23.85, 18.29], [24.45, 18.35], [24.86, 18.11], [25.00, 17.50],
    [25.00, 15.50], [25.00, 3.00], [25.00, 0.90], [24.86, 0.30],
    [24.40, 0.00], [23.70, 0.06], [23.10, 0.40], [22.60, 1.00],
    [22.60, 11.80], [22.00, 11.85], [22.00, 12.60], [20.40, 12.65],
    [20.40, 13.55], [18.60, 13.60], [18.60, 14.45], [17.70, 14.50],
    [17.70, 15.30], [12.00, 15.30], [0.00, 15.30],
  ];
}

function lathe(profile, segments = 128) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(Math.max(1e-4, x), y));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

/**
 * Thread bead: constant cross-section swept along a helix (fiber-strand topology).
 * The radius ramps to zero over the first and last 40 deg — the lead-in and run-out.
 */
function threadHelix(radius, yStart, turns, pitch, tubeR, phase = 0, segments = 216) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = phase + t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, yStart + t * turns * pitch, Math.sin(a) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, segments, tubeR, 12, false);
  // taper the ends so the bead does not stop square
  const pos = g.attributes.position;
  const rampSpan = 40 / (turns * 360);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let k = 1;
    if (t < rampSpan) k = t / rampSpan;
    else if (t > 1 - rampSpan) k = (1 - t) / rampSpan;
    if (k >= 1) continue;
    const centre = curve.getPoint(t);
    for (let j = 0; j <= 12; j++) {
      const idx = i * 13 + j;
      if (idx >= pos.count) break;
      pos.setX(idx, centre.x + (pos.getX(idx) - centre.x) * k);
      pos.setY(idx, centre.y + (pos.getY(idx) - centre.y) * k);
      pos.setZ(idx, centre.z + (pos.getZ(idx) - centre.z) * k);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Seeded 3-octave value noise for the contents displacement. */
function valueNoise3(seed) {
  const rnd = mulberry32(seed);
  const p = new Float32Array(512);
  for (let i = 0; i < 512; i++) p[i] = rnd();
  const h = (x, y, z) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return p[Math.floor(Math.abs(n) * 512) % 512];
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const c = (dx, dy, dz) => h(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
      zf,
    );
  };
}

/**
 * The pale batter, filled.
 *
 * The reference jar is part-used — a low crescent covering ~65% of the floor with
 * bare glass beside it. This is deliberately NOT that: it is the same jar packed
 * full, which is what the piece wants to show. Departure from the reference is
 * recorded in the spec (contents-fill-state).
 *
 * Built as a lathe that hugs the bore profile inset by 0.18 mm, so the product
 * meets the glass exactly instead of floating inside it, then the top disc alone
 * is displaced: a shallow dome, pour ridges, and a meniscus lip that climbs where
 * the wax wets the wall. Normals are recomputed after displacement, otherwise the
 * wet speckle highlights sit on flat shading.
 */
function rosinGeometry() {
  const fillY = DIM.FILL_Y;            // world-space top of the product
  const inset = 0.18;                  // clearance from the bore wall

  // bore radius as a function of height, read off jarProfile()
  const bore = [
    [DIM.Y_FLOOR, 0.0], [DIM.Y_FLOOR, 10.0], [6.15, 13.5], [6.45, 16.0],
    [7.30, 17.2], [9.10, 17.8], [12.00, 18.0], [20.00, 17.85], [31.00, 17.5],
  ];
  const boreR = (y) => {
    for (let i = 1; i < bore.length; i++) {
      if (y <= bore[i][0]) {
        const [y0, r0] = bore[i - 1], [y1, r1] = bore[i];
        const t = y1 === y0 ? 1 : (y - y0) / (y1 - y0);
        return r0 + (r1 - r0) * t;
      }
    }
    return bore[bore.length - 1][1];
  };

  // profile: axis at the floor -> out along the floor -> up the wall -> across the top
  const pts = [];
  pts.push(new THREE.Vector2(0.0001, DIM.Y_FLOOR));
  for (const [y, r] of bore) {
    if (y > fillY) break;
    if (r > 0.5) pts.push(new THREE.Vector2(Math.max(0.5, r - inset), y));
  }
  const rTop = boreR(fillY) - inset;
  pts.push(new THREE.Vector2(rTop, fillY));
  // The top disc needs FINE radial subdivision. With only a handful of rings the
  // triangles near the axis become long and thin and the specular highlight runs
  // straight down them — the surface reads as a pinwheel of streaks rather than wax.
  const RINGS = 26;
  for (let i = 1; i <= RINGS; i++) {
    const f = Math.pow(1 - i / RINGS, 0.85);        // denser toward the rim
    pts.push(new THREE.Vector2(Math.max(0.0001, rTop * f), fillY));
  }

  const g = new THREE.LatheGeometry(pts, 128);
  const noise = valueNoise3(0x20511);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y < fillY - 0.01) continue;              // only the surface moves
    const r = Math.hypot(v.x, v.z);
    const rn = Math.min(1, r / rTop);
    const dome = 0.70 * (1 - rn * rn);             // settled, very slightly domed
    const lip = 0.55 * THREE.MathUtils.smoothstep(rn, 0.80, 1.0);   // wets the wall
    // Three octaves, all sampled in x/z so nothing is radially symmetric — a purely
    // radial height field would re-create the same streaking the tessellation caused.
    const n1 = noise(v.x * 0.19 + 8, 3.1, v.z * 0.19 + 5) - 0.5;    // broad pour swells
    const n2 = noise(v.x * 0.55 + 2, 7.7, v.z * 0.55 + 9) - 0.5;    // ridges
    const n3 = noise(v.x * 1.45 + 4, 1.3, v.z * 1.45 + 3) - 0.5;    // fine skin texture
    v.y = fillY + dome + lip + n1 * 1.25 + n2 * 0.55 + n3 * 0.18;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.translate(0, -DIM.Y_FLOOR, 0);                 // contents group already sits at the floor
  return g;
}

// ------------------------------------------------------------- textures
function canvasTexture(canvas, { srgb = false, repeatX = 1, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(repeatX, 1);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** Small procedural height field -> normal, for the moulded plastic orange peel. */
function orangePeelNormal(size = 256, seed = 0x0A9E) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const img = ctx.createImageData(size, size);
  const noise = valueNoise3(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise(x / 18, y / 18, 0.5) * 0.7 + noise(x / 6, y / 6, 3.1) * 0.3;
      const i = (y * size + x) * 4;
      const nx = (n - 0.5) * 0.35;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = 128;
      img.data[i + 2] = 250;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  return t;
}

// ------------------------------------------------------------- the factory
/**
 * @param {{pass?: 'blockout'|'structural'|'form'|'material'|'full', anisotropy?: number,
 *          textureSize?: number}} options
 */
export function createResinCultureJarModel(options = {}) {
  const pass = options.pass ?? 'full';
  const showMaterials = pass === 'material' || pass === 'full';
  const showForm = showMaterials || pass === 'form';
  const showStructure = showForm || pass === 'structural';
  const aniso = options.anisotropy ?? 8;
  const texSize = options.textureSize ?? 4096;

  const root = new THREE.Group();
  root.name = 'pressed-culture-rosin-jar';
  const nodes = {}, meshes = {}, sockets = {}, colliders = {}, destructionGroups = {};
  const disposables = [];

  const socket = (parent, id, pos) => {
    const o = new THREE.Object3D();
    o.name = `socket:${id}`;
    o.position.set(pos[0], pos[1], pos[2]);
    parent.add(o);
    sockets[id] = o;
    return o;
  };

  // ---------------------------------------------------------- materials
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9e, roughness: 0.75, metalness: 0.0 });

  const glassMat = showMaterials
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#100F0C'),
        roughness: 0.06, metalness: 0.0,
        clearcoat: 0.35, clearcoatRoughness: 0.024,
        envMapIntensity: 1.9,
        sheen: 0.0,
      })
    : blockMat;

  // the neck's moulded thread land is visibly duller than the fire-polished wall
  const threadLandMat = showMaterials
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#141310'),
        roughness: 0.32, metalness: 0.0, clearcoat: 0.2, envMapIntensity: 1.2,
      })
    : blockMat;

  const capMat = showMaterials
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#0B0B0C'),
        roughness: 0.13, metalness: 0.0,
        clearcoat: 0.88, clearcoatRoughness: 0.055,
        envMapIntensity: 1.7,
      })
    : blockMat;
  if (showMaterials) {
    const peel = orangePeelNormal();
    capMat.normalMap = peel;
    capMat.normalScale = new THREE.Vector2(0.12, 0.12);
    disposables.push(peel);
  }

  const linerMat = showMaterials
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#1B2038'),
        roughness: 0.48, metalness: 0.0, clearcoat: 0.1, envMapIntensity: 0.8,
      })
    : blockMat;

  let rosinMat;
  if (showMaterials) {
    const rm = buildRosinMaps(1024);
    const rr = canvasTexture(rm.roughness);
    const rn = canvasTexture(rm.normal);
    disposables.push(rr, rn);
    rosinMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#E4D3A4'),
      roughnessMap: rr, roughness: 1.0, metalness: 0.0,
      normalMap: rn, normalScale: new THREE.Vector2(0.55, 0.55),
      clearcoat: 0.72, clearcoatRoughness: 0.09,
      transmission: 0.14, ior: 1.47, thickness: 1.2,
      attenuationColor: new THREE.Color('#C9B37E'), attenuationDistance: 4.5,
      envMapIntensity: 0.75,
    });
  } else {
    rosinMat = new THREE.MeshStandardMaterial({ color: 0xd8d2bc, roughness: 0.6 });
  }

  const labelMat = (maps, { metalness = false } = {}) => {
    const al = canvasTexture(maps.albedo, { srgb: true, aniso });
    const ro = canvasTexture(maps.roughness, { aniso });
    const no = canvasTexture(maps.normal, { aniso });
    disposables.push(al, ro, no);
    const m = new THREE.MeshPhysicalMaterial({
      map: al,
      roughnessMap: ro, roughness: 1.0,
      normalMap: no, normalScale: new THREE.Vector2(0.45, 0.45),
      metalness: metalness ? 1.0 : 0.0,
      envMapIntensity: 0.45,
      clearcoat: 0.05,
    });
    if (metalness && maps.metalness) {
      const mt = canvasTexture(maps.metalness, { aniso });
      disposables.push(mt);
      m.metalnessMap = mt;
    }
    return m;
  };

  // =========================================================== JAR BODY
  const jarBody = new THREE.Group();
  jarBody.name = 'jar-body';
  root.add(jarBody);
  nodes['jar-body'] = jarBody;

  const bodyGeo = lathe(jarProfile(), showStructure ? 128 : 48);
  disposables.push(bodyGeo);
  const bodyMesh = new THREE.Mesh(bodyGeo, glassMat);
  bodyMesh.name = 'body-glass-wall';
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
  bodyMesh.material.side = THREE.DoubleSide;
  jarBody.add(bodyMesh);
  meshes['body-glass-wall'] = bodyMesh;

  // the matte thread land, drawn as a thin overlay ring on the neck
  if (showStructure) {
    const landH = DIM.Y_RIM - DIM.Y_NECK_BASE - 0.4;
    const landGeo = new THREE.CylinderGeometry(DIM.R_NECK + 0.02, DIM.R_NECK + 0.02, landH, 96, 1, true);
    disposables.push(landGeo);
    const land = new THREE.Mesh(landGeo, threadLandMat);
    land.name = 'body-neck-land';
    land.position.y = DIM.Y_NECK_BASE + landH / 2;
    jarBody.add(land);
    meshes['body-neck-land'] = land;

    const neckThreadGeo = threadHelix(
      DIM.R_NECK + 0.35, DIM.Y_NECK_BASE + 2.2, DIM.TURNS, DIM.PITCH, DIM.THREAD_R, 0,
    );
    disposables.push(neckThreadGeo);
    const neckThread = new THREE.Mesh(neckThreadGeo, threadLandMat);
    neckThread.name = 'neck-thread-helix';
    neckThread.castShadow = true;
    jarBody.add(neckThread);
    meshes['neck-thread-helix'] = neckThread;
  }

  socket(jarBody, 'neck-thread-socket', [0, DIM.Y_NECK_BASE, 0]);
  socket(jarBody, 'rim-socket', [0, DIM.Y_RIM, 0]);
  socket(jarBody, 'cavity-floor-socket', [0, DIM.Y_FLOOR, 0]);
  socket(jarBody, 'label-socket', [0, 6.9, 0]);

  // body label wrap
  if (showMaterials) {
    const maps = buildBodyLabel(texSize);
    const geo = new THREE.CylinderGeometry(DIM.R - 0.03, DIM.R - 0.05, DIM.LABEL_BODY_H, 128, 1, true);
    disposables.push(geo);
    const m = labelMat(maps, { metalness: true });
    const wrap = new THREE.Mesh(geo, m);
    wrap.name = 'body-label-wrap';
    wrap.position.y = DIM.LABEL_BODY_Y + DIM.LABEL_BODY_H / 2;
    wrap.rotation.y = Math.PI;              // artwork front faces +Z, seam to the rear
    wrap.castShadow = true; wrap.receiveShadow = true;
    jarBody.add(wrap);
    meshes['body-label-wrap'] = wrap;
  }

  colliders['jar-body'] = { type: 'cylinder', offset: [0, DIM.Y_SEAM / 2, 0], radius: DIM.R, halfHeight: DIM.Y_SEAM / 2 };

  // =========================================================== CONTENTS
  const contents = new THREE.Group();
  contents.name = 'contents-group';
  contents.position.y = DIM.Y_FLOOR;
  jarBody.add(contents);
  nodes['contents-group'] = contents;

  const rosinGeo = rosinGeometry();
  disposables.push(rosinGeo);
  const rosin = new THREE.Mesh(rosinGeo, rosinMat);
  rosin.name = 'rosin-mound';
  rosin.castShadow = false; rosin.receiveShadow = true;
  contents.add(rosin);
  meshes['rosin-mound'] = rosin;

  // NOTE: the reference's floor residue decal is gone — it lived on the bare-floor
  // crescent beside the part-used mound, and a full jar has no bare floor to show.

  // =========================================================== CAP
  const cap = new THREE.Group();
  cap.name = 'lid-assembly';
  cap.position.y = DIM.Y_SEAM;
  root.add(cap);
  nodes['lid-assembly'] = cap;

  const capGeo = lathe(capProfile(), showStructure ? 128 : 48);
  disposables.push(capGeo);
  const capMesh = new THREE.Mesh(capGeo, capMat);
  capMesh.name = 'lid-skirt';
  capMesh.castShadow = true; capMesh.receiveShadow = true;
  capMesh.material.side = THREE.DoubleSide;
  cap.add(capMesh);
  meshes['lid-skirt'] = capMesh;

  if (showStructure) {
    // internal thread: same pitch, half-pitch phase offset so the beads interleave
    const capThreadGeo = threadHelix(
      DIM.R_NECK + 1.10, 3.4, DIM.TURNS, DIM.PITCH, DIM.THREAD_R, Math.PI,
    );
    disposables.push(capThreadGeo);
    const capThread = new THREE.Mesh(capThreadGeo, capMat);
    capThread.name = 'lid-inner-thread';
    cap.add(capThread);
    meshes['lid-inner-thread'] = capThread;
  }

  if (showForm) {                            // navy sealing liner disc
    const linerGeo = new THREE.CylinderGeometry(17.7, 17.7, 0.9, 72);
    disposables.push(linerGeo);
    const liner = new THREE.Mesh(linerGeo, linerMat);
    liner.name = 'lid-liner-disc';
    liner.position.y = 14.90;
    cap.add(liner);
    meshes['lid-liner-disc'] = liner;
  }

  if (showMaterials) {
    // skirt wrap
    const sMaps = buildSkirtLabel(texSize);
    const sGeo = new THREE.CylinderGeometry(DIM.R + 0.06, DIM.R + 0.06, DIM.LABEL_SKIRT_H, 128, 1, true);
    disposables.push(sGeo);
    const skirtWrap = new THREE.Mesh(sGeo, labelMat(sMaps));
    skirtWrap.name = 'lid-label-wrap';
    skirtWrap.position.y = 0.1 + DIM.LABEL_SKIRT_H / 2;
    skirtWrap.rotation.y = Math.PI;
    skirtWrap.castShadow = true; skirtWrap.receiveShadow = true;
    cap.add(skirtWrap);
    meshes['lid-label-wrap'] = skirtWrap;

    // top emblem print, sitting in the 0.35 mm recess
    const tMaps = buildTopLabel(Math.min(2048, texSize));
    const tGeo = new THREE.CircleGeometry(23.3, 96);
    disposables.push(tGeo);
    const tAl = canvasTexture(tMaps.albedo, { srgb: true, aniso });
    const tRo = canvasTexture(tMaps.roughness, { aniso });
    const tNo = canvasTexture(tMaps.normal, { aniso });
    disposables.push(tAl, tRo, tNo);
    const topPrint = new THREE.Mesh(tGeo, new THREE.MeshPhysicalMaterial({
      map: tAl, roughnessMap: tRo, roughness: 1.0,
      normalMap: tNo, normalScale: new THREE.Vector2(0.4, 0.4),
      metalness: 0.0, envMapIntensity: 0.42, clearcoat: 0.06,
    }));
    topPrint.name = 'lid-top-print';
    topPrint.rotation.x = -Math.PI / 2;
    topPrint.position.y = 18.05;
    topPrint.receiveShadow = true;
    cap.add(topPrint);
    meshes['lid-top-print'] = topPrint;
  }

  socket(cap, 'cap-thread-socket', [0, 1.6, 0]);
  socket(cap, 'liner-seat', [0, 15.4, 0]);
  colliders['lid-assembly'] = { type: 'cylinder', offset: [0, DIM.H_LID / 2, 0], radius: DIM.R, halfHeight: DIM.H_LID / 2 };
  destructionGroups['cap-jar-separation'] = [cap, jarBody];

  // ---------------------------------------------------------- screw rig
  /**
   * The one place the unscrew lives. `t` is normalised travel:
   *   0            closed and seated
   *   0..1         on the thread — rotation and rise are coupled by the pitch
   *   1..2         released — lifts clear, tilts, and moves aside
   * Rotation is derived from the rise, never set independently, so the cap
   * physically cannot come off without turning.
   */
  const capHome = { y: DIM.Y_SEAM, x: 0, z: 0 };
  function setOpen(t) {
    const tt = THREE.MathUtils.clamp(t, 0, 2);
    const screw = Math.min(tt, 1);
    const rise = screw * DIM.LIFT;
    cap.rotation.y = -(rise / DIM.PITCH) * Math.PI * 2;   // coupled: rise -> turns
    cap.position.y = capHome.y + rise;

    const free = Math.max(0, tt - 1);
    const ease = free * free * (3 - 2 * free);            // smoothstep
    // set-aside: lift clear of the rim, then tilt and settle beside the jar.
    // Kept inside a 62 mm reach so the cap stays in frame next to the jar.
    cap.position.y += Math.sin(ease * Math.PI) * 12.0 - ease * (DIM.Y_SEAM + DIM.LIFT - 0.6);
    cap.position.x = capHome.x - ease * 58.0;
    cap.position.z = capHome.z + ease * 12.0;
    cap.rotation.z = ease * 0.16;
    cap.rotation.x = ease * 0.06;

    if (showMaterials) {                                  // contents catch the light on cue
      rosinMat.envMapIntensity = 1.1 + ease * 0.5;
      rosinMat.clearcoat = 0.55 + ease * 0.25;
    }
    root.userData.sculptRuntime.openAmount = tt;
    root.userData.sculptRuntime.isOpen = tt >= 1;
  }

  // ---------------------------------------------------------- runtime
  root.userData.sculptRuntime = {
    nodes, meshes, sockets, colliders, destructionGroups,
    dimensions: DIM,
    pass,
    openAmount: 0,
    isOpen: false,
    setOpen,
    constraints: [{
      id: 'cap-screw', target: 'lid-assembly', axis: [0, 1, 0],
      pitchMm: DIM.PITCH, turnsToRelease: DIM.TURNS,
      rule: 'translationY = (rotationY / 2*pi) * pitch, clamped to 0..8.1 mm',
    }],
    dispose() {
      for (const d of disposables) d.dispose?.();
      root.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m?.dispose?.();
        }
      });
    },
  };
  root.userData.actionReadiness = {
    note: 'root.userData.sculptRuntime.setOpen(t) drives the screw: 0 closed, 1 thread released, 2 set aside.',
  };
  setOpen(0);
  return root;
}

/** Reference-matched lighting rig (spec.lightingFromPhoto). */
export function createJarLights() {
  const g = new THREE.Group();
  g.name = 'jar-lights';

  // Exposure note: the first material-pass render blew the printed labels out to
  // near-white. The print is matte, low-dynamic-range artwork — it needs far less
  // light than the near-black gloss does, and the environment already carries the
  // gloss. Key dropped 2.6 -> 1.45 and the rim spot 90 -> 34.
  const key = new THREE.DirectionalLight(0xffe7c4, 1.45);
  key.position.set(-58, 78, 46);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 320;
  key.shadow.camera.left = -70; key.shadow.camera.right = 70;
  key.shadow.camera.top = 70; key.shadow.camera.bottom = -70;
  key.shadow.bias = -0.0009;
  key.shadow.radius = 3;
  g.add(key);

  const fill = new THREE.DirectionalLight(0xcfe0f0, 0.32);
  fill.position.set(86, 30, 62);
  g.add(fill);

  const bounce = new THREE.DirectionalLight(0xd9853f, 0.34);
  bounce.position.set(0, -40, 34);
  g.add(bounce);

  const rim = new THREE.SpotLight(0xe8f0ff, 34, 300, 0.7, 0.6, 1.4);
  rim.position.set(52, 60, -84);
  g.add(rim);

  g.add(new THREE.HemisphereLight(0x9fb4c8, 0x2a1c10, 0.22));
  return g;
}

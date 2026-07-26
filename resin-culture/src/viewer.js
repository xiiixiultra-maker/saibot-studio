/**
 * Shared viewer for the Resin Culture jar pages.
 *
 * Extracted from resin-culture/index.html when the RODMAN release got its own
 * page. Everything here — renderer, environment, floor, orbit + pan, the cap
 * drag, the idle spin — is identical between releases; the ONLY thing that
 * differs is which label pack the model is built with.
 *
 * Keeping one copy is the point. Two 437-line pages that are 95% the same
 * drift apart on the first fix that only gets applied to one of them.
 *
 * Import paths are relative to THIS file, so a page at any depth works as long
 * as it declares its own importmap for "three".
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createResinCultureJarModel, createJarLights, DIM } from './createJarModel.js';

export function initViewer({ label = 'sour-diesel-bx2' } = {}) {

  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0a0c');
  scene.fog = new THREE.Fog('#0a0a0c', 180, 460);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 1, 2000);
  camera.position.set(70, 54, 112);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 19, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.minDistance = 52;
  controls.maxDistance = 300;
  controls.maxPolarAngle = Math.PI * .9;
  controls.enablePan = true;
  controls.screenSpacePanning = true;   // pan in the view plane, not along the ground
  controls.panSpeed = .85;
  // right-drag (or two-finger) pans; left-drag still orbits and the cap still grabs first
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  scene.add(createJarLights());

  // dark studio floor rather than the reference oak — this sits on the site, not in the review
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(340, 64),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#141418'), roughness: .78, metalness: .0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  const jar = createResinCultureJarModel({
    label,
    textureSize: Math.min(4096, renderer.capabilities.maxTextureSize),
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
  });
  const runtime = jar.userData.sculptRuntime;
  scene.add(jar);

  // -------------------------------------------------------------- interaction
  let openTarget = 0, openCurrent = 0, spinning = false, idle = true;
  const slider = document.getElementById('open');
  const capstate = document.getElementById('capstate');
  const toggle = document.getElementById('toggle');
  const resetBtn = document.getElementById('reset');

  function updateHud() {
    capstate.textContent = openCurrent < .02 ? 'seated'
      : openCurrent < 1 ? `${(openCurrent * DIM.TURNS).toFixed(2)} turns`
      : openCurrent < 1.98 ? 'releasing' : 'off';
    toggle.textContent = openTarget > .5 ? 'Screw it back on' : 'Twist it open';
  }
  function apply(v, snap = true) {
    openTarget = THREE.MathUtils.clamp(v, 0, 2);
    if (snap) slider.value = String(openTarget);
  }
  function applyNow(v) {                       // synchronous: no dependence on rAF timing
    apply(v); openCurrent = openTarget;
    runtime.setOpen(openCurrent); updateHud(); autoFrame(1);
  }

  /**
   * The cap travels 58 mm to camera-left as it comes off and would leave the shot.
   * Pan the orbit target and widen the FOV rather than moving the camera — both
   * compose with the visitor's own orbit and zoom instead of fighting them.
   *
   * It does NOT compose with panning, though: both write the orbit target, so once
   * the visitor pans they own the framing and this stops touching it. "Reset view"
   * hands it back. `k` is the lerp rate; 1 snaps (used when the slider is dragged).
   */
  let userPanned = false;
  function autoFrame(k) {
    if (userPanned) return;
    const f = THREE.MathUtils.smoothstep(openCurrent, .85, 2);
    controls.target.x += (-26 * f - controls.target.x) * k;
    controls.target.y += ((19 - 3 * f) - controls.target.y) * k;
    const wantFov = 34 * (1 + .17 * f);
    if (Math.abs(camera.fov - wantFov) > .01) {
      camera.fov += (wantFov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
  }

  // Keep the pan inside a sane box so nobody can shove the jar off-screen and get lost.
  const PAN_BOX = new THREE.Box3(
    new THREE.Vector3(-110, -20, -110),
    new THREE.Vector3(70, 90, 110),
  );
  function clampTarget() { PAN_BOX.clampPoint(controls.target, controls.target); }

  /**
   * Hand the framing back to the auto-frame.
   *
   * Measured, not assumed: OrbitControls' damped pan offset keeps nudging the target
   * on EVERY subsequent frame (89/89 frames after a release, decaying from 0.28 mm and
   * never reaching zero). So the latch is armed by the pan GESTURE, not by watching the
   * target move — target-watching re-armed it forever after a reset.
   */
  function releasePanLatch() {
    userPanned = false;
    resetBtn.classList.remove('on');
  }

  function resetView() {
    releasePanLatch();
    camTween = {
      from: camera.position.clone(), to: new THREE.Vector3(70, 54, 112),
      fromT: controls.target.clone(), toT: new THREE.Vector3(0, 19, 0), t: 0,
    };
  }

  slider.addEventListener('input', () => { idle = false; applyNow(parseFloat(slider.value)); });
  toggle.addEventListener('click', () => {
    idle = false;
    const opening = openTarget <= .5;
    apply(opening ? 2 : 0);
    updateHud();
    // Clicking the button means "show me this open" — so ride up to an angle that
    // actually looks into the jar. Twisting the cap off by hand does NOT do this:
    // there you're driving, and yanking the camera would fight you.
    releasePanLatch();
    camTween = opening
      ? { from: camera.position.clone(), to: new THREE.Vector3(56, 96, 126),
          fromT: controls.target.clone(), toT: new THREE.Vector3(-14, 15, 0), t: 0 }
      : { from: camera.position.clone(), to: new THREE.Vector3(70, 54, 112),
          fromT: controls.target.clone(), toT: new THREE.Vector3(0, 19, 0), t: 0 };
  });
  document.getElementById('spin').addEventListener('click', () => { spinning = !spinning; idle = false; });
  resetBtn.addEventListener('click', () => { idle = false; resetView(); });
  renderer.domElement.addEventListener('dblclick', () => { idle = false; resetView(); });
  document.getElementById('look').addEventListener('click', () => {
    idle = false; releasePanLatch();
    apply(2); updateHud();
    camTween = { from: camera.position.clone(), to: new THREE.Vector3(4, 92, 30),
                 fromT: controls.target.clone(), toT: new THREE.Vector3(0, 12, 0), t: 0 };
  });

  // Arm the pan latch from the gesture itself: right-button drag, or a second
  // simultaneous pointer (two-finger). This is exactly the mapping configured on
  // controls.mouseButtons / controls.touches above.
  const activePointers = new Set();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    activePointers.add(e.pointerId);
    if (e.button === 2 || activePointers.size >= 2) {
      userPanned = true;
      resetBtn.classList.add('on');
      idle = false;
    }
  }, true);
  const dropPointer = (e) => activePointers.delete(e.pointerId);
  renderer.domElement.addEventListener('pointerup', dropPointer, true);
  renderer.domElement.addEventListener('pointercancel', dropPointer, true);

  // twist the cap off by dragging it
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let dragging = false, dragX = 0, dragOpen = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    // LEFT button only. Right-drag is pan, and grabbing it here would disable
    // OrbitControls and start a twist instead of panning.
    if (e.button !== 0) return;
    ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (ray.intersectObject(runtime.nodes['lid-assembly'], true).length) {
      dragging = true; idle = false; dragX = e.clientX; dragOpen = openTarget;
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = 'grabbing';
    }
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    applyNow(dragOpen - (e.clientX - dragX) / 260);
  });
  const endDrag = () => {
    dragging = false; controls.enabled = true;
    renderer.domElement.style.cursor = '';
  };
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', endDrag);

  // -------------------------------------------------------------- loop
  let camTween = null;
  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), .05);

    if (Math.abs(openTarget - openCurrent) > 1e-4) {
      openCurrent += (openTarget - openCurrent) * Math.min(1, dt * 4.2);
      runtime.setOpen(openCurrent);
      slider.value = String(openCurrent);
      updateHud();
    }
    if (spinning) jar.rotation.y += dt * .35;
    if (idle) jar.rotation.y += dt * .12;          // slow drift until the visitor touches it

    const tweening = !!camTween;
    if (tweening) {
      camTween.t = Math.min(1, camTween.t + dt * .9);
      const e = camTween.t * camTween.t * (3 - 2 * camTween.t);
      camera.position.lerpVectors(camTween.from, camTween.to, e);
      controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
      if (camTween.t >= 1) camTween = null;
    } else {
      autoFrame(Math.min(1, dt * 3));
    }

    controls.update();
    clampTarget();
    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(() => {
    document.getElementById('loader').classList.add('gone');
    tick();
  });

  // public handle — drive the jar from the console:
  //   __pc.open(1)  // on the thread, 2.25 turns
  //   __pc.open(2)  // cap off and set aside
  //   __pc.runtime.dimensions
  window.__pc = {
    renderer, scene, camera, controls, jar, runtime, THREE,
    open: (v) => applyNow(v),
    shot(sw = 1400, sh = 880) {               // render + read back in one task
      const w = renderer.domElement.width, h = renderer.domElement.height, a = camera.aspect;
      camera.aspect = sw / sh; camera.updateProjectionMatrix();
      renderer.setSize(sw, sh, false);
      controls.update();
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setSize(w, h, false);
      camera.aspect = a; camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      return url;
    },
  };

  // Debug handle. The Browser pane reports visibility:hidden to tool sessions,
  // so it stops compositing and a screenshot times out; the renderer still
  // draws on demand, so a review can call render() + toDataURL() through this.
  const handle = { renderer, scene, camera, controls, runtime, jar, label };
  window.__viewer = handle;
  return handle;
}

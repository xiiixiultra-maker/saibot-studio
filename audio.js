// Saibot Tower sound: real recordings, no synth (the engine, tyres, rain and wind).
// web/sound/ is built by _source/audio/build_sounds.py: the engine is one real Porsche (Freesound, CC0); rain, city,
// tyres, wind, the elevator and the switches come from the Sonniss GDC library; the ding is a VSCO 2 glockenspiel (CC0).
//   ride.mp3    one mix on the ride's own clock: START, crank and catch, pull-out, tyres, doors, climb, ding, lights, off
//   seat.mp3    loop: rain on the roof while you sit in the car (on replay; a first visit is silent until a tap)
//   floor.mp3   loop: floor 18 at night, rain on the glass, the city far below, the lamps
//   click, button, whoosh_in, whoosh_out, lights: taps, the cab's floor buttons, flying in and out, lights on
// iPhone rule: sound only unlocks on the finger LIFT, so wake() runs on pointerup /
// touchend / click / keyup, never on pointerdown.

const BASE = 'sound/';
const NAMES = ['stereo', 'ride', 'seat', 'floor', 'click', 'button', 'whoosh_in', 'whoosh_out', 'door', 'lights'];
const LATE = new Set(['ride', 'floor']);   // not needed at the curb: fetched by loadLate() after START

const SILENT_WAV = (() => {
  // 0.5 s of 8 kHz 8-bit silence; looped by an <audio> element so iOS treats the page as
  // media playback and the ring/silent switch does not mute the WebAudio sound
  const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  // a data: URI, not a blob: URL, so locked-down frames (the private test link) still allow it
  try { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return 'data:audio/wav;base64,' + btoa(s); } catch (e) { return null; }
})();

// the private test link may not serve .mp3: then the same bytes ride in <file>.json as base64 (like the scene files)
async function getBytes(url) {
  try {
    const r = await fetch(url);
    if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) return await r.arrayBuffer();
  } catch (e) { /* try the wrapped copy */ }
  const r = await fetch(url + '.json');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const bin = atob((await r.json()).b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function decode(ctx, ab) {
  return new Promise((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(ab, resolve, reject);   // older Safari only takes the callbacks
      if (p && p.then) p.then(resolve, reject);
    } catch (e) { reject(e); }
  });
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.unlocked = false;
    this.rideBus = null;
    this.rideSrc = null;
    this.rideId = 0;
    this.el = null;
    this.buf = {};          // name -> AudioBuffer
    this.raw = {};          // name -> ArrayBuffer waiting for a context (browsers without OfflineAudioContext)
    this.man = null;        // sounds.json
    this.loading = null;
    this.lateLoading = null;
    this.loops = {};        // 'seat' | 'floor' -> { s, g }
    this.ambKind = 'floor';
    this.wantAmb = false;
    this.wasRunning = false;
    this.listeners = new Set();   // called with the AudioContext state on every change
    this.load();                  // the files download while the scene loads; decoding needs no tap
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  get state() { return this.ctx ? this.ctx.state : 'none'; }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }

  load() {                        // what the curb needs (speed pass 11/16: the ride and floor sounds wait, loadLate)
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        this.man = await (await fetch(BASE + 'sounds.json', { cache: 'no-cache' })).json();
      } catch (e) { console.warn('sound: no sounds.json', e && e.message); return; }
      await this._fetch(NAMES.filter((k) => !LATE.has(k)));
    })();
    return this.loading;
  }

  // the floor room and the live ride's mix: after START (or when first asked for), not on the way to the curb
  loadLate() {
    if (!this.lateLoading) this.lateLoading = this.load().then(() => this._fetch([...LATE]));
    return this.lateLoading;
  }

  async _fetch(names) {
    if (!this.man) return;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let dec = null;
    try { dec = OAC ? new OAC(2, 1, 48000) : null; } catch (e) { dec = null; }
    await Promise.all(names.filter((k) => this.man[k] && !this.buf[k]).map(async (k) => {
      try {
        const ab = await getBytes(BASE + this.man[k].file);
        if (dec) this.buf[k] = await decode(dec, ab);
        else if (this.ctx) this.buf[k] = await decode(this.ctx, ab);
        else this.raw[k] = ab;
      } catch (e) { console.warn('sound ' + k + ':', e && e.message); }
    }));
  }

  // finger DOWN: build the audio graph early (opening the audio device can take ~60 ms),
  // but do not try to start it here; iPhones only allow that on the lift
  prepare() {
    try { this.ensure(); } catch (e) { /* sound is optional */ }
  }

  ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || this.ctx) return !!this.ctx;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    // the files are mastered; this only catches one-shots stacking on the ride
    const lim = this.ctx.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.2;
    this.master.connect(lim); lim.connect(this.ctx.destination);
    this.ctx.onstatechange = () => { for (const fn of [...this.listeners]) fn(this.ctx.state); };
    for (const [k, ab] of Object.entries(this.raw)) {
      delete this.raw[k];
      decode(this.ctx, ab).then((b) => { this.buf[k] = b; }, () => {});
    }
    return true;
  }

  // call inside every user gesture (finger lift); safe to call many times
  wake() {
    try {
      if (!this.ensure()) return;
      if (navigator.audioSession) {
        try { if (navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* older WebKit */ }
      }
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      if (!this.unlocked) {
        const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource();
        s.buffer = b; s.connect(this.ctx.destination); s.start(0);
        this.unlocked = true;
      }
      if (SILENT_WAV && !this.muted) {
        if (!this.el) {
          this.el = document.createElement('audio');
          this.el.src = SILENT_WAV; this.el.loop = true;
          this.el.setAttribute('playsinline', ''); this.el.setAttribute('aria-hidden', 'true');
        }
        if (this.el.paused) { const p = this.el.play(); if (p && p.catch) p.catch(() => {}); }
      }
    } catch (e) { /* sound is optional */ }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03);
    if (this.el) { if (m) this.el.pause(); }
  }

  // away from the tab: the ride's picture keeps its own clock, so its sound stops; the room loops pause
  pageHidden(hidden) {
    if (hidden) {
      if (this.el) this.el.pause();
      this.stopRide();
      if (this.running) { this.wasRunning = true; this.ctx.suspend().catch(() => {}); }
    } else if (this.wasRunning && this.ctx && !this.muted) {
      this.wasRunning = false;
      this.ctx.resume().catch(() => {});     // if the phone says no, the next tap's wake() brings it back
    }
  }

  // ---------- playing a recording ----------
  _play(name, o = {}) {
    const b = this.buf[name];
    if (!b || !this.running) return null;
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = b;
    if (o.rate) s.playbackRate.value = o.rate;
    g.gain.value = o.gain == null ? 1 : o.gain;
    s.connect(g); g.connect(o.bus || this.master);
    s.start(c.currentTime + 0.005, o.offset || 0);
    s.onended = () => { try { g.disconnect(); } catch (e) { /* gone */ } };
    return { s, g };
  }

  // ---------- the ride: one mix on the ride clock; t = seconds since the START tap ----------
  ride(elapsed = 0) {
    if (!this.ctx) return;
    this.stopRide();
    const id = this.rideId;
    const t0 = performance.now() - elapsed * 1000;
    let off = null;
    const go = () => {
      if (id !== this.rideId) { if (off) { off(); off = null; } return; }
      if (this.rideBus || !this.running || !this.buf.ride) return;
      if (off) { off(); off = null; }
      // sound unlocked or decoded late: a beat late still plays from the top (the button, the crank); later than
      // that it joins the picture where it is
      const el = (performance.now() - t0) / 1000;
      if (el > this.buf.ride.duration - 1) return;
      const bus = this.rideBus = this.ctx.createGain();
      bus.connect(this.master);
      const src = this.rideSrc = this._play('ride', { bus, offset: el < 0.35 ? 0 : el });
      if (src) {
        src.s.addEventListener('ended', () => {
          if (this.rideSrc !== src) return;
          this.rideSrc = null; this.rideBus = null;
          try { bus.disconnect(); } catch (e) { /* gone */ }
        });
      }
    };
    off = this.on(go);
    this.loadLate().then(go);
    go();
  }

  stopRide() {
    this.rideId++;
    if (this.rideBus && this.ctx) {
      const b = this.rideBus, src = this.rideSrc, now = this.ctx.currentTime;
      b.gain.setTargetAtTime(0.0001, now, 0.08);
      if (src) { try { src.s.stop(now + 0.6); } catch (e) { /* already stopped */ } }
      setTimeout(() => { try { b.disconnect(); } catch (e) { /* gone */ } }, 800);
    }
    this.rideBus = null;
    this.rideSrc = null;
  }

  lightsUp() { this._play('lights'); }

  blip() { /* the gray box's light blips; the lights are one recording now (lightsUp) */ }

  // ---------- room loops: 'seat' (in the car before START) or 'floor' (floor 18) ----------
  ambient(on, where) {
    if (where) this.ambKind = where;
    this.wantAmb = on;
    if (!this.running) return;      // app.js calls ambient(sound.wantAmb) again once sound runs
    for (const k of Object.keys(this.loops)) if (!on || k !== this.ambKind) this._stopLoop(k);
    if (on && !this.loops[this.ambKind]) this._startLoop(this.ambKind);
  }

  _startLoop(kind) {
    const b = this.buf[kind], spec = this.man && this.man[kind];
    if (!b || !spec) {
      (LATE.has(kind) ? this.loadLate() : this.load()).then(() => {
        if (this.wantAmb && this.ambKind === kind && this.running && !this.loops[kind] && this.buf[kind]) this._startLoop(kind);
      });
      return;
    }
    const [M, L] = spec.loop;      // the file is [last M s] + loop + [first M s]: loop between M and M + L
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), now = c.currentTime;
    s.buffer = b; s.loop = true; s.loopStart = M; s.loopEnd = M + L;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(1, now + 1.5);
    s.connect(g); g.connect(this.master);
    s.start(now, M + Math.random() * L * 0.9);      // somewhere new in the room each time
    this.loops[kind] = { s, g };
  }

  _stopLoop(kind) {
    const l = this.loops[kind];
    if (!l) return;
    delete this.loops[kind];
    const now = this.ctx.currentTime;
    l.g.gain.cancelScheduledValues(now);
    l.g.gain.setValueAtTime(Math.max(0.0001, l.g.gain.value), now);
    l.g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    try { l.s.stop(now + 0.9); } catch (e) { /* already stopped */ }
  }

  // ---------- the car stereo: the 808 beat (compose_stereo.py), heard from where the camera is ----------
  // 808s only, distorted. It never
  // restarts: seat, ride, floor 18 and the offices are one long loop; only its filter and level move.
  stereo(on) {
    this.wantStereo = on;
    if (!this.running) return;      // app.js calls stereo(true) again once sound runs
    if (on && !this.stereoSrc) this._startStereo();
    else if (!on && this.stereoSrc) this._stopStereo();
  }

  _startStereo() {
    const b = this.buf.stereo, spec = this.man && this.man.stereo;
    if (!b || !spec) {
      this.load().then(() => { if (this.wantStereo && this.running && !this.stereoSrc && this.buf.stereo) this._startStereo(); });
      return;
    }
    const c = this.ctx, s = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain(), now = c.currentTime;
    const [M, L] = spec.loop;
    s.buffer = b; s.loop = true; s.loopStart = M; s.loopEnd = M + L;
    lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.value = this.stereoF || 18000;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.stereoG || 0.5), now + 1.2);
    s.connect(lp); lp.connect(g); g.connect(this.master);
    s.start(now, M);                // from bar 1
    this.stereoSrc = s; this.stereoLp = lp; this.stereoGain = g;
  }

  _stopStereo() {
    const s = this.stereoSrc, g = this.stereoGain, now = this.ctx.currentTime;
    this.stereoSrc = this.stereoLp = this.stereoGain = null;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.2);
    try { s.stop(now + 1.2); } catch (e) { /* already stopped */ }
  }

  // inCar 1 = in the seat (clear), 0 = outside the car (the 808s through the body: low-passed, felt more than heard);
  // far 1 = in an office, away from the car (a faint thump). Called every frame; the params glide.
  stereoAt(inCar, far = 0) {
    let f = 240 * Math.pow(18000 / 240, inCar);
    let g = 0.5 * inCar + 0.62 * (1 - inCar);
    if (far) { f += (150 - f) * far; g += (0.16 - g) * far; }
    this.stereoF = f; this.stereoG = g;
    if (!this.stereoSrc) return;
    const now = this.ctx.currentTime;
    this.stereoLp.frequency.setTargetAtTime(f, now, 0.06);
    this.stereoGain.gain.setTargetAtTime(g, now, 0.08);
  }

  // ---------- taps ----------
  ui(kind) {
    if (!this.running) return;
    if (kind === 'hover') this._play('click', { gain: 0.16, rate: 1.15 });
    else if (kind === 'tap') this._play('click', { gain: 0.6 });               // lighting an office = a wall switch
    else if (kind === 'panel') this._play('button', { gain: 0.8 });            // a floor button in the cab
    else if (kind === 'in') this._play('whoosh_in', { gain: 0.8 });
    else if (kind === 'out') this._play('whoosh_out', { gain: 0.8 });
    else if (kind === 'door') this._play('door', { gain: 0.75 });               // stepping out of the car / back in
  }
}

// sound is optional: an audio error on any phone must never stop the ride, a tap or Back
for (const name of ['ride', 'stopRide', 'blip', 'lightsUp', 'ambient', 'stereo', 'stereoAt', 'ui', 'setMuted', 'pageHidden']) {
  const fn = Sound.prototype[name];
  Sound.prototype[name] = function (...args) {
    try { return fn.apply(this, args); } catch (e) { console.warn('sound ' + name + ':', e && e.message); return undefined; }
  };
}

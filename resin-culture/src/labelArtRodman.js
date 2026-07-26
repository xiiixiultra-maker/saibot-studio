/**
 * Wrap artwork for the Resin Culture "RODMAN" release —
 * Gary Payton x Rainbow Guava.
 *
 * Same jar, same mould, different label. Built from the reference set
 * (IMG_8834..8844).
 *
 * This label is nothing like the Sour Diesel BX2 street scene. That one is
 * printed paper: brick, spray paint, matte ink. This one is HOLOGRAPHIC FOIL
 * on near-black, and almost everything about the build follows from that:
 *
 *   - the base is metallic, not paper, so the metalness mask covers the whole
 *     wrap rather than just a gold strip
 *   - the "colour" of a foil is mostly the environment it reflects, so the
 *     albedo stays dark and the roughness map does the heavy lifting. The
 *     diagonal roughness banding is what makes it flash as the jar turns
 *   - the fine horizontal scanlines and the vertical data rules are real
 *     printed structure on the foil, visible in every reference shot
 *
 * Body wrap, going around:
 *   0.50  RODMAN                    arched varsity caps, red/pink chrome
 *   0.75  RESIN CULTURE + portrait  gold holo over a stylised figure
 *   0.00  SMALL BATCH / SINGLE SOURCE
 *   0.25  GARY PAYTON / RAINBOW GUAVA in green chips
 *   plus green divider bands, and a green product strip along the bottom
 *
 * Cap skirt wrap:
 *   the top of the RODMAN arch crosses the seam, so the skirt carries the
 *   upper third of the hero lettering plus the green chips and the rule work
 *
 * Cap top:
 *   the sun/moon emblem — a ringed eye between two solar faces, RESIN down
 *   the left in orange, CULTURE down the right in teal, HASH CLUB beneath
 *
 * NOTE ON THE PORTRAIT: the reference carries a photographic portrait. This
 * builds a stylised graphic figure instead of attempting a likeness of a real
 * person — at jar scale what reads is the silhouette and the red hair, and a
 * procedural near-miss of a real face reads as uncanny rather than as the
 * product.
 */
import { mulberry32, heightToNormal } from './labelTextures.js';

const FONT_HEAVY = "'Arial Black', Impact, 'Haettenschweiler', sans-serif";
const FONT_COND = "Impact, 'Arial Narrow', 'Arial Black', sans-serif";

/** Read off the reference crops under daylight and under the phone LED. */
export const PR = {
  // the foil itself: almost black until it catches something
  base: '#0A0F0B',
  baseLift: '#16241A',
  scan: 'rgba(126,226,150,0.055)',

  // the bright printed green: chips, bands, rules
  green: '#35B23C',
  greenHot: '#7CE85C',
  greenDeep: '#12561D',
  greenInk: '#0B2410',

  // RODMAN chrome
  redDeep: '#8E1226',
  red: '#D2213F',
  redHot: '#F4527A',
  redPale: '#FFB3C4',

  gold: '#C9A24B',
  goldLite: '#F2DFA2',
  goldDeep: '#7A5C1E',

  // cap emblem
  emberOrange: '#E2622A',
  emberDeep: '#8E3312',
  teal: '#3FBFA8',
  tealDeep: '#175F55',

  ink: '#0B0D0A',
  bone: '#EFEAE0',
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tooth(ctx, w, h, rnd, amount = 10) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

const at = (f, W) => (((f % 1) + 1) % 1) * W;

// ---------------------------------------------------------------- foil base

/**
 * Dark foil ground: a near-black field, broad iridescent washes, then the
 * printed horizontal scanline structure.
 *
 * The washes go into the ALBEDO only as a hint. Real holographic flash comes
 * from the roughness banding built later — painting a rainbow into the albedo
 * and calling it done gives you a sticker that looks the same from every
 * angle, which is exactly what a hologram is not.
 */
function foilGround(ctx, W, H, rnd) {
  ctx.fillStyle = PR.base;
  ctx.fillRect(0, 0, W, H);

  // broad green/gold sheen, brightest across the middle band
  const sheen = ctx.createLinearGradient(0, 0, 0, H);
  sheen.addColorStop(0.00, 'rgba(12,22,14,0.0)');
  sheen.addColorStop(0.34, 'rgba(58,132,66,0.30)');
  sheen.addColorStop(0.52, 'rgba(126,190,96,0.20)');
  sheen.addColorStop(0.70, 'rgba(40,104,52,0.26)');
  sheen.addColorStop(1.00, 'rgba(10,18,12,0.0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  // diagonal iridescent streaks, low alpha, wandering hue
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const w = W * (0.010 + rnd() * 0.035);
    const hue = 90 + rnd() * 90;            // green through gold
    const g = ctx.createLinearGradient(x, 0, x + w, H);
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `hsla(${hue},70%,${34 + rnd() * 22}%,${0.10 + rnd() * 0.16})`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, H);
  }
  // a couple of magenta ones, the giveaway that it is a rainbow foil
  for (let i = 0; i < 5; i++) {
    const x = rnd() * W, w = W * (0.006 + rnd() * 0.016);
    const g = ctx.createLinearGradient(x, 0, x + w, H);
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(224,96,180,${0.08 + rnd() * 0.10})`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, H);
  }
  ctx.restore();

  // printed scanlines
  ctx.save();
  ctx.strokeStyle = PR.scan;
  ctx.lineWidth = Math.max(1, H * 0.0045);
  const step = H / 46;
  for (let y = step * 0.5; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();
}

/**
 * The vertical rule work: thin bright-green verticals with tick marks and
 * little bars of micro-print. The reference has real text in there, far too
 * small to resolve at any sane texture size, so this renders it as the bars
 * it actually reads as rather than as fake lorem ipsum.
 */
function dataRules(ctx, W, H, rnd, positions) {
  ctx.save();
  for (const f of positions) {
    const x = at(f, W);
    ctx.strokeStyle = 'rgba(88,196,102,0.30)';
    ctx.lineWidth = Math.max(1.4, W * 0.0007);
    ctx.beginPath(); ctx.moveTo(x, H * 0.06); ctx.lineTo(x, H * 0.94); ctx.stroke();

    // corner ticks
    ctx.lineWidth = Math.max(1.6, W * 0.0009);
    const tk = W * 0.006;
    for (const y of [H * 0.06, H * 0.94]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (y < H / 2 ? tk : -tk), y);
      ctx.stroke();
    }

    // micro-print bars
    ctx.fillStyle = 'rgba(110,200,122,0.16)';
    const n = 5 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const bw = W * (0.004 + rnd() * 0.012);
      const by = H * (0.14 + rnd() * 0.70);
      ctx.fillRect(x + W * 0.004, by, bw, Math.max(1.2, H * 0.012));
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- lettering

/**
 * Chrome fill. Built through a callback so the gradient is created in the
 * LETTER's local space, after the transform.
 *
 * Building it in canvas space and filling after a per-letter translate() is a
 * silent trap: every glyph lands past the gradient's end stop and comes out
 * flat, which is how the first jar's wordmark ended up one solid cream colour.
 */
function chromeStyle(deep, mid, hot, pale) {
  return (c, sz) => {
    const g = c.createLinearGradient(0, -sz * 0.60, 0, sz * 0.60);
    g.addColorStop(0.00, pale);     // sky
    g.addColorStop(0.16, mid);
    g.addColorStop(0.46, deep);     // the dark band above the horizon
    g.addColorStop(0.52, hot);      // horizon flash
    g.addColorStop(0.60, deep);
    g.addColorStop(0.86, mid);
    g.addColorStop(1.00, pale);     // ground bounce
    return g;
  };
}

/**
 * World geometry of the two printed wraps, in millimetres, mirroring DIM in
 * createJarModel.js.
 *
 * The hero arch is authored ONCE in world space and each wrap renders the
 * slice of it that lands inside its own band. That is the only way the two
 * halves meet across the seam: the body canvas is W/7.96 and the skirt is
 * W/11.1, so the same fraction-of-canvas baseline sits at two different
 * heights on the jar and the wordmark tears at the join.
 */
const WRAP = {
  R: 25.0,
  body: { y0: 1.60, y1: 23.40, aspect: 7.96 },     // LABEL_BODY_Y .. +LABEL_BODY_H
  skirt: { y0: 23.75, y1: 39.15, aspect: 11.1 },   // Y_SEAM + 0.1 .. +LABEL_SKIRT_H
};
WRAP.C = 2 * Math.PI * WRAP.R;                     // 157.08 mm around

/**
 * The RODMAN arch, in world millimetres. Shared by both wraps.
 *
 * Solved rather than eyeballed, because three things have to hold at once:
 *
 *   width   6 glyphs at 11.5 mm cap height run about 50.7 mm of arc, which is
 *           32% of the 157.08 mm circumference — the hero owns roughly a third
 *           of the way round, as in the reference
 *   bow     spread = 50.7 / 68 = 0.745 rad (43 deg). At radius 47 it came out
 *           at 66 deg, far rounder than the shallow reference arch
 *   seam    centre letters span 15.25..26.75 mm, so 3.0 mm of glyph — about a
 *           quarter of the cap height — carries onto the skirt above the
 *           23.75 mm join. The end letters drop 68 * (1 - cos(0.373)) = 4.7 mm
 *           and stay well inside the body wrap.
 */
const HERO = {
  cxFrac: 0.50,
  baseY: 21.0,      // world Y of the letter centres
  radius: 68.0,     // shallow bow, not a semicircle
  size: 11.5,       // cap height
};

/**
 * Letters set along a circular arc, tangent to it — the collegiate arch the
 * RODMAN wordmark sits on. Authored in world mm, mapped into whichever wrap
 * canvas is passed in.
 *
 * The arc angle is DERIVED from the glyph metrics (spread = arcLength/radius),
 * never authored. Picking an angle by eye and hoping the word fits is how the
 * first attempt came out as overlapping mush: 'RODMAN' at that size needed
 * 0.217W of arc and the hand-picked 0.86 rad only gave it 0.129W.
 *
 * Returns the placements so the roughness and metalness masks re-stamp the
 * identical layout instead of recomputing it.
 */
export function heroArch(ctx, W, H, wrap, opts = {}) {
  const sx = W / WRAP.C;                    // px per mm around — same both wraps
  const sy = H / (wrap.y1 - wrap.y0);       // px per mm up — differs per wrap
  const sizePx = HERO.size * sy;
  // the wrap textures are not square to the jar, so pre-widen the glyphs by the
  // exact anisotropy; they come out correct once mapped onto the cylinder
  const widen = sx === 0 ? 1 : (sy / sx);

  const chars = opts.text ? opts.text.split('') : 'RODMAN'.split('');
  ctx.save();
  ctx.font = `${sizePx}px ${FONT_HEAVY}`;
  const tracking = opts.tracking ?? 1.02;
  const widths = chars.map((ch) => ctx.measureText(ch).width * widen * tracking);
  const totalPx = widths.reduce((a, b) => a + b, 0);

  const radiusPx = HERO.radius * sx;
  const spread = (totalPx / sx) / HERO.radius;   // arc length over radius

  const cxPx = at(HERO.cxFrac, W) + (opts.offsetX ?? 0);
  const baseYmm = HERO.baseY;

  const placed = [];
  let acc = 0;
  for (let i = 0; i < chars.length; i++) {
    const frac = (acc + widths[i] / 2) / totalPx;
    acc += widths[i];
    const ang = -spread / 2 + frac * spread;
    // position on the arc, in mm, then into this canvas
    const xmm = (cxPx / sx) + Math.sin(ang) * HERO.radius;
    const ymm = baseYmm - HERO.radius + Math.cos(ang) * HERO.radius;
    placed.push({
      ch: chars[i],
      x: xmm * sx,
      y: (wrap.y1 - ymm) * sy,
      rot: ang,
    });
  }

  const stamp = (dx, dy, styleFor, strokeW) => {
    for (const p of placed) {
      ctx.save();
      ctx.translate(p.x + dx, p.y + dy);
      ctx.rotate(p.rot);
      ctx.scale(widen, 1);
      ctx.font = `${sizePx}px ${FONT_HEAVY}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const style = styleFor(ctx, sizePx);
      if (strokeW) {
        ctx.lineJoin = 'miter'; ctx.miterLimit = 2.6;
        ctx.lineWidth = strokeW / widen; ctx.strokeStyle = style;
        ctx.strokeText(p.ch, 0, 0);
      } else {
        ctx.fillStyle = style; ctx.fillText(p.ch, 0, 0);
      }
      ctx.restore();
    }
  };

  if (opts.maskOnly) {
    stamp(0, 0, () => opts.maskOnly, sizePx * 0.14);
    stamp(0, 0, () => opts.maskOnly, 0);
    ctx.restore();
    return placed;
  }

  const flat = (c) => () => c;
  // Keyline width matters more than it looks. A stroke is centred on the
  // outline, so 0.30 of the font size put 0.15 of solid black OUTSIDE every
  // glyph — thicker than the 3 mm of letter that shows above the seam, so the
  // entire cross-seam sliver rendered as outline and the wordmark looked like
  // it stopped dead at the join.
  stamp(sizePx * 0.04, sizePx * 0.05, flat('rgba(6,4,4,0.55)'), sizePx * 0.18);
  stamp(0, 0, flat(PR.ink), sizePx * 0.14);                   // keyline
  stamp(0, 0, flat(PR.redDeep), sizePx * 0.07);               // deep red edge
  stamp(0, 0, chromeStyle(PR.redDeep, PR.red, PR.redHot, PR.redPale), 0);
  stamp(0, -sizePx * 0.22, (c, sz) => {                        // wet chrome edge
    const g = c.createLinearGradient(0, -sz * 0.5, 0, -sz * 0.22);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    return g;
  }, 0);

  ctx.restore();
  return placed;
}

/** Flat holo-gold caps, letter-spaced. Used for RESIN / CULTURE. */
function goldWord(ctx, text, cx, cy, size, opts = {}) {
  const spacing = opts.spacing ?? 1.14;
  const mask = opts.maskOnly;
  ctx.save();
  ctx.font = `${size}px ${FONT_HEAVY}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = text.split('');
  const widths = chars.map((ch) => ctx.measureText(ch).width * spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  for (let i = 0; i < chars.length; i++) {
    const w = widths[i];
    ctx.save();
    ctx.translate(x + w / 2, cy);
    ctx.scale(1, opts.stretch ?? 1.18);
    ctx.font = `${size}px ${FONT_HEAVY}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (mask) {
      ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.20; ctx.strokeStyle = mask;
      ctx.strokeText(chars[i], 0, 0);
      ctx.fillStyle = mask; ctx.fillText(chars[i], 0, 0);
    } else {
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.26; ctx.strokeStyle = 'rgba(6,14,8,0.85)';
      ctx.strokeText(chars[i], 0, 0);
      const g = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
      g.addColorStop(0.00, PR.goldLite);
      g.addColorStop(0.34, PR.gold);
      g.addColorStop(0.52, PR.goldDeep);
      g.addColorStop(0.68, PR.gold);
      g.addColorStop(1.00, '#FFF3C4');
      ctx.fillStyle = g; ctx.fillText(chars[i], 0, 0);
    }
    ctx.restore();
    x += w;
  }
  ctx.restore();
}

/** Text running bottom-to-top, for the green divider bands. */
function verticalText(ctx, text, x, cy, size, color, opts = {}) {
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `700 ${size}px ${FONT_COND}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (opts.track) {
    const chars = text.split('');
    const w = chars.map((c) => ctx.measureText(c).width + opts.track);
    const total = w.reduce((a, b) => a + b, 0);
    let p = -total / 2;
    ctx.fillStyle = color;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], p + w[i] / 2, 0);
      p += w[i];
    }
  } else {
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}

// ------------------------------------------------------------------- pieces

/** A bright green divider band running the full label height. */
function greenBand(ctx, W, H, f, wFrac, rnd) {
  const x = at(f, W) - W * wFrac / 2;
  const w = W * wFrac;
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0.00, '#0C3D14');
  g.addColorStop(0.22, PR.greenDeep);
  g.addColorStop(0.50, PR.green);
  g.addColorStop(0.78, PR.greenDeep);
  g.addColorStop(1.00, '#0C3D14');
  ctx.fillStyle = g;
  ctx.fillRect(x, 0, w, H);

  // horizontal foil banding inside the green
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#0A2A10';
  for (let y = 0; y < H; y += H / 30) ctx.fillRect(x, y, w, H / 90);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(8,30,12,0.75)';
  ctx.lineWidth = Math.max(1.5, W * 0.0009);
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w, 0); ctx.lineTo(x + w, H); ctx.stroke();
  ctx.restore();
  return { x, w };
}

/** A green chip carrying red strain text — GARY PAYTON, RAINBOW GUAVA. */
function strainChip(ctx, cx, cy, w, h, text, size) {
  ctx.save();
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0.00, PR.greenHot);
  g.addColorStop(0.45, PR.green);
  g.addColorStop(1.00, PR.greenDeep);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h * 0.16); ctx.fill();
  ctx.strokeStyle = 'rgba(6,26,10,0.8)';
  ctx.lineWidth = Math.max(1.4, h * 0.05);
  ctx.stroke();

  ctx.font = `700 ${size}px ${FONT_COND}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22; ctx.strokeStyle = 'rgba(40,4,10,0.75)';
  ctx.strokeText(text, cx, cy);
  const rg = ctx.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.5);
  rg.addColorStop(0.00, PR.redPale);
  rg.addColorStop(0.40, PR.redHot);
  rg.addColorStop(0.62, PR.red);
  rg.addColorStop(1.00, PR.redDeep);
  ctx.fillStyle = rg;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

/**
 * Stylised figure behind RESIN CULTURE. Deliberately graphic, not photographic:
 * a dark bust silhouette, the distinctive red hair, and holo streaks across it.
 */
function figure(ctx, cx, cy, w, h, rnd) {
  ctx.save();

  // holo plate the figure sits on
  const plate = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.62);
  plate.addColorStop(0.0, 'rgba(150,190,210,0.30)');
  plate.addColorStop(0.55, 'rgba(80,120,140,0.16)');
  plate.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.62, h * 0.60, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const yy = cy - h * 0.4 + rnd() * h * 0.8;
    const g = ctx.createLinearGradient(cx - w * 0.5, yy, cx + w * 0.5, yy);
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.3, `hsla(${rnd() * 300},80%,60%,0.20)`);
    g.addColorStop(0.7, `hsla(${rnd() * 300},80%,60%,0.16)`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - w * 0.5, yy, w, h * 0.035);
  }
  ctx.restore();

  // shoulders
  ctx.fillStyle = 'rgba(14,18,20,0.88)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.40, cy + h * 0.50);
  ctx.quadraticCurveTo(cx - w * 0.30, cy + h * 0.12, cx, cy + h * 0.10);
  ctx.quadraticCurveTo(cx + w * 0.30, cy + h * 0.12, cx + w * 0.40, cy + h * 0.50);
  ctx.closePath(); ctx.fill();

  // head
  ctx.fillStyle = 'rgba(26,30,32,0.92)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - h * 0.10, w * 0.155, h * 0.235, 0, 0, Math.PI * 2);
  ctx.fill();

  // the hair — the thing that actually identifies the figure at 8 mm tall
  const hair = (ox, oy, r, rot) => {
    ctx.save();
    ctx.translate(cx + ox, cy + oy);
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0.0, '#FF6A54');
    g.addColorStop(0.5, '#D8281E');
    g.addColorStop(1.0, '#7E1410');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  hair(-w * 0.155, -h * 0.30, w * 0.085, -0.4);
  hair(w * 0.150, -h * 0.30, w * 0.080, 0.4);
  hair(0, -h * 0.355, w * 0.085, 0);

  ctx.restore();
}

// =============================================================== BODY WRAP
export function buildBodyLabelRodman(W = 4096) {
  const H = Math.round(W / 7.96);          // matches the body wrap cylinder
  const rnd = mulberry32(0x0D3A11);
  const albedo = makeCanvas(W, H);
  const a = albedo.getContext('2d');

  foilGround(a, W, H, rnd);
  dataRules(a, W, H, mulberry32(0x11CE), [0.115, 0.325, 0.435, 0.565, 0.675, 0.885]);

  // green divider bands, both sides of the hero
  greenBand(a, W, H, 0.625, 0.030, rnd);
  greenBand(a, W, H, 0.375, 0.030, rnd);
  // sized so the run fits inside H: vertical text is bounded by the label
  // HEIGHT, not its width, and the first pass overshot by 40%
  verticalText(a, 'PREMIUM LIVE ROSIN', at(0.625, W), H * 0.5, H * 0.078, PR.greenInk, { track: H * 0.006 });
  verticalText(a, 'COLD CURE · 2G', at(0.375, W), H * 0.5, H * 0.082, PR.greenInk, { track: H * 0.006 });

  // ---- zone 0.75: RESIN CULTURE over the figure ---------------------------
  const drawResin = (ox) => {
    figure(a, at(0.75, W) + ox, H * 0.52, W * 0.150, H * 0.86, mulberry32(0xF16));
    goldWord(a, 'RESIN', at(0.75, W) + ox - W * 0.028, H * 0.34, H * 0.200, { spacing: 1.10 });
    goldWord(a, 'CULTURE', at(0.75, W) + ox + W * 0.020, H * 0.68, H * 0.185, { spacing: 1.06 });
  };
  drawResin(0); drawResin(W); drawResin(-W);

  // ---- zone 0.25: the strain ----------------------------------------------
  const drawStrain = (ox) => {
    const cx = at(0.25, W) + ox;
    strainChip(a, cx, H * 0.31, W * 0.128, H * 0.150, 'GARY PAYTON', H * 0.098);
    strainChip(a, cx, H * 0.52, W * 0.138, H * 0.150, 'RAINBOW GUAVA', H * 0.094);
    a.save();
    a.font = `700 ${H * 0.072}px ${FONT_COND}`;
    a.textAlign = 'center'; a.textBaseline = 'middle';
    a.fillStyle = 'rgba(150,225,160,0.72)';
    a.fillText('90 · 139U   ·   SINGLE SOURCE', cx, H * 0.72);
    a.restore();
  };
  drawStrain(0); drawStrain(W); drawStrain(-W);

  // ---- zone 0.00: SMALL BATCH / SINGLE SOURCE -----------------------------
  const drawBatch = (ox) => {
    const cx = at(0.0, W) + ox;
    goldWord(a, 'SMALL BATCH', cx, H * 0.38, H * 0.150, { spacing: 1.16, stretch: 1.10 });
    a.save();
    a.strokeStyle = 'rgba(190,230,150,0.5)';
    a.lineWidth = Math.max(1.4, H * 0.008);
    a.beginPath(); a.moveTo(cx - W * 0.060, H * 0.53); a.lineTo(cx + W * 0.060, H * 0.53); a.stroke();
    a.restore();
    goldWord(a, 'SINGLE SOURCE', cx, H * 0.67, H * 0.140, { spacing: 1.14, stretch: 1.10 });
  };
  drawBatch(0); drawBatch(W); drawBatch(-W);

  // ---- zone 0.50: RODMAN, the hero ----------------------------------------
  // Radius is deliberately large relative to the zone: the reference arch is
  // shallow, a gentle bow rather than a semicircle.
  const drawHero = (ox) => heroArch(a, W, H, WRAP.body, { offsetX: ox });
  drawHero(0); drawHero(W); drawHero(-W);

  tooth(a, W, H, rnd, 9);

  // ---- roughness: this is where the hologram actually lives ---------------
  const rw = W >> 1, rh = H >> 1;
  const rough = makeCanvas(rw, rh);
  const r = rough.getContext('2d');
  r.fillStyle = 'rgb(56,56,56)';                  // foil base, 0.22 — glossy
  r.fillRect(0, 0, rw, rh);

  // diagonal banding: alternating gloss so the sheen sweeps as the jar turns
  const bandRnd = mulberry32(0x8A11);
  r.save();
  for (let i = 0; i < 90; i++) {
    const x = bandRnd() * rw;
    const w = rw * (0.004 + bandRnd() * 0.020);
    const v = 26 + Math.floor(bandRnd() * 70);
    const g = r.createLinearGradient(x, 0, x + w, rh);
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(${v},${v},${v},0.85)`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    r.fillStyle = g;
    r.fillRect(x, 0, w, rh);
  }
  r.restore();

  r.save(); r.scale(rw / W, rh / H);
  // printed ink is duller than the foil it sits on
  for (const ox of [0, W, -W]) {
    heroArch(r, W, H, WRAP.body, { offsetX: ox, maskOnly: 'rgb(96,96,96)' });
    goldWord(r, 'RESIN', at(0.75, W) + ox - W * 0.028, H * 0.34, H * 0.200,
      { spacing: 1.10, maskOnly: 'rgb(84,84,84)' });
    goldWord(r, 'CULTURE', at(0.75, W) + ox + W * 0.020, H * 0.68, H * 0.185,
      { spacing: 1.06, maskOnly: 'rgb(84,84,84)' });
    goldWord(r, 'SMALL BATCH', at(0.0, W) + ox, H * 0.38, H * 0.150,
      { spacing: 1.16, stretch: 1.10, maskOnly: 'rgb(88,88,88)' });
    goldWord(r, 'SINGLE SOURCE', at(0.0, W) + ox, H * 0.67, H * 0.140,
      { spacing: 1.14, stretch: 1.10, maskOnly: 'rgb(88,88,88)' });
  }
  // the green bands are printed, not foil
  r.fillStyle = 'rgb(122,122,122)';
  for (const f of [0.625, 0.375]) r.fillRect(at(f, W) - W * 0.015, 0, W * 0.030, H);
  r.restore();
  tooth(r, rw, rh, mulberry32(0x2A2A), 22);

  // ---- metalness: the whole wrap is foil except the printed ink -----------
  const mw = W >> 1, mh = H >> 1;
  const metal = makeCanvas(mw, mh);
  const m = metal.getContext('2d');
  m.fillStyle = 'rgb(236,236,236)';               // foil
  m.fillRect(0, 0, mw, mh);
  m.save(); m.scale(mw / W, mh / H);
  m.fillStyle = 'rgb(150,150,150)';               // green bands: printed on foil
  for (const f of [0.625, 0.375]) m.fillRect(at(f, W) - W * 0.015, 0, W * 0.030, H);
  m.fillStyle = 'rgb(40,40,40)';                  // solid ink kills the metal
  for (const ox of [0, W, -W]) {
    heroArch(m, W, H, WRAP.body, { offsetX: ox, maskOnly: 'rgb(40,40,40)' });
    figure(m, at(0.75, W) + ox, H * 0.52, W * 0.150, H * 0.86, mulberry32(0xF16));
  }
  m.restore();

  const height = makeCanvas(rw, rh);
  const hc = height.getContext('2d');
  hc.fillStyle = 'rgb(112,112,112)'; hc.fillRect(0, 0, rw, rh);
  hc.save(); hc.scale(rw / W, rh / H);
  hc.fillStyle = 'rgb(178,178,178)';              // raised ink
  for (const ox of [0, W, -W]) {
    heroArch(hc, W, H, WRAP.body, { offsetX: ox, maskOnly: 'rgb(178,178,178)' });
  }
  hc.restore();
  tooth(hc, rw, rh, mulberry32(0x3B3B), 34);

  return {
    albedo, roughness: rough, height, metalness: metal,
    normal: heightToNormal(height, 1.5),
    // foil needs the environment; the paper default washes it out to grey
    material: { envMapIntensity: 1.35, clearcoat: 0.30, clearcoatRoughness: 0.18 },
  };
}

// ============================================================== SKIRT WRAP
export function buildSkirtLabelRodman(W = 4096) {
  const H = Math.round(W / 11.1);
  const rnd = mulberry32(0x0D3A22);
  const albedo = makeCanvas(W, H);
  const a = albedo.getContext('2d');

  foilGround(a, W, H, rnd);
  dataRules(a, W, H, mulberry32(0x22DE), [0.115, 0.325, 0.435, 0.565, 0.675, 0.885]);

  greenBand(a, W, H, 0.625, 0.030, rnd);
  greenBand(a, W, H, 0.375, 0.030, rnd);

  // the top of the hero arch crosses the seam onto the skirt. Same centre and
  // same radius as the body; only the baseline moves, so the two halves line
  // up across the join instead of drifting.
  const drawHeroTop = (ox) => heroArch(a, W, H, WRAP.skirt, { offsetX: ox });
  drawHeroTop(0); drawHeroTop(W); drawHeroTop(-W);

  // The skirt carries SECONDARY copy only. The body already owns RESIN
  // CULTURE and SMALL BATCH in these same columns directly below, and the
  // first pass repeated both, so the jar read the brand twice stacked on
  // itself. Each column now says one thing.
  const drawSkirtCopy = (ox) => {
    strainChip(a, at(0.25, W) + ox, H * 0.50, W * 0.118, H * 0.34, '90 · 139U', H * 0.20);
    goldWord(a, 'HASH CLUB', at(0.75, W) + ox, H * 0.50, H * 0.27, { spacing: 1.12 });
    a.save();
    a.font = `700 ${H * 0.215}px ${FONT_COND}`;
    a.textAlign = 'center'; a.textBaseline = 'middle';
    a.fillStyle = 'rgba(178,232,188,0.72)';
    a.fillText('2G  ·  COLD CURE', at(0.00, W) + ox, H * 0.50);
    a.restore();
  };
  drawSkirtCopy(0); drawSkirtCopy(W); drawSkirtCopy(-W);

  tooth(a, W, H, rnd, 9);

  const rw = W >> 1, rh = H >> 1;
  const rough = makeCanvas(rw, rh);
  const r = rough.getContext('2d');
  r.fillStyle = 'rgb(56,56,56)'; r.fillRect(0, 0, rw, rh);
  const bandRnd = mulberry32(0x9B22);
  for (let i = 0; i < 70; i++) {
    const x = bandRnd() * rw, w = rw * (0.004 + bandRnd() * 0.020);
    const v = 26 + Math.floor(bandRnd() * 70);
    const g = r.createLinearGradient(x, 0, x + w, rh);
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(${v},${v},${v},0.85)`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    r.fillStyle = g; r.fillRect(x, 0, w, rh);
  }
  r.save(); r.scale(rw / W, rh / H);
  for (const ox of [0, W, -W]) {
    heroArch(r, W, H, WRAP.skirt, { offsetX: ox, maskOnly: 'rgb(96,96,96)' });
    goldWord(r, 'HASH CLUB', at(0.75, W) + ox, H * 0.50, H * 0.27,
      { spacing: 1.12, maskOnly: 'rgb(84,84,84)' });
  }
  r.restore();
  tooth(r, rw, rh, mulberry32(0x4C4C), 22);

  const metal = makeCanvas(rw, rh);
  const m = metal.getContext('2d');
  m.fillStyle = 'rgb(236,236,236)'; m.fillRect(0, 0, rw, rh);
  m.save(); m.scale(rw / W, rh / H);
  m.fillStyle = 'rgb(40,40,40)';
  for (const ox of [0, W, -W]) {
    heroArch(m, W, H, WRAP.skirt, { offsetX: ox, maskOnly: 'rgb(40,40,40)' });
  }
  m.restore();

  const height = makeCanvas(rw, rh);
  const hc = height.getContext('2d');
  hc.fillStyle = 'rgb(112,112,112)'; hc.fillRect(0, 0, rw, rh);
  tooth(hc, rw, rh, mulberry32(0x5D5D), 34);

  return {
    albedo, roughness: rough, height, metalness: metal,
    normal: heightToNormal(height, 1.4),
    material: { envMapIntensity: 1.35, clearcoat: 0.30, clearcoatRoughness: 0.18 },
  };
}

// ================================================================= CAP TOP
/**
 * The emblem: a ringed eye between two solar faces, RESIN down the left in
 * orange, CULTURE down the right in teal.
 */
export function buildTopLabelRodman(S = 2048) {
  const rnd = mulberry32(0x50DEE0);
  const albedo = makeCanvas(S, S);
  const a = albedo.getContext('2d');
  const cx = S / 2, cy = S / 2;

  // dark foil ground with a green wash
  a.fillStyle = PR.base; a.fillRect(0, 0, S, S);
  const wash = a.createRadialGradient(cx, cy, S * 0.05, cx, cy, S * 0.52);
  wash.addColorStop(0.0, 'rgba(70,150,80,0.28)');
  wash.addColorStop(0.6, 'rgba(30,80,40,0.20)');
  wash.addColorStop(1.0, 'rgba(6,12,8,0.55)');
  a.fillStyle = wash; a.fillRect(0, 0, S, S);

  a.save();
  a.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    const x = rnd() * S, w = S * (0.008 + rnd() * 0.028);
    const g = a.createLinearGradient(x, 0, x + w, S);
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `hsla(${80 + rnd() * 110},70%,45%,0.16)`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    a.fillStyle = g; a.fillRect(x, 0, w, S);
  }
  a.restore();

  a.save();
  a.strokeStyle = 'rgba(120,220,140,0.05)';
  a.lineWidth = Math.max(1, S * 0.0016);
  for (let y = 0; y < S; y += S / 90) {
    a.beginPath(); a.moveTo(0, y); a.lineTo(S, y); a.stroke();
  }
  a.restore();

  // ---- solar rays, radiating from the centre -----------------------------
  const rayGold = (grad) => {
    grad.addColorStop(0.0, '#F6D778');
    grad.addColorStop(0.5, '#D89A2C');
    grad.addColorStop(1.0, '#8A5A14');
    return grad;
  };
  a.save();
  a.translate(cx, cy);
  const RAYS = 22;
  for (let i = 0; i < RAYS; i++) {
    const ang = (i / RAYS) * Math.PI * 2;
    // the ring occupies the horizontal band, so rays there are shortened
    const horiz = Math.abs(Math.cos(ang));
    const len = S * (0.44 - horiz * 0.10);
    const halfW = (Math.PI / RAYS) * 0.62;
    a.save();
    a.rotate(ang);
    a.beginPath();
    a.moveTo(0, 0);
    a.lineTo(Math.cos(-halfW) * len, Math.sin(-halfW) * len);
    a.lineTo(len * 1.04, 0);
    a.lineTo(Math.cos(halfW) * len, Math.sin(halfW) * len);
    a.closePath();
    a.fillStyle = rayGold(a.createLinearGradient(0, 0, len, 0));
    a.fill();
    a.strokeStyle = 'rgba(40,22,4,0.75)';
    a.lineWidth = S * 0.004;
    a.stroke();
    a.restore();
  }
  a.restore();

  // ---- the two solar faces, above and below ------------------------------
  const face = (yy, flip) => {
    a.save();
    a.translate(cx, yy);
    a.scale(1, flip);
    const g = a.createRadialGradient(0, -S * 0.02, S * 0.01, 0, 0, S * 0.145);
    g.addColorStop(0.0, '#FBE39A');
    g.addColorStop(0.55, '#E0A733');
    g.addColorStop(1.0, '#9B6A16');
    a.fillStyle = g;
    a.beginPath(); a.arc(0, 0, S * 0.145, 0, Math.PI * 2); a.fill();
    a.strokeStyle = 'rgba(46,26,6,0.8)'; a.lineWidth = S * 0.005; a.stroke();

    // closed eyes and a calm mouth, drawn as line work
    a.strokeStyle = 'rgba(52,28,6,0.85)';
    a.lineWidth = S * 0.0075;
    a.lineCap = 'round';
    for (const ex of [-S * 0.055, S * 0.055]) {
      a.beginPath();
      a.arc(ex, -S * 0.020, S * 0.030, Math.PI * 0.15, Math.PI * 0.85);
      a.stroke();
    }
    a.beginPath();
    a.arc(0, S * 0.030, S * 0.045, Math.PI * 0.20, Math.PI * 0.80);
    a.stroke();
    a.restore();
  };
  face(cy - S * 0.245, 1);
  face(cy + S * 0.245, -1);

  // ---- the ring, an ellipse passing behind and in front of the eye -------
  const ringR = S * 0.300, ringRy = S * 0.088;
  const drawRing = (backHalf) => {
    a.save();
    a.translate(cx, cy);
    a.strokeStyle = backHalf ? 'rgba(150,92,20,0.9)' : '#E8B54A';
    a.lineWidth = S * 0.026;
    a.beginPath();
    a.ellipse(0, 0, ringR, ringRy, 0, backHalf ? Math.PI : 0, backHalf ? Math.PI * 2 : Math.PI);
    a.stroke();
    a.strokeStyle = 'rgba(40,22,4,0.8)';
    a.lineWidth = S * 0.005;
    a.beginPath();
    a.ellipse(0, 0, ringR, ringRy, 0, backHalf ? Math.PI : 0, backHalf ? Math.PI * 2 : Math.PI);
    a.stroke();
    a.restore();
  };
  drawRing(true);

  // ---- the eye -----------------------------------------------------------
  a.save();
  a.translate(cx, cy);
  const EW = S * 0.165, EH = S * 0.108;
  a.beginPath();
  a.moveTo(-EW, 0);
  a.quadraticCurveTo(0, -EH * 1.65, EW, 0);
  a.quadraticCurveTo(0, EH * 1.65, -EW, 0);
  a.closePath();
  a.fillStyle = '#F3EAD6';
  a.fill();
  a.save(); a.clip();

  // iris: rainbow holo
  const iris = a.createRadialGradient(0, 0, EH * 0.06, 0, 0, EH * 0.92);
  iris.addColorStop(0.00, '#0B0F12');
  iris.addColorStop(0.22, '#1D6E63');
  iris.addColorStop(0.45, '#2FA86F');
  iris.addColorStop(0.66, '#C8A63A');
  iris.addColorStop(0.84, '#C4557E');
  iris.addColorStop(1.00, '#3B4E8C');
  a.fillStyle = iris;
  a.beginPath(); a.arc(0, 0, EH * 0.92, 0, Math.PI * 2); a.fill();

  a.strokeStyle = 'rgba(10,14,18,0.35)';
  a.lineWidth = S * 0.0022;
  for (let i = 0; i < 44; i++) {
    const ang = (i / 44) * Math.PI * 2;
    a.beginPath();
    a.moveTo(Math.cos(ang) * EH * 0.24, Math.sin(ang) * EH * 0.24);
    a.lineTo(Math.cos(ang) * EH * 0.90, Math.sin(ang) * EH * 0.90);
    a.stroke();
  }
  a.fillStyle = '#07090B';
  a.beginPath(); a.arc(0, 0, EH * 0.32, 0, Math.PI * 2); a.fill();
  a.fillStyle = 'rgba(255,255,255,0.75)';
  a.beginPath(); a.arc(-EH * 0.26, -EH * 0.30, EH * 0.13, 0, Math.PI * 2); a.fill();
  a.restore();

  a.lineJoin = 'round';
  a.strokeStyle = 'rgba(30,18,6,0.9)';
  a.lineWidth = S * 0.008;
  a.beginPath();
  a.moveTo(-EW, 0);
  a.quadraticCurveTo(0, -EH * 1.65, EW, 0);
  a.quadraticCurveTo(0, EH * 1.65, -EW, 0);
  a.closePath();
  a.stroke();
  a.restore();

  drawRing(false);

  // ---- RESIN down the left, CULTURE down the right -----------------------
  const sideWord = (text, x, color, deep, dir, fs) => {
    a.save();
    a.translate(x, cy);
    a.rotate(dir * Math.PI / 2);
    a.font = `${fs}px ${FONT_HEAVY}`;
    a.textAlign = 'center'; a.textBaseline = 'middle';
    const chars = text.split('');
    const w = chars.map((c) => a.measureText(c).width * 1.06);
    const total = w.reduce((p, q) => p + q, 0);
    let p = -total / 2;
    for (let i = 0; i < chars.length; i++) {
      a.save();
      a.translate(p + w[i] / 2, 0);
      a.scale(1, 1.16);
      a.font = `${fs}px ${FONT_HEAVY}`;
      a.textAlign = 'center'; a.textBaseline = 'middle';
      a.lineJoin = 'round';
      a.lineWidth = S * 0.022; a.strokeStyle = 'rgba(8,10,8,0.85)';
      a.strokeText(chars[i], 0, 0);
      const g = a.createLinearGradient(0, -fs * 0.55, 0, fs * 0.55);
      g.addColorStop(0.0, color);
      g.addColorStop(0.55, deep);
      g.addColorStop(1.0, color);
      a.fillStyle = g;
      a.fillText(chars[i], 0, 0);
      a.restore();
      p += w[i];
    }
    a.restore();
  };
  // The emblem is mapped to a CircleGeometry, so the usable half-length at a
  // given offset is the CHORD, sqrt(0.5^2 - offset^2), not the full square.
  // CULTURE is seven glyphs and was overrunning it at 0.375.
  sideWord('RESIN', cx - S * 0.352, '#FF9256', PR.emberDeep, -1, S * 0.104);
  sideWord('CULTURE', cx + S * 0.352, '#6FE6CE', PR.tealDeep, 1, S * 0.092);

  a.save();
  a.translate(cx + S * 0.428, cy);
  a.rotate(Math.PI / 2);
  a.font = `700 ${S * 0.034}px ${FONT_COND}`;
  a.textAlign = 'center'; a.textBaseline = 'middle';
  a.fillStyle = 'rgba(190,235,205,0.75)';
  const hc2 = 'HASH CLUB'.split('');
  let hp = 0;
  const hw = hc2.map((c) => a.measureText(c).width + S * 0.012);
  const htot = hw.reduce((p, q) => p + q, 0);
  hp = -htot / 2;
  for (let i = 0; i < hc2.length; i++) { a.fillText(hc2[i], hp + hw[i] / 2, 0); hp += hw[i]; }
  a.restore();

  tooth(a, S, S, rnd, 8);

  // ---- maps ---------------------------------------------------------------
  const rw = S >> 1;
  const rough = makeCanvas(rw, rw);
  const r = rough.getContext('2d');
  r.fillStyle = 'rgb(58,58,58)'; r.fillRect(0, 0, rw, rw);
  const bandRnd = mulberry32(0xAB33);
  for (let i = 0; i < 40; i++) {
    const x = bandRnd() * rw, w = rw * (0.006 + bandRnd() * 0.026);
    const v = 28 + Math.floor(bandRnd() * 66);
    const g = r.createLinearGradient(x, 0, x + w, rw);
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(${v},${v},${v},0.85)`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    r.fillStyle = g; r.fillRect(x, 0, w, rw);
  }
  tooth(r, rw, rw, mulberry32(0x6E6E), 20);

  const metal = makeCanvas(rw, rw);
  const m = metal.getContext('2d');
  m.fillStyle = 'rgb(224,224,224)'; m.fillRect(0, 0, rw, rw);

  const height = makeCanvas(rw, rw);
  const hcx = height.getContext('2d');
  hcx.fillStyle = 'rgb(116,116,116)'; hcx.fillRect(0, 0, rw, rw);
  tooth(hcx, rw, rw, mulberry32(0x7F7F), 30);

  return {
    albedo, roughness: rough, height, metalness: metal,
    normal: heightToNormal(height, 1.3),
    material: { envMapIntensity: 1.25, clearcoat: 0.28, clearcoatRoughness: 0.16 },
  };
}

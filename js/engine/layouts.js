// KIVO Grid - layout engine.
// Every template turns (photo count n, photo aspect ratios) into a list of cells
// in a 1000 x 1000 "world" square. Cell i always shows photo slot i.
// Pure functions, no DOM: unit-tested in test/layouts.test.js.

export const WORLD = 1000;
const PAD = 34;
const GAP = 14;
const INNER = WORLD - PAD * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ROWS = { 1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [3, 2, 2], 8: [3, 3, 2], 9: [3, 3, 3] };
const AUTO = { 2: [1, 1], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [2, 2, 3], 8: [3, 3, 2], 9: [3, 3, 3] };
const STACK = { 2: [1, 1], 3: [2, 1], 4: [2, 1, 1], 5: [2, 2, 1], 6: [2, 3, 1], 7: [3, 1, 3], 8: [2, 3, 1, 2], 9: [2, 3, 1, 3] };
const HERO_REST = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [4, 3], 8: [4, 4] };
const TWO_ROW = { 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [4, 3], 8: [4, 4], 9: [5, 4] };

function gridRects(plan, x, y, w, h, gap, weights) {
  const ws = weights || plan.map(() => 1);
  const total = ws.reduce((a, b) => a + b, 0);
  const availH = h - gap * (plan.length - 1);
  const out = [];
  let cy = y;
  plan.forEach((cnt, ri) => {
    const rh = (availH * ws[ri]) / total;
    const cw = (w - gap * (cnt - 1)) / cnt;
    for (let k = 0; k < cnt; k++) out.push({ x: x + k * (cw + gap), y: cy, w: cw, h: rh });
    cy += rh + gap;
  });
  return out;
}

function mk(r, extra) {
  return Object.assign({ x: r.x, y: r.y, w: r.w, h: r.h, rot: 0, shape: 'rrect', r: 22 }, extra || {});
}

function shrink(r, f) {
  const dw = r.w * (1 - f), dh = r.h * (1 - f);
  return { x: r.x + dw / 2, y: r.y + dh / 2, w: r.w * f, h: r.h * f };
}

function masonryRegion(ars, cols, x, y, w, h, gap) {
  const colW = (w - gap * (cols - 1)) / cols;
  const items = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  ars.forEach((ar, i) => {
    let c = 0;
    for (let k = 1; k < cols; k++) if (heights[k] < heights[c] - 1e-9) c = k;
    items[c].push(i);
    heights[c] += 1 / ar;
  });
  const out = new Array(ars.length);
  items.forEach((list, c) => {
    if (!list.length) return;
    const nat = list.map((i) => colW / ars[i]);
    const k = (h - gap * (list.length - 1)) / nat.reduce((a, b) => a + b, 0);
    let cy = y;
    list.forEach((i, j) => {
      const ch = nat[j] * k;
      out[i] = { x: x + c * (colW + gap), y: cy, w: colW, h: ch };
      cy += ch + gap;
    });
  });
  return out;
}

function distribute(n, cols) {
  const base = Math.floor(n / cols), extra = n % cols;
  return Array.from({ length: cols }, (_, i) => base + (i < extra ? 1 : 0));
}

const RING = '#2AA4FF';

const T = {
  classic: (n) => ({
    cells: gridRects(ROWS[n], PAD, PAD, INNER, INNER, GAP).map((r) => mk(r)),
  }),

  auto: (n, ars) => {
    const plan = AUTO[n];
    const availH = INNER - GAP * (plan.length - 1);
    let i = 0;
    const rows = plan.map((cnt) => {
      const a = ars.slice(i, i + cnt);
      i += cnt;
      const sum = a.reduce((s, v) => s + v, 0);
      return { a, cnt, sum, nat: (INNER - GAP * (cnt - 1)) / sum };
    });
    const totNat = rows.reduce((s, r) => s + r.nat, 0);
    const cells = [];
    let y = PAD;
    rows.forEach((r) => {
      const rh = (availH * r.nat) / totNat;
      const avail = INNER - GAP * (r.cnt - 1);
      let x = PAD;
      r.a.forEach((ar) => {
        const cw = (avail * ar) / r.sum;
        cells.push(mk({ x, y, w: cw, h: rh }));
        x += cw + GAP;
      });
      y += rh + GAP;
    });
    return { cells };
  },

  hero: (n) => {
    const hH = n === 2 ? (INNER - GAP) / 2 : n <= 4 ? 540 : n <= 6 ? 470 : 400;
    const cells = [mk({ x: PAD, y: PAD, w: INNER, h: hH }, { r: 26 })];
    const y0 = PAD + hH + GAP;
    gridRects(HERO_REST[n - 1], PAD, y0, INNER, WORLD - PAD - y0, GAP).forEach((r) => cells.push(mk(r, { r: 18 })));
    return { cells };
  },

  stacked: (n) => {
    const plan = STACK[n];
    return { cells: gridRects(plan, PAD, PAD, INNER, INNER, GAP, plan.map((c) => (c === 1 ? 0.75 : 1))).map((r) => mk(r)) };
  },

  polaroid: (n) => {
    const rand = rng(1000 + n);
    const rects = gridRects(ROWS[n], PAD + 10, PAD + 10, INNER - 20, INNER - 20, 6);
    return {
      cells: rects.map((r) => mk(shrink(r, 0.94), { rot: (rand() - 0.5) * 0.14, frame: 'polaroid', r: 6 })),
    };
  },

  masonry: (n, ars) => ({
    cells: masonryRegion(ars, n <= 4 ? 2 : 3, PAD, PAD, INNER, INNER, GAP).map((r) => mk(r, { r: 20 })),
  }),

  magazine: (n, ars) => {
    const heroW = INNER * 0.42;
    const cells = [mk({ x: PAD, y: PAD, w: heroW, h: INNER }, { r: 26 })];
    const rest = ars.slice(1);
    const rx = PAD + heroW + GAP;
    masonryRegion(rest, rest.length >= 4 ? 2 : 1, rx, PAD, INNER - heroW - GAP, INNER, GAP).forEach((r) => cells.push(mk(r, { r: 18 })));
    return { cells };
  },

  bubbles: (n) => {
    const weights = [1, 0.82, 0.92, 0.72, 0.86, 0.76, 0.96, 0.7, 0.8];
    const rad = weights.slice(0, n).map((w) => w * 100);
    const pos = rad.map((_, i) => {
      const a = i * 2.399963;
      const d = 40 * Math.sqrt(i + 0.5) * 2.2;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d };
    });
    const gap = 10;
    for (let it = 0; it < 400; it++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
          let d = Math.hypot(dx, dy);
          if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
          const min = rad[i] + rad[j] + gap;
          if (d < min) {
            const push = (min - d) / 2;
            pos[i].x -= (dx / d) * push; pos[i].y -= (dy / d) * push;
            pos[j].x += (dx / d) * push; pos[j].y += (dy / d) * push;
          }
        }
      }
      for (let i = 0; i < n; i++) { pos[i].x *= 0.985; pos[i].y *= 0.985; }
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pos.forEach((p, i) => {
      x0 = Math.min(x0, p.x - rad[i]); x1 = Math.max(x1, p.x + rad[i]);
      y0 = Math.min(y0, p.y - rad[i]); y1 = Math.max(y1, p.y + rad[i]);
    });
    const s = Math.min(INNER / (x1 - x0), INNER / (y1 - y0));
    const ox = WORLD / 2 - ((x0 + x1) / 2) * s, oy = WORLD / 2 - ((y0 + y1) / 2) * s;
    return {
      dark: true,
      cells: pos.map((p, i) => {
        const r = rad[i] * s;
        return mk({ x: ox + p.x * s - r, y: oy + p.y * s - r, w: r * 2, h: r * 2 }, { shape: 'ellipse', ring: RING, ringW: 6 });
      }),
    };
  },

  tilt: (n) => {
    const F = { x: 70, y: 70, w: 860, h: 860 };
    const cells = gridRects(ROWS[n], F.x + 22, F.y + 22, F.w - 44, F.h - 44, 12).map((r) => mk(r, { r: 10 }));
    return {
      dark: true,
      cells,
      group: { rot: -0.07, cx: WORLD / 2, cy: WORLD / 2 },
      decor: [{ kind: 'frame', x: F.x, y: F.y, w: F.w, h: F.h, r: 28, fill: '#FFFFFF' }],
    };
  },

  film: (n) => {
    const cols = n <= 3 ? n : n === 4 ? 2 : 3;
    const counts = distribute(n, cols);
    const sGap = 16;
    const sw = (INNER - sGap * (cols - 1)) / cols;
    const lane = Math.min(44, sw * 0.13);
    const cells = [];
    const decor = [];
    counts.forEach((m, c) => {
      const sx = PAD + c * (sw + sGap);
      decor.push({ kind: 'strip', x: sx, y: PAD, w: sw, h: INNER, r: 16, lane });
      const fh = (INNER - 36 - 12 * (m - 1)) / m;
      for (let j = 0; j < m; j++) cells.push(mk({ x: sx + lane, y: PAD + 18 + j * (fh + 12), w: sw - lane * 2, h: fh }, { r: 6 }));
    });
    return { dark: true, cells, decor };
  },

  orbit: (n) => {
    const cx = WORLD / 2, cy = WORLD / 2;
    const cr = n === 2 ? 215 : 195;
    const cells = [mk({ x: cx - cr, y: cy - cr, w: cr * 2, h: cr * 2 }, { shape: 'ellipse', ring: RING, ringW: 8, glow: RING })];
    const m = n - 1;
    const orbitR = 345;
    let r = Math.min(126, Math.sin(Math.PI / Math.max(m, 2)) * orbitR * 0.9);
    if (m === 1) r = 120;
    for (let k = 0; k < m; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / m + (m === 1 ? Math.PI / 4 : 0);
      cells.push(mk({ x: cx + Math.cos(a) * orbitR - r, y: cy + Math.sin(a) * orbitR - r, w: r * 2, h: r * 2 }, { shape: 'ellipse', ring: '#FFFFFF', ringW: 4 }));
    }
    return { dark: true, cells, decor: [{ kind: 'orbit', cx, cy, r: orbitR }] };
  },

  scrap: (n) => {
    const rand = rng(2000 + n);
    const rects = gridRects(ROWS[n], PAD + 14, PAD + 14, INNER - 28, INNER - 28, 20);
    return {
      cells: rects.map((r) => mk(shrink(r, 0.95), { rot: (rand() - 0.5) * 0.18, frame: 'scrap', r: 4, tape: rand() < 0.5 ? -1 : 1 })),
    };
  },

  diagonal: (n) => {
    const plan = TWO_ROW[n];
    const rows = gridRects(plan.map(() => 1), PAD, PAD, INNER, INNER, GAP);
    const dx = 70;
    const cells = [];
    plan.forEach((cnt, ri) => {
      const row = rows[ri];
      const edge = (k) => ({
        top: k === 0 || k === cnt ? row.x + (k * row.w) / cnt : row.x + (k * row.w) / cnt + dx / 2,
        bot: k === 0 || k === cnt ? row.x + (k * row.w) / cnt : row.x + (k * row.w) / cnt - dx / 2,
      });
      for (let j = 0; j < cnt; j++) {
        const a = edge(j), b = edge(j + 1);
        const gl = j > 0 ? GAP / 2 : 0, gr = j < cnt - 1 ? GAP / 2 : 0;
        const pts = [[a.top + gl, row.y], [b.top - gr, row.y], [b.bot - gr, row.y + row.h], [a.bot + gl, row.y + row.h]];
        const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
        cells.push(mk({ x: minX, y: row.y, w: maxX - minX, h: row.h }, { shape: 'poly', pts: pts.map((p) => [p[0] - minX, p[1] - row.y]) }));
      }
    });
    return { cells };
  },

  hexagon: (n) => {
    const axial = [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1], [2, -1], [-2, 1]].slice(0, n);
    const S3 = Math.sqrt(3);
    const centers = axial.map(([q, r]) => ({ x: S3 * (q + r / 2), y: 1.5 * r }));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    centers.forEach((c) => {
      x0 = Math.min(x0, c.x - S3 / 2); x1 = Math.max(x1, c.x + S3 / 2);
      y0 = Math.min(y0, c.y - 1); y1 = Math.max(y1, c.y + 1);
    });
    const s = Math.min(INNER / (x1 - x0), INNER / (y1 - y0));
    const ox = WORLD / 2 - ((x0 + x1) / 2) * s, oy = WORLD / 2 - ((y0 + y1) / 2) * s;
    const size = s * 0.96;
    const cells = centers.map((c) => {
      const px = ox + c.x * s, py = oy + c.y * s;
      const w = S3 * size, h = 2 * size;
      const pts = [0, 1, 2, 3, 4, 5].map((k) => {
        const a = (Math.PI / 180) * (60 * k - 30);
        return [w / 2 + size * Math.cos(a), h / 2 + size * Math.sin(a)];
      });
      return mk({ x: px - w / 2, y: py - h / 2, w, h }, { shape: 'poly', pts, ring: 'rgba(255,255,255,0.9)', ringW: 3 });
    });
    return { dark: true, cells };
  },

  neon: (n) => ({
    dark: true,
    cells: gridRects(ROWS[n], PAD + 6, PAD + 6, INNER - 12, INNER - 12, 24).map((r, i) =>
      mk(r, { r: 16, ring: i % 2 === 0 ? '#29B6FF' : '#FF3DDC', ringW: 6, glow: i % 2 === 0 ? '#29B6FF' : '#FF3DDC' })
    ),
  }),

  // ---- Premium templates ----
  gold: (n) => {
    const P = 78, G = 20, SZ = WORLD - P * 2;
    const plan = ROWS[n];
    const weights = plan.length > 1 ? plan.map((_, i) => (i === 0 ? 1.3 : 1)) : [1];
    return {
      dark: true,
      backdrop: { kind: 'gold' },
      cells: gridRects(plan, P, P, SZ, SZ, G, weights).map((r) => mk(r, { r: 4, ring: '#D9B25F', ringW: 3 })),
    };
  },

  pearl: (n) => {
    const PLAN = { 2: [1, 1], 3: [1, 2], 4: [1, 3], 5: [2, 3], 6: [2, 4], 7: [1, 3, 3], 8: [2, 3, 3], 9: [1, 4, 4] };
    const plan = PLAN[n];
    const weights = plan.map((_, i) => (i === 0 ? 1.35 : 1));
    const P = 64;
    return {
      backdrop: { kind: 'pearl' },
      cells: gridRects(plan, P, P, WORLD - P * 2, WORLD - P * 2, 30, weights).map((r) => mk(shrink(r, 0.97), { frame: 'scrap', r: 4, tape: 0 })),
    };
  },

  aurora: (n) => {
    const cols = n <= 4 ? 2 : 3;
    const counts = distribute(n, cols);
    const P = 64, G = 26, STAG = 56;
    const colW = (WORLD - P * 2 - G * (cols - 1)) / cols;
    const H = WORLD - P * 2 - STAG;
    const cells = [];
    counts.forEach((m, c) => {
      const y0 = P + (c % 2 ? STAG : 0);
      const h = (H - G * (m - 1)) / m;
      for (let j = 0; j < m; j++) {
        const i = cells.length;
        cells.push(mk({ x: P + c * (colW + G), y: y0 + j * (h + G), w: colW, h }, {
          r: 46, ring: 'rgba(255,255,255,0.7)', ringW: 3, glow: i % 2 ? 'rgba(61,224,230,0.55)' : 'rgba(155,107,255,0.6)',
        }));
      }
    });
    return { dark: true, backdrop: { kind: 'aurora' }, cells };
  },

  capsules: (n) => {
    const plan = TWO_ROW[n];
    const weights = plan.length === 2 ? [1.15, 0.85] : [1];
    return { cells: gridRects(plan, PAD, PAD, INNER, INNER, GAP, weights).map((r) => mk(r, { r: 9999 })) };
  },
};

export const TEMPLATES = [
  { id: 'classic', name: 'Classic 3×3', build: T.classic },
  { id: 'auto', name: 'Auto Grid', build: T.auto },
  { id: 'hero', name: 'Hero Spotlight', build: T.hero },
  { id: 'stacked', name: 'Stacked Rows', build: T.stacked },
  { id: 'polaroid', name: 'Polaroid Pile', build: T.polaroid },
  { id: 'masonry', name: 'Masonry', build: T.masonry },
  { id: 'magazine', name: 'Magazine', build: T.magazine },
  { id: 'bubbles', name: 'Bubbles', build: T.bubbles },
  { id: 'tilt', name: 'Tilt Frame', build: T.tilt },
  { id: 'film', name: 'Film Strip', build: T.film },
  { id: 'orbit', name: 'Orbit', build: T.orbit },
  { id: 'scrap', name: 'Scrapbook', build: T.scrap },
  { id: 'diagonal', name: 'Diagonal', build: T.diagonal },
  { id: 'hexagon', name: 'Hexagon', build: T.hexagon },
  { id: 'neon', name: 'Neon Grid', build: T.neon },
  { id: 'capsules', name: 'Capsules', build: T.capsules },
  { id: 'gold', name: 'Gold Gallery', build: T.gold, premium: true },
  { id: 'pearl', name: 'Pearl Wall', build: T.pearl, premium: true },
  { id: 'aurora', name: 'Aurora Cascade', build: T.aurora, premium: true },
];

const cache = new Map();

/** Build (and memoize) the layout for template `idx` with `n` photos. */
export function buildLayout(idx, n, ars) {
  n = Math.max(2, Math.min(9, n | 0));
  const a = [];
  for (let i = 0; i < n; i++) {
    const v = ars && Number.isFinite(ars[i]) && ars[i] > 0 ? ars[i] : 1;
    a.push(Math.max(0.5, Math.min(2, v)));
  }
  const key = idx + '|' + n + '|' + a.map((v) => v.toFixed(2)).join(',');
  let hit = cache.get(key);
  if (!hit) {
    hit = TEMPLATES[idx].build(n, a);
    hit.dark = !!hit.dark;
    if (cache.size > 200) cache.clear();
    cache.set(key, hit);
  }
  return hit;
}

/** Point (world coords) -> index of the topmost cell under it, or -1. */
export function hitTest(layout, px, py) {
  let x = px, y = py;
  if (layout.group) {
    const g = layout.group;
    const c = Math.cos(-g.rot), s = Math.sin(-g.rot);
    const dx = x - g.cx, dy = y - g.cy;
    x = g.cx + dx * c - dy * s;
    y = g.cy + dx * s + dy * c;
  }
  for (let i = layout.cells.length - 1; i >= 0; i--) {
    const c = layout.cells[i];
    const dx = x - (c.x + c.w / 2), dy = y - (c.y + c.h / 2);
    const cs = Math.cos(-c.rot), sn = Math.sin(-c.rot);
    const lx = dx * cs - dy * sn + c.w / 2, ly = dx * sn + dy * cs + c.h / 2;
    if (lx < 0 || ly < 0 || lx > c.w || ly > c.h) continue;
    if (c.shape === 'ellipse') {
      const ex = (lx - c.w / 2) / (c.w / 2), ey = (ly - c.h / 2) / (c.h / 2);
      if (ex * ex + ey * ey > 1) continue;
    } else if (c.shape === 'poly') {
      if (!pointInPoly(lx, ly, c.pts)) continue;
    }
    return i;
  }
  return -1;
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

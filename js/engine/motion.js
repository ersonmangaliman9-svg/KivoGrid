// KIVO Grid - 10 motion styles. getAnim() returns the per-cell transform for time `lt`
// (seconds into the loop). All pure; unit-tested.

export const LOOP = 4.4; // seconds per loop (matches "Loops every 4.4s")
export const SLOT = 1.8; // seconds per template in Showcase

export const MOTIONS = [
  { id: 'pop', name: 'Pop In' },
  { id: 'fly', name: 'Fly In' },
  { id: 'deal', name: 'Card Deal' },
  { id: 'wave', name: 'Wave' },
  { id: 'beat', name: 'Beat Pulse' },
  { id: 'ken', name: 'Ken Burns' },
  { id: 'glitch', name: 'Glitch' },
  { id: 'flip', name: 'Flip' },
  { id: 'spin', name: 'Spin' },
  { id: 'showcase', name: 'Showcase' },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

export function identity() {
  return { dx: 0, dy: 0, s: 1, sx: 1, rot: 0, alpha: 1, zoom: 1, panX: 0, panY: 0, glitch: 0, back: false };
}

/**
 * @param id motion id, i the cell index, lt loop time (s), cx/cy the cell centre in world coords,
 * @param fadeOut seconds of fade at the end of the loop
 */
export function getAnim(id, i, lt, cx, cy, fadeOut = 0.4, loopLen = LOOP) {
  const a = identity();
  const out = 1 - smooth(loopLen - fadeOut, loopLen, lt);
  const type = id === 'showcase' ? 'pop' : id;
  switch (type) {
    case 'pop': {
      const p = clamp01((lt - i * 0.12) / 0.55);
      a.s = Math.max(0, easeOutBack(p));
      a.alpha = clamp01(p * 3);
      break;
    }
    case 'fly': {
      const p = clamp01((lt - i * 0.12) / 0.7);
      const e = 1 - easeOutCubic(p);
      const dir = [[-1, 0], [1, 0], [0, -1], [0, 1]][i % 4];
      a.dx = dir[0] * 1100 * e; a.dy = dir[1] * 1100 * e;
      a.alpha = p > 0 ? 1 : 0;
      break;
    }
    case 'deal': {
      const p = clamp01((lt - i * 0.2) / 0.75);
      const e = easeOutCubic(p);
      a.dx = (500 - cx) * (1 - e); a.dy = (1150 - cy) * (1 - e);
      a.rot = (i % 2 ? 0.6 : -0.6) * (1 - e);
      a.s = 0.55 + 0.45 * e;
      a.alpha = p > 0 ? 1 : 0;
      break;
    }
    case 'wave': {
      const p = clamp01((lt - i * 0.06) / 0.4);
      a.s = Math.max(0, easeOutBack(p));
      a.alpha = clamp01(p * 3);
      a.dy = Math.sin((lt / 1.8) * Math.PI * 2 - i * 0.7) * 16 * p;
      break;
    }
    case 'beat': {
      const p = clamp01((lt - i * 0.06) / 0.4);
      const phase = (lt % 0.55) / 0.55;
      a.s = Math.max(0, easeOutBack(p)) * (1 + 0.07 * Math.exp(-phase * 7));
      a.alpha = clamp01(p * 3);
      break;
    }
    case 'ken': {
      const p = clamp01((lt - i * 0.15) / 0.9);
      a.alpha = easeOutCubic(p);
      a.zoom = 1 + 0.18 * clamp01(lt / loopLen);
      const d = i % 2 ? 1 : -1;
      a.panX = d * (lt / loopLen - 0.5) * 0.9;
      a.panY = -d * (lt / loopLen - 0.5) * 0.5;
      break;
    }
    case 'glitch': {
      const p = clamp01((lt - i * 0.1) / 0.35);
      a.s = Math.max(0, easeOutBack(p));
      a.alpha = clamp01(p * 3);
      const slot = Math.floor(lt * 14);
      if (p >= 1 && hash(slot * 3 + i * 7) < 0.2) {
        a.glitch = 0.4 + hash(slot + i) * 0.6;
        a.dx = (hash(slot * 5 + i) - 0.5) * 28;
      }
      break;
    }
    case 'flip': {
      const p = clamp01((lt - i * 0.12) / 0.8);
      const theta = Math.PI * (1 - easeOutCubic(p));
      a.sx = Math.cos(theta);
      a.back = theta > Math.PI / 2;
      a.alpha = p > 0 ? 1 : 0;
      break;
    }
    case 'spin': {
      const p = clamp01((lt - i * 0.1) / 0.8);
      const e = easeOutCubic(p);
      a.rot = (1 - e) * Math.PI * 2;
      a.s = e;
      a.alpha = clamp01(p * 4);
      break;
    }
    default:
      break;
  }
  a.alpha *= out;
  return a;
}

/** Which template and local time Showcase is showing at time t. */
export function showcaseAt(t, count = 16) {
  t = Math.max(0, t);
  const slot = Math.floor(t / SLOT) % count;
  return { index: slot, lt: t - Math.floor(t / SLOT) * SLOT };
}

/** Resolve which template + local loop time to show at absolute time t (seconds). */
export function resolveTime(motionId, tplIdx, t, tplCount = 16) {
  if (motionId === 'showcase') {
    const s = showcaseAt(t, tplCount);
    return { tpl: s.index, lt: s.lt, loopLen: SLOT, fadeOut: 0.22 };
  }
  return { tpl: tplIdx, lt: Math.max(0, t) % LOOP, loopLen: LOOP, fadeOut: 0.4 };
}

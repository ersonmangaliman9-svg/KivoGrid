// KIVO Grid - 14 photo filters.
// Filters are applied to pixel data in JS (not ctx.filter) so they behave the
// same on every browser, including iPhone Safari, and in PNG / reel exports.

export const FILTERS = [
  { id: 'original', name: 'Original', dot: '#1B2447', p: {} },
  { id: 'warm', name: 'Warm', dot: '#F4A340', p: { temp: 14, sat: 1.1, br: 4 } },
  { id: 'teal', name: 'Teal & Orange', dot: '#2BB5A8', p: { split: { sh: [-12, 8, 16], hi: [20, 6, -16] }, ct: 1.1, sat: 1.15 } },
  { id: 'vivid', name: 'Vivid', dot: '#B25CFF', p: { sat: 1.5, ct: 1.12 } },
  { id: 'bw', name: 'B&W', dot: '#8A8F9C', p: { gray: true, ct: 1.1 } },
  { id: 'noir', name: 'Noir', dot: '#0A0F24', p: { gray: true, ct: 1.45, br: -14, vig: 0.55 } },
  { id: 'fade', name: 'Fade', dot: '#D9C9B8', p: { lift: 30, ct: 0.9, sat: 0.8 } },
  { id: 'vintage', name: 'Vintage', dot: '#C49A5C', p: { sepia: 0.35, lift: 18, tint: [255, 190, 110, 0.08], vig: 0.35, sat: 0.85, grain: 0.04 } },
  { id: 'cool', name: 'Cool', dot: '#4A86F7', p: { temp: -14, sat: 1.05 } },
  { id: 'golden', name: 'Golden Hour', dot: '#FFB347', p: { tint: [255, 168, 60, 0.18], br: 8, ct: 1.05, sat: 1.2 } },
  { id: 'pastel', name: 'Pastel', dot: '#E6DAFF', p: { br: 14, ct: 0.85, sat: 0.75, lift: 26, tint: [215, 195, 255, 0.1] } },
  { id: 'cyber', name: 'Cyberpunk', dot: '#C94BE8', p: { split: { sh: [30, -14, 40], hi: [-24, 26, 34] }, ct: 1.2, sat: 1.35 } },
  { id: 'grain', name: 'Film Grain', dot: '#8C7B66', p: { grain: 0.09, ct: 1.08, sat: 0.9, lift: 10 } },
  { id: 'matte', name: 'Matte', dot: '#A7A29A', p: { lift: 24, cap: 238, ct: 0.95, sat: 0.95 } },
];

let noise = null;
function getNoise() {
  if (noise) return noise;
  noise = new Float32Array(65536);
  let s = 12345;
  for (let i = 0; i < noise.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    noise[i] = s / 4294967296 - 0.5;
  }
  return noise;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Apply filter params to RGBA pixel data in place. */
export function applyFilterData(data, w, h, p) {
  if (!p || Object.keys(p).length === 0) return data;
  const { temp = 0, br = 0, ct = 1, sat = 1, gray = false, sepia = 0, lift = 0, cap = 255, tint = null, split = null, vig = 0, grain = 0 } = p;
  const nz = grain ? getNoise() : null;
  const lo = lift, range = (cap - lift) / 255;
  const cx = w / 2, cy = h / 2, maxD = cx * cx + cy * cy;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      let r = data[i] + temp, g = data[i + 1], b = data[i + 2] - temp;
      if (lift || cap < 255) { r = lo + r * range; g = lo + g * range; b = lo + b * range; }
      const l0 = 0.299 * r + 0.587 * g + 0.114 * b;
      if (gray) { r = g = b = l0; }
      else if (sat !== 1) { r = l0 + (r - l0) * sat; g = l0 + (g - l0) * sat; b = l0 + (b - l0) * sat; }
      if (ct !== 1) { r = (r - 128) * ct + 128; g = (g - 128) * ct + 128; b = (b - 128) * ct + 128; }
      if (br) { r += br; g += br; b += br; }
      if (split) {
        const l = clamp(0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (l < 0.5) { const k = 1 - l * 2; r += split.sh[0] * k; g += split.sh[1] * k; b += split.sh[2] * k; }
        else { const k = l * 2 - 1; r += split.hi[0] * k; g += split.hi[1] * k; b += split.hi[2] * k; }
      }
      if (sepia) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r = r * (1 - sepia) + sr * sepia; g = g * (1 - sepia) + sg * sepia; b = b * (1 - sepia) + sb * sepia;
      }
      if (tint) {
        const a = tint[3];
        r = r * (1 - a) + tint[0] * a; g = g * (1 - a) + tint[1] * a; b = b * (1 - a) + tint[2] * a;
      }
      if (vig) {
        const dx = x - cx, dy = y - cy;
        const f = 1 - vig * Math.pow((dx * dx + dy * dy) / maxD, 1.2);
        r *= f; g *= f; b *= f;
      }
      if (nz) {
        const n = nz[(x * 7 + y * 13 + ((x * y) & 255)) & 65535] * 255 * grain * 2;
        r += n; g += n; b += n;
      }
      data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b);
    }
  }
  return data;
}

// ---- DOM helpers (browser only) ----

const scaledCache = new Map();
const filteredCache = new Map();

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Photo canvas downscaled so its longest side is <= maxDim. */
export function getScaled(photo, maxDim) {
  const key = photo.id + '@' + maxDim;
  let c = scaledCache.get(key);
  if (c) return c;
  const k = Math.min(1, maxDim / Math.max(photo.w, photo.h));
  if (k >= 1) c = photo.canvas;
  else {
    c = newCanvas(Math.max(1, Math.round(photo.w * k)), Math.max(1, Math.round(photo.h * k)));
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(photo.canvas, 0, 0, c.width, c.height);
  }
  scaledCache.set(key, c);
  return c;
}

/** Cached filtered canvas, or null if not cached yet (when allowCompute is false). */
export function peekFiltered(photo, filterIdx, maxDim) {
  if (filterIdx === 0) return getScaled(photo, maxDim);
  return filteredCache.get(photo.id + '|' + filterIdx + '@' + maxDim) || null;
}

export function getFiltered(photo, filterIdx, maxDim) {
  if (filterIdx === 0) return getScaled(photo, maxDim);
  const key = photo.id + '|' + filterIdx + '@' + maxDim;
  let c = filteredCache.get(key);
  if (c) return c;
  const src = getScaled(photo, maxDim);
  c = newCanvas(src.width, src.height);
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height);
  applyFilterData(img.data, c.width, c.height, FILTERS[filterIdx].p);
  x.putImageData(img, 0, 0);
  filteredCache.set(key, c);
  return c;
}

export function dropPhotoCache(photoId) {
  for (const m of [scaledCache, filteredCache]) {
    for (const k of [...m.keys()]) if (k.startsWith(photoId + '@') || k.startsWith(photoId + '|')) m.delete(k);
  }
}

// KIVO Grid - photo loading. Decodes a File (respecting EXIF rotation) into a canvas
// of at most MAX_SIDE px so memory stays sane on phones.

import { dropPhotoCache } from './filters.js';

export const MAX_SIDE = 2400;
let counter = 0;

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* try next */ }
    try { return await createImageBitmap(file); } catch (e) { /* try next */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

export function makePhotoFromCanvas(canvas, name) {
  const id = 'p' + ++counter;
  const t = document.createElement('canvas');
  const k = 160 / Math.max(canvas.width, canvas.height);
  t.width = Math.max(1, Math.round(canvas.width * k));
  t.height = Math.max(1, Math.round(canvas.height * k));
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  return { id, name, canvas, w: canvas.width, h: canvas.height, thumb: t.toDataURL('image/jpeg', 0.82) };
}

export async function loadPhoto(file) {
  const src = await decode(file);
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
  if (!sw || !sh) throw new Error('Empty image');
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  return makePhotoFromCanvas(c, file.name || 'photo');
}

export function releasePhoto(photo) {
  dropPhotoCache(photo.id);
}

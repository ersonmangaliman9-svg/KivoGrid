// KIVO Grid - PNG (2160 x 2160) and animated reel (1080 x 1920 video) export.

import { drawBackground, drawScene, BLUE } from './render.js';
import { resolveTime, LOOP, SLOT } from './motion.js';

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), type, quality);
    else {
      try {
        const [head, b64] = canvas.toDataURL(type, quality).split(',');
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: head.match(/:(.*?);/)[1] }));
      } catch (e) { reject(e); }
    }
  });
}

export async function saveBlob(blob, filename) {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && navigator.canShare && typeof File === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function renderPNG(layout, images, size = 2160) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  drawBackground(ctx, layout.dark, 0, 0, size, size);
  ctx.scale(size / 1000, size / 1000);
  drawScene(ctx, layout, images, { static: true });
  return c;
}

export function reelDuration(motionId) {
  return motionId === 'showcase' ? SLOT * 16 : LOOP * 2;
}

/** Draw one reel frame (1080x1920) at time t. */
export function drawReelFrame(ctx, o) {
  const W = 1080, H = 1920;
  const R = resolveTime(o.motionId, o.tplIdx, o.t);
  const layout = o.getLayout(R.tpl);
  const dark = layout.dark;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(ctx, dark, 0, 0, W, H);
  const ink = dark ? '#FFFFFF' : '#0A1A4A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (o.logo) {
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, 130, 66, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(o.logo, W / 2 - 66, 64, 132, 132);
    ctx.restore();
  }
  ctx.fillStyle = ink;
  ctx.font = `900 84px ${FONT}`;
  ctx.fillText(o.titleFor(R.tpl).toUpperCase(), W / 2, 305);
  ctx.fillStyle = BLUE;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('KIVO GRID', W / 2, 365);
  ctx.save();
  ctx.translate(0, 420);
  ctx.scale(W / 1000, W / 1000);
  drawScene(ctx, layout, o.getImages(), { motion: o.motionId, lt: R.lt, loopLen: R.loopLen, fadeOut: R.fadeOut });
  ctx.restore();
  ctx.fillStyle = ink;
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText('EDIT. SNAP. POST.', W / 2, 1640);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.6)' : 'rgba(10,26,74,0.6)';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText('SOFTWARE BUSINESS SOLUTIONS', W / 2, 1700);
}

export function supportsReel() {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
}

/**
 * Record a reel in real time. `draw(ctx, t)` paints one frame at time t.
 * control.cancelled can be set to true to abort. Resolves {blob, ext}.
 */
export async function recordReel({ draw, duration, onProgress, control }) {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
  draw(ctx, 0);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8000000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.onstop = res; });
  rec.start(250);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => {
      const t = Math.min(duration, (now - t0) / 1000);
      draw(ctx, t);
      onProgress && onProgress(t / duration);
      if (control && control.cancelled) return resolve();
      if (t >= duration) return setTimeout(resolve, 150);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  if (rec.state !== 'inactive') rec.stop();
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());
  if (control && control.cancelled) return null;
  const type = rec.mimeType || mime || 'video/webm';
  return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' };
}

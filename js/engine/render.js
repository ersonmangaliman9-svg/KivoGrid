// KIVO Grid - canvas renderer. One code path draws the live preview, the PNG export
// and every frame of the reel, so what you see is exactly what you save.

import { getAnim, identity, LOOP } from './motion.js';
import { WORLD } from './layouts.js';

export const NAVY = '#0A1A4A';
export const BLUE = '#2AA4FF';

export function drawBackground(ctx, dark, x, y, w, h) {
  if (dark) {
    const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    g.addColorStop(0, '#0F2468');
    g.addColorStop(0.55, '#09163F');
    g.addColorStop(1, '#050C26');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#F3EFE7';
  }
  ctx.fillRect(x, y, w, h);
}

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function cellPath(ctx, c, box) {
  ctx.beginPath();
  if (c.shape === 'ellipse') ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
  else if (c.shape === 'poly') {
    c.pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
  } else rr(ctx, box.x, box.y, box.w, box.h, c.r);
}

function drawCover(ctx, img, dx, dy, dw, dh, zoom = 1, panX = 0, panY = 0) {
  const iw = img.width, ih = img.height;
  const srcAR = iw / ih, dstAR = dw / dh;
  let sw = srcAR > dstAR ? ih * dstAR : iw;
  let sh = srcAR > dstAR ? ih : iw / dstAR;
  sw /= zoom; sh /= zoom;
  const sx = (iw - sw) / 2 + (panX * (iw - sw)) / 2;
  const sy = (ih - sh) / 2 + (panY * (ih - sh)) / 2;
  ctx.drawImage(img, Math.max(0, Math.min(iw - sw, sx)), Math.max(0, Math.min(ih - sh, sy)), sw, sh, dx, dy, dw, dh);
}

function drawDecor(ctx, d, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (d.kind === 'frame') {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = d.fill;
    ctx.beginPath();
    rr(ctx, d.x, d.y, d.w, d.h, d.r);
    ctx.fill();
  } else if (d.kind === 'strip') {
    ctx.fillStyle = '#05070F';
    ctx.beginPath();
    rr(ctx, d.x, d.y, d.w, d.h, d.r);
    ctx.fill();
    const s = d.lane * 0.5, step = s * 2.1;
    ctx.fillStyle = '#E8ECF7';
    for (let y = d.y + step / 2; y < d.y + d.h - s; y += step) {
      for (const hx of [d.x + (d.lane - s) / 2, d.x + d.w - (d.lane + s) / 2]) {
        ctx.beginPath();
        rr(ctx, hx, y, s, s * 1.2, s * 0.25);
        ctx.fill();
      }
    }
  } else if (d.kind === 'orbit') {
    ctx.strokeStyle = 'rgba(42,164,255,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 14]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function goldGrad(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#F7E7A6');
  g.addColorStop(0.35, '#C9A24B');
  g.addColorStop(0.65, '#8E6B25');
  g.addColorStop(1, '#E9CC78');
  return g;
}

function glowBlob(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD, WORLD);
}

// Full-square premium backgrounds, painted behind everything at full opacity.
function drawBackdrop(ctx, b) {
  ctx.save();
  if (b.kind === 'gold') {
    const g = ctx.createLinearGradient(0, 0, WORLD * 0.4, WORLD);
    g.addColorStop(0, '#1B160B');
    g.addColorStop(0.5, '#0C0A05');
    g.addColorStop(1, '#16110A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD, WORLD);
    glowBlob(ctx, WORLD / 2, 0, 620, '217,178,95', 0.22);
    glowBlob(ctx, WORLD / 2, WORLD, 520, '217,178,95', 0.12);
    ctx.strokeStyle = goldGrad(ctx, 0, 0, WORLD, WORLD);
    ctx.lineWidth = 5;
    ctx.strokeRect(24, 24, WORLD - 48, WORLD - 48);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, 40, WORLD - 80, WORLD - 80);
    ctx.fillStyle = goldGrad(ctx, 0, 0, WORLD, WORLD);
    [[24, 24], [WORLD - 24, 24], [24, WORLD - 24], [WORLD - 24, WORLD - 24]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x, y - 15); ctx.lineTo(x + 15, y); ctx.lineTo(x, y + 15); ctx.lineTo(x - 15, y);
      ctx.closePath();
      ctx.fill();
    });
  } else if (b.kind === 'pearl') {
    const g = ctx.createLinearGradient(0, 0, WORLD, WORLD);
    g.addColorStop(0, '#FBF7EF');
    g.addColorStop(0.5, '#F0E7D6');
    g.addColorStop(1, '#E6D9C1');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD, WORLD);
    glowBlob(ctx, 220, 160, 520, '255,255,255', 0.85);
    glowBlob(ctx, 860, 880, 480, '201,162,75', 0.16);
    ctx.strokeStyle = 'rgba(160,125,50,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, WORLD - 48, WORLD - 48);
  } else if (b.kind === 'aurora') {
    const g = ctx.createLinearGradient(0, 0, WORLD * 0.5, WORLD);
    g.addColorStop(0, '#0A0F36');
    g.addColorStop(0.55, '#1A1050');
    g.addColorStop(1, '#04283A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD, WORLD);
    glowBlob(ctx, 170, 120, 560, '150,95,255', 0.55);
    glowBlob(ctx, 880, 880, 600, '40,220,230', 0.42);
    glowBlob(ctx, 900, 140, 420, '255,90,190', 0.3);
    glowBlob(ctx, 120, 900, 380, '70,130,255', 0.3);
  }
  ctx.restore();
}

/**
 * @param ctx   2D context, already scaled so that 1 unit = 1/1000 of the grid square
 * @param layout from buildLayout()
 * @param images array (per slot) of drawable canvases or null
 * @param o { motion, lt, loopLen, fadeOut, static, placeholders, selected, drag:{from,x,y} }
 */
export function drawScene(ctx, layout, images, o) {
  const dark = layout.dark;
  const stat = !!o.static;
  const lt = o.lt || 0;
  const loopLen = o.loopLen || LOOP;
  const fadeOut = o.fadeOut == null ? 0.4 : o.fadeOut;
  if (layout.backdrop) drawBackdrop(ctx, layout.backdrop);
  ctx.save();
  if (layout.group) {
    const g = layout.group;
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.rot);
    ctx.translate(-g.cx, -g.cy);
  }
  if (layout.decor) {
    const da = stat ? 1 : Math.min(1, lt / 0.4) * (1 - Math.max(0, Math.min(1, (lt - (loopLen - fadeOut)) / fadeOut)));
    layout.decor.forEach((d) => drawDecor(ctx, d, Math.max(0, da)));
  }
  layout.cells.forEach((c, i) => {
    const img = images[i] || null;
    if (!img && !o.placeholders) return;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const a = stat ? identity() : getAnim(o.motion, i, lt, cx, cy, fadeOut, loopLen);
    drawCell(ctx, c, img, a, dark, o, i);
  });
  ctx.restore();

  if (o.drag && images[o.drag.from]) {
    const img = images[o.drag.from];
    const s = 190;
    ctx.save();
    ctx.translate(o.drag.x, o.drag.y);
    ctx.rotate(0.06);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    rr(ctx, -s / 2 - 6, -s / 2 - 6, s + 12, s + 12, 22);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    rr(ctx, -s / 2, -s / 2, s, s, 17);
    ctx.clip();
    drawCover(ctx, img, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
}

function drawCell(ctx, c, img, a, dark, o, i) {
  if (a.alpha <= 0.003 || a.s <= 0.003 || Math.abs(a.sx * a.s) < 0.012) return;
  const w = c.w, h = c.h;
  ctx.save();
  ctx.translate(c.x + w / 2 + a.dx, c.y + h / 2 + a.dy);
  ctx.rotate(c.rot + a.rot);
  ctx.scale(a.s * a.sx, a.s);
  ctx.translate(-w / 2, -h / 2);
  ctx.globalAlpha = Math.max(0, Math.min(1, a.alpha)) * (o.drag && o.drag.from === i ? 0.3 : 1);

  const full = { x: 0, y: 0, w, h };
  let box = full;

  if (a.back) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#12307F');
    g.addColorStop(1, '#071238');
    ctx.fillStyle = g;
    cellPath(ctx, c, full);
    ctx.fill();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (c.frame === 'polaroid' || c.frame === 'scrap') {
    const pad = c.frame === 'polaroid' ? w * 0.055 : 10;
    const bottom = c.frame === 'polaroid' ? h * 0.15 : 0;
    ctx.save();
    ctx.shadowColor = 'rgba(30,25,15,0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    rr(ctx, 0, 0, w, h, c.r);
    ctx.fill();
    ctx.restore();
    box = { x: pad, y: pad, w: w - pad * 2, h: h - pad - Math.max(pad, bottom) };
    if (c.frame === 'scrap' && c.tape) {
      ctx.save();
      ctx.translate(w / 2, 2);
      ctx.rotate(c.tape * 0.12);
      ctx.fillStyle = 'rgba(255,205,84,0.82)';
      ctx.fillRect(-48, -15, 96, 30);
      ctx.restore();
    }
  }

  const shapeBox = c.frame ? Object.assign({}, box, { r: 3 }) : full;
  const pc = c.frame ? { shape: 'rrect', r: 3 } : c;

  if (c.glow && img) {
    ctx.save();
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 36;
    ctx.fillStyle = c.glow;
    cellPath(ctx, c, full);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  cellPath(ctx, pc, shapeBox);
  ctx.clip();
  if (img) {
    drawCover(ctx, img, shapeBox.x, shapeBox.y, shapeBox.w, shapeBox.h, a.zoom, a.panX, a.panY);
    if (a.glitch > 0) {
      const g = a.glitch;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = 'rgba(255,0,90,0.55)';
      ctx.save(); ctx.translate(-10 * g, 0); ctx.fillRect(shapeBox.x, shapeBox.y, shapeBox.w, shapeBox.h); ctx.restore();
      ctx.fillStyle = 'rgba(0,220,255,0.55)';
      ctx.save(); ctx.translate(10 * g, 0); ctx.fillRect(shapeBox.x, shapeBox.y, shapeBox.w, shapeBox.h); ctx.restore();
      ctx.globalAlpha /= 0.5;
      ctx.globalCompositeOperation = 'source-over';
      const by = shapeBox.y + shapeBox.h * (0.2 + 0.5 * ((i * 37) % 10) / 10);
      ctx.save();
      ctx.beginPath(); ctx.rect(shapeBox.x - 40, by, shapeBox.w + 80, shapeBox.h * 0.12); ctx.clip();
      ctx.translate(24 * g, 0);
      drawCover(ctx, img, shapeBox.x, shapeBox.y, shapeBox.w, shapeBox.h, a.zoom, a.panX, a.panY);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(10,26,74,0.07)';
    ctx.fillRect(shapeBox.x, shapeBox.y, shapeBox.w, shapeBox.h);
    const s = Math.min(shapeBox.w, shapeBox.h) * 0.16;
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(10,26,74,0.3)';
    ctx.lineWidth = Math.max(4, s * 0.16);
    ctx.lineCap = 'round';
    const mx = shapeBox.x + shapeBox.w / 2, my = shapeBox.y + shapeBox.h / 2;
    ctx.beginPath();
    ctx.moveTo(mx - s, my); ctx.lineTo(mx + s, my);
    ctx.moveTo(mx, my - s); ctx.lineTo(mx, my + s);
    ctx.stroke();
  }
  ctx.restore();

  if (c.ring) {
    ctx.save();
    ctx.strokeStyle = c.ring;
    ctx.lineWidth = c.ringW || 5;
    ctx.lineJoin = 'round';
    if (c.glow) { ctx.shadowColor = c.glow; ctx.shadowBlur = 24; }
    cellPath(ctx, c, full);
    ctx.stroke();
    ctx.restore();
  }

  if (o.selected === i) {
    ctx.save();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 8;
    ctx.setLineDash([22, 14]);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    cellPath(ctx, pc, shapeBox);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export { WORLD };

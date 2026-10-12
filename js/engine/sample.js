// KIVO Grid - procedurally generated sample photos (so the app can be tried with one tap).
import { makePhotoFromCanvas } from './photos.js';

const SCENES = [
  { w: 1200, h: 900, sky: ['#FF9A62', '#FF5E7E', '#3B2A7A'], sun: [0.7, 0.42, 0.09, '#FFE3A3'], hills: ['#2B1B4F', '#1E1340'], kind: 'sea' },
  { w: 900, h: 1200, sky: ['#7FD0FF', '#B6E6FF', '#FFF3D6'], sun: [0.3, 0.2, 0.07, '#FFFFFF'], hills: ['#3C9D6E', '#2B7A57'], kind: 'hills' },
  { w: 1000, h: 1000, sky: ['#1B1F5C', '#5B2A86', '#E4569B'], sun: [0.5, 0.55, 0.12, '#FFD6A5'], hills: ['#120B33', '#0A0620'], kind: 'city' },
  { w: 1200, h: 900, sky: ['#0E1B4D', '#14307A', '#2C6FD1'], sun: [0.22, 0.25, 0.05, '#EAF6FF'], hills: ['#0B1233', '#070C24'], kind: 'city' },
  { w: 900, h: 1200, sky: ['#FFD27A', '#FF9F5A', '#E8575A'], sun: [0.5, 0.5, 0.14, '#FFF1B8'], hills: ['#6B2D5C', '#3F1D45'], kind: 'hills' },
  { w: 1200, h: 900, sky: ['#6FE0D1', '#5BB6F0', '#E7F7FF'], sun: [0.8, 0.22, 0.06, '#FFFFFF'], hills: ['#1F8A8A', '#13636A'], kind: 'sea' },
  { w: 900, h: 1200, sky: ['#F7B0C8', '#C8A2F0', '#6C7CFF'], sun: [0.5, 0.3, 0.1, '#FFF6FA'], hills: ['#4B3C99', '#33287A'], kind: 'hills' },
  { w: 1000, h: 1000, sky: ['#FFE29A', '#FFB46B', '#FF7F6B'], sun: [0.25, 0.4, 0.08, '#FFFFFF'], hills: ['#9B4A3C', '#6E3030'], kind: 'sea' },
  { w: 1200, h: 900, sky: ['#09112E', '#1B2A6B', '#3F5BD9'], sun: [0.65, 0.3, 0.04, '#FFFFFF'], hills: ['#0D1A44', '#08122F'], kind: 'city' },
];

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scene(i) {
  const S = SCENES[i % SCENES.length];
  const rand = mulberry(77 + i * 31);
  const c = document.createElement('canvas');
  c.width = S.w; c.height = S.h;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S.h);
  g.addColorStop(0, S.sky[0]); g.addColorStop(0.55, S.sky[1]); g.addColorStop(1, S.sky[2]);
  x.fillStyle = g; x.fillRect(0, 0, S.w, S.h);
  const [sx, sy, sr, sc] = S.sun;
  const glow = x.createRadialGradient(sx * S.w, sy * S.h, 0, sx * S.w, sy * S.h, sr * S.w * 5);
  glow.addColorStop(0, sc + 'AA'); glow.addColorStop(1, sc + '00');
  x.fillStyle = glow; x.fillRect(0, 0, S.w, S.h);
  x.fillStyle = sc; x.beginPath(); x.arc(sx * S.w, sy * S.h, sr * S.w, 0, Math.PI * 2); x.fill();
  if (S.kind === 'hills' || S.kind === 'sea') {
    for (let L = 0; L < 3; L++) {
      x.fillStyle = L === 2 ? S.hills[1] : S.hills[0];
      x.globalAlpha = 0.55 + L * 0.2;
      x.beginPath(); x.moveTo(0, S.h);
      const base = S.h * (0.62 + L * 0.1), amp = S.h * (0.14 - L * 0.03), f = 1.2 + L * 0.9, ph = rand() * 6;
      for (let px = 0; px <= S.w; px += 10) x.lineTo(px, base - Math.abs(Math.sin((px / S.w) * f * 3 + ph)) * amp - Math.sin((px / S.w) * 9 + L) * amp * 0.15);
      x.lineTo(S.w, S.h); x.closePath(); x.fill();
    }
    x.globalAlpha = 1;
    if (S.kind === 'sea') {
      x.fillStyle = 'rgba(255,255,255,0.10)';
      for (let k = 0; k < 26; k++) x.fillRect(rand() * S.w, S.h * (0.72 + rand() * 0.26), 60 + rand() * 160, 3);
    }
  } else {
    let px = 0;
    while (px < S.w) {
      const bw = 40 + rand() * 90, bh = S.h * (0.2 + rand() * 0.38);
      x.fillStyle = rand() > 0.5 ? S.hills[0] : S.hills[1];
      x.fillRect(px, S.h - bh, bw, bh);
      x.fillStyle = 'rgba(255,214,120,0.85)';
      for (let wy = S.h - bh + 14; wy < S.h - 10; wy += 22) for (let wx = px + 8; wx < px + bw - 10; wx += 16) if (rand() > 0.55) x.fillRect(wx, wy, 7, 10);
      px += bw + 4;
    }
  }
  // soft subject silhouette so faces-like focal points exist for crops
  x.fillStyle = 'rgba(8,10,28,0.55)';
  const fx = (0.3 + rand() * 0.4) * S.w, fy = S.h * 0.8;
  x.beginPath(); x.arc(fx, fy - S.h * 0.1, S.w * 0.035, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(fx, fy + S.h * 0.02, S.w * 0.05, S.h * 0.1, 0, 0, Math.PI * 2); x.fill();
  return c;
}

export function makeSamplePhotos(count) {
  return Array.from({ length: count }, (_, i) => makePhotoFromCanvas(scene(i), 'Sample ' + (i + 1)));
}

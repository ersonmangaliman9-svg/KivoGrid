// KIVO Grid - app controller.

import { TEMPLATES, buildLayout, hitTest } from './engine/layouts.js';
import { FILTERS, getFiltered, getScaled, peekFiltered } from './engine/filters.js';
import { MOTIONS, resolveTime } from './engine/motion.js';
import { drawBackground, drawScene } from './engine/render.js';
import { loadPhoto, releasePhoto } from './engine/photos.js';
import { makeSamplePhotos } from './engine/sample.js';
import { renderPNG, canvasToBlob, saveBlob, recordReel, drawReelFrame, reelDuration, supportsReel } from './engine/export.js';
import { FACEBOOK_URL, MAX_PHOTOS } from './config.js';

const PREVIEW_DIM = 1100;
const EXPORT_DIM = 2000;
const STORE_KEY = 'kivo-grid:v1';

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');

const S = {
  tab: 'layout',
  tpl: 0,
  n: 9,
  autoN: true,
  filter: 0,
  motion: 0,
  photos: [],
  selected: -1,
  drag: null,
  t0: performance.now(),
  liveTpl: 0,
  busy: false,
};

// ---------- persistence (settings only; photos stay on the device) ----------
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (saved) {
    if (Number.isInteger(saved.tpl) && saved.tpl >= 0 && saved.tpl < TEMPLATES.length) S.tpl = saved.tpl;
    if (Number.isInteger(saved.n) && saved.n >= 2 && saved.n <= 9) S.n = saved.n;
    if (typeof saved.autoN === 'boolean') S.autoN = saved.autoN;
    if (Number.isInteger(saved.filter) && saved.filter >= 0 && saved.filter < FILTERS.length) S.filter = saved.filter;
    if (Number.isInteger(saved.motion) && saved.motion >= 0 && saved.motion < MOTIONS.length) S.motion = saved.motion;
  }
} catch (e) { /* ignore */ }
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ tpl: S.tpl, n: S.n, autoN: S.autoN, filter: S.filter, motion: S.motion })); } catch (e) { /* ignore */ }
}

// ---------- helpers ----------
let toastTimer = 0;
function toast(msg, ms = 2800) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const motionId = () => MOTIONS[S.motion].id;
const restart = () => { S.t0 = performance.now(); };

function arsFor(n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(S.photos[i] ? S.photos[i].w / S.photos[i].h : 1);
  return a;
}
function layoutFor(tpl) { return buildLayout(tpl, S.n, arsFor(S.n)); }

// ---------- photos ----------
async function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => !f.type || f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(f.name));
  if (!files.length) { toast('Please choose image files.'); return; }
  const room = MAX_PHOTOS - S.photos.length;
  if (room <= 0) { toast(`Maximum ${MAX_PHOTOS} photos. Remove one in Strip first.`); return; }
  const use = files.slice(0, room);
  showBusy(`Loading ${use.length} photo${use.length > 1 ? 's' : ''}…`);
  await nextFrame();
  let failed = 0;
  for (const f of use) {
    try { S.photos.push(await loadPhoto(f)); } catch (e) { failed++; }
  }
  hideBusy();
  if (files.length > room) toast(`Added ${use.length - failed}. Limit is ${MAX_PHOTOS} photos.`);
  else if (failed) toast(`${failed} photo${failed > 1 ? 's' : ''} could not be opened (try JPG or PNG).`);
  afterPhotosChanged();
}

function afterPhotosChanged() {
  if (S.autoN) S.n = Math.max(2, Math.min(9, S.photos.length || S.n));
  S.selected = -1;
  restart();
  persist();
  renderUI();
}

function removePhoto(i) {
  const [p] = S.photos.splice(i, 1);
  if (p) releasePhoto(p);
  afterPhotosChanged();
}

function swapSlots(i, j) {
  if (i === j || i < 0 || j < 0 || i >= S.photos.length || j >= S.photos.length) return;
  [S.photos[i], S.photos[j]] = [S.photos[j], S.photos[i]];
  S.selected = -1;
  restart();
  renderUI();
}

function pickFiles() { $('file').click(); }
$('file').addEventListener('change', (e) => {
  const files = e.target.files;
  addFiles(files).finally(() => { e.target.value = ''; });
});

function useSamples() {
  S.photos.forEach(releasePhoto);
  S.photos = makeSamplePhotos(9);
  S.autoN = true;
  afterPhotosChanged();
  toast('Sample photos loaded. Add your own anytime.');
}

// ---------- UI ----------
const TABS = ['layout', 'grid', 'filter', 'strip', 'motion', 'swap'];

function effectiveTpl() { return motionId() === 'showcase' ? S.liveTpl : S.tpl; }

function titleInfo() {
  const empty = S.photos.length === 0;
  if (empty && S.tab !== 'grid' && S.tab !== 'strip') return { title: 'MEET KIVO GRID', chip: 'ADD 2 TO 9 PHOTOS', arrows: false, sticker: 'UPLOAD ONCE' };
  switch (S.tab) {
    case 'layout': {
      const i = effectiveTpl();
      return { title: TEMPLATES[i].name, chip: `${TEMPLATES[i].premium ? 'PREMIUM ' : ''}TEMPLATE ${pad2(i + 1)} / ${TEMPLATES.length}`, arrows: true, sticker: TEMPLATES[i].premium ? 'PREMIUM' : `${TEMPLATES.length} TEMPLATES` };
    }
    case 'grid': return { title: `${S.n} PICS. 1 GRID`, chip: 'CHOOSE 2 TO 9 PHOTOS', arrows: false, sticker: 'PICK 2 TO 9 PHOTOS' };
    case 'filter': return { title: FILTERS[S.filter].name, chip: `FILTER ${pad2(S.filter + 1)} / ${FILTERS.length}`, arrows: true, sticker: `${FILTERS.length} FILTERS` };
    case 'strip': return { title: 'YOUR PHOTOS', chip: `${S.photos.length} / ${MAX_PHOTOS} UPLOADED`, arrows: false, sticker: 'UPLOAD ONCE' };
    case 'motion': {
      const sc = motionId() === 'showcase';
      return { title: MOTIONS[S.motion].name, chip: sc ? `AUTO-PLAYS ${TEMPLATES.length} TEMPLATES` : 'LOOPS EVERY 4.4S', arrows: true, sticker: `${MOTIONS.length} MOTION STYLES` };
    }
    default: return { title: 'DRAG & SWAP', chip: 'TAP OR DRAG A PHOTO ONTO ANOTHER', arrows: false, sticker: 'DRAG & SWAP' };
  }
}

let lastSticker = '';
function renderTitle() {
  const t = titleInfo();
  $('title').textContent = t.title;
  $('subchip').textContent = t.chip;
  $('prevBtn').hidden = !t.arrows;
  $('nextBtn').hidden = !t.arrows;
  if (t.sticker !== lastSticker) {
    const st = $('sticker');
    st.textContent = t.sticker;
    st.style.animation = 'none';
    void st.offsetWidth;
    st.style.animation = '';
    lastSticker = t.sticker;
  }
}

function renderStrip() {
  const el = $('strip');
  const removable = S.tab === 'strip';
  let html = '';
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const p = S.photos[i];
    if (p) {
      const cls = 'thumb' + (S.selected === i ? ' sel' : '') + (i >= S.n ? ' dim' : '');
      html += `<div class="${cls}" data-i="${i}" role="button" tabindex="0" aria-label="Photo ${i + 1}"><img src="${p.thumb}" alt="" />${removable ? `<span class="x" data-rm="${i}" aria-label="Remove photo ${i + 1}">×</span>` : ''}</div>`;
    } else {
      html += `<button class="thumb empty" data-add="1" type="button" aria-label="Add photo">+</button>`;
    }
  }
  el.innerHTML = html;
  $('caption').textContent = S.tab === 'swap' ? 'DRAG A PHOTO ONTO ANOTHER, OR TAP TWO' : '1 UPLOAD PER PHOTO';
}

function chipsHTML(items, activeIdx, kind) {
  return `<div class="chips" data-kind="${kind}">` + items.map((it, i) => `<button class="chip${i === activeIdx ? ' on' : ''}" data-i="${i}" type="button">${it.dot ? `<span class="dot" style="background:${it.dot}"></span>` : ''}${it.name}${it.premium ? '<span class="pro">PRO</span>' : ''}</button>`).join('') + '</div>';
}

function renderCtx() {
  const el = $('ctx');
  if (S.photos.length === 0 && S.tab !== 'grid') {
    el.innerHTML = `<div class="actions"><button class="act primary" data-act="add" type="button">+ Add photos</button><button class="act" data-act="sample" type="button">Try sample photos</button></div>`;
    return;
  }
  switch (S.tab) {
    case 'layout': el.innerHTML = chipsHTML(TEMPLATES, S.tpl, 'layout'); break;
    case 'filter': el.innerHTML = chipsHTML(FILTERS, S.filter, 'filter'); break;
    case 'motion': el.innerHTML = chipsHTML(MOTIONS, S.motion, 'motion'); break;
    case 'grid': el.innerHTML = '<div class="nums">' + [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="num${n === S.n ? ' on' : ''}" data-n="${n}" type="button" aria-label="${n} photos">${n}</button>`).join('') + '</div>'; break;
    case 'strip': el.innerHTML = `<div class="actions"><button class="act primary" data-act="add" type="button">+ Add photos</button><button class="act" data-act="sample" type="button">Samples</button><button class="act" data-act="clear" type="button">Clear all</button></div>`; break;
    default: el.innerHTML = `<div class="hint">${S.selected >= 0 ? 'Now tap the photo to swap with' : 'Tap a photo, then another'}</div>`;
  }
  const on = el.querySelector('.chip.on');
  const row = el.querySelector('.chips');
  if (on && row) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.clientWidth / 2;
}

function renderTabs() {
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === S.tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function renderUI() {
  renderTitle();
  renderStrip();
  renderCtx();
  renderTabs();
}

function setTab(tab) {
  if (!TABS.includes(tab)) return;
  S.tab = tab;
  S.selected = -1;
  S.drag = null;
  renderUI();
}

function setTemplate(i) {
  if (motionId() === 'showcase') {
    S.motion = 0;
    toast('Showcase off. Pick Showcase in Motion to auto-play all templates.');
  }
  S.tpl = (i + TEMPLATES.length) % TEMPLATES.length;
  restart(); persist(); renderUI();
}
function setFilter(i) { S.filter = (i + FILTERS.length) % FILTERS.length; persist(); renderUI(); }
function setMotion(i) { S.motion = (i + MOTIONS.length) % MOTIONS.length; restart(); persist(); renderUI(); }
function setCount(n) { S.n = n; S.autoN = false; restart(); persist(); renderUI(); }

function step(d) {
  if (S.tab === 'layout') setTemplate((motionId() === 'showcase' ? S.liveTpl : S.tpl) + d);
  else if (S.tab === 'filter') setFilter(S.filter + d);
  else if (S.tab === 'motion') setMotion(S.motion + d);
}

// ---------- events ----------
$('tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.tab); });
$('prevBtn').addEventListener('click', () => step(-1));
$('nextBtn').addEventListener('click', () => step(1));

$('ctx').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) {
    const i = Number(chip.dataset.i);
    const kind = chip.parentElement.dataset.kind;
    if (kind === 'layout') setTemplate(i);
    else if (kind === 'filter') setFilter(i);
    else if (kind === 'motion') setMotion(i);
    return;
  }
  const num = e.target.closest('.num');
  if (num) { setCount(Number(num.dataset.n)); return; }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  if (act.dataset.act === 'add') pickFiles();
  else if (act.dataset.act === 'sample') useSamples();
  else if (act.dataset.act === 'clear') {
    S.photos.forEach(releasePhoto);
    S.photos = [];
    S.autoN = true;
    afterPhotosChanged();
  }
});

function onThumb(e) {
  const rm = e.target.closest('[data-rm]');
  if (rm) { removePhoto(Number(rm.dataset.rm)); return; }
  if (e.target.closest('[data-add]')) { pickFiles(); return; }
  const th = e.target.closest('.thumb[data-i]');
  if (!th) return;
  const i = Number(th.dataset.i);
  if (S.tab === 'swap') selectOrSwap(i);
}
$('strip').addEventListener('click', onThumb);
$('strip').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onThumb(e); } });

function selectOrSwap(i) {
  if (i >= S.photos.length) return;
  if (S.selected < 0) S.selected = i;
  else if (S.selected === i) S.selected = -1;
  else { swapSlots(S.selected, i); return; }
  renderStrip();
  renderCtx();
}

// canvas pointer handling (tap an empty slot to add, tap/drag in Swap mode)
const cv = $('cv');
let ptr = null;
let curLayout = layoutFor(0);
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 1000, y: ((e.clientY - r.top) / r.height) * 1000 };
}
cv.addEventListener('pointerdown', (e) => {
  if (S.busy) return;
  const p = toWorld(e);
  ptr = { id: e.pointerId, idx: hitTest(curLayout, p.x, p.y), sx: p.x, sy: p.y, moved: false };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
cv.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = toWorld(e);
  if (!ptr.moved && Math.hypot(p.x - ptr.sx, p.y - ptr.sy) > 22) ptr.moved = true;
  if (ptr.moved && S.tab === 'swap' && ptr.idx >= 0 && ptr.idx < S.photos.length) S.drag = { from: ptr.idx, x: p.x, y: p.y };
});
function endPointer(e, cancelled) {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = toWorld(e);
  const wasDrag = S.drag;
  const idx = ptr.idx, moved = ptr.moved;
  ptr = null;
  S.drag = null;
  if (cancelled) return;
  if (wasDrag) {
    const target = hitTest(curLayout, p.x, p.y);
    if (target >= 0 && target !== wasDrag.from) swapSlots(wasDrag.from, target);
    return;
  }
  if (moved || idx < 0) return;
  if (idx >= S.photos.length) { pickFiles(); return; }
  if (S.tab === 'swap') selectOrSwap(idx);
}
cv.addEventListener('pointerup', (e) => endPointer(e, false));
cv.addEventListener('pointercancel', (e) => endPointer(e, true));

// ---------- render loop ----------
const ctx2d = cv.getContext('2d');
let cssSize = 0;
function resizeCanvas() {
  const w = Math.max(1, Math.round(cv.clientWidth));
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const px = Math.round(w * dpr);
  if (cv.width !== px || cv.height !== px) { cv.width = px; cv.height = px; }
  cssSize = w;
}
new ResizeObserver(resizeCanvas).observe($('card'));
window.addEventListener('resize', resizeCanvas);

let lastTheme = '';
function setTheme(dark) {
  const v = dark ? 'dark' : 'light';
  if (v === lastTheme) return;
  lastTheme = v;
  document.documentElement.dataset.theme = v;
  $('themeColor').setAttribute('content', dark ? '#0a1448' : '#e4e0d7');
}

function previewImages(n) {
  let budget = 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = S.photos[i];
    if (!p) { out.push(null); continue; }
    let img = peekFiltered(p, S.filter, PREVIEW_DIM);
    if (!img) {
      if (budget > 0) { img = getFiltered(p, S.filter, PREVIEW_DIM); budget--; } else img = getScaled(p, PREVIEW_DIM);
    }
    out.push(img);
  }
  return out;
}

let frameErrors = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (S.busy || !cssSize) return;
  try {
    const t = Math.max(0, (now - S.t0) / 1000);
    const R = resolveTime(motionId(), S.tpl, t, TEMPLATES.length);
    if (R.tpl !== S.liveTpl) {
      S.liveTpl = R.tpl;
      if (motionId() === 'showcase' && S.tab === 'layout') renderTitle();
    }
    const layout = layoutFor(R.tpl);
    curLayout = layout;
    setTheme(layout.dark);
    const W = cv.width;
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground(ctx2d, layout.dark, 0, 0, W, W);
    ctx2d.scale(W / 1000, W / 1000);
    drawScene(ctx2d, layout, previewImages(S.n), {
      motion: motionId(), lt: R.lt, loopLen: R.loopLen, fadeOut: R.fadeOut,
      placeholders: true, selected: S.selected, drag: S.drag,
    });
  } catch (err) {
    if (frameErrors++ < 3) console.error('KIVO Grid render error', err);
  }
}

// ---------- export ----------
function showBusy(text, { progress = false, cancel = false } = {}) {
  S.busy = true;
  $('busyText').textContent = text;
  $('busyBar').hidden = !progress;
  $('busyHint').hidden = !progress;
  $('busyCancel').hidden = !cancel;
  $('busyFill').style.width = '0%';
  $('busy').hidden = false;
}
function hideBusy() { S.busy = false; $('busy').hidden = true; }

function openExport() {
  if (S.photos.length < S.n) {
    const need = S.n - S.photos.length;
    toast(`Add ${need} more photo${need > 1 ? 's' : ''} or pick a smaller grid in the Grid tab.`);
    return;
  }
  $('reelSub').textContent = `Vertical video with your current motion: ${MOTIONS[S.motion].name}`;
  const fb = $('fbLink');
  if (FACEBOOK_URL) { fb.href = FACEBOOK_URL; fb.hidden = false; } else fb.hidden = true;
  $('modal').hidden = false;
  $('savePng').focus();
}
function closeExport() { $('modal').hidden = true; }

function exportImages(dim) {
  const out = [];
  for (let i = 0; i < S.n; i++) out.push(getFiltered(S.photos[i], S.filter, dim));
  return out;
}
const stamp = () => new Date().toISOString().slice(0, 10);

async function exportPNG() {
  closeExport();
  showBusy('Rendering your grid…');
  await nextFrame();
  try {
    const tplIdx = effectiveTpl();
    const layout = layoutFor(tplIdx);
    const canvas = renderPNG(layout, exportImages(EXPORT_DIM), 2160);
    const blob = await canvasToBlob(canvas, 'image/png');
    await saveBlob(blob, `kivo-grid-${TEMPLATES[tplIdx].id}-${stamp()}.png`);
    toast('Saved! Check your downloads or photos.');
  } catch (err) {
    console.error(err);
    toast('Could not save the image: ' + (err && err.message ? err.message : 'unknown error'), 4500);
  } finally {
    hideBusy();
  }
}

let logoImg = null;
function loadLogo() {
  return new Promise((resolve) => {
    if (logoImg) return resolve(logoImg);
    const im = new Image();
    im.onload = () => { logoImg = im; resolve(im); };
    im.onerror = () => resolve(null);
    im.src = 'logo.png';
  });
}

async function exportReel() {
  closeExport();
  if (!supportsReel()) {
    toast('This browser cannot record video. Use Chrome, Edge, Firefox or Safari 14.1+. You can still save the PNG.', 5500);
    return;
  }
  showBusy('Preparing reel…');
  await nextFrame();
  const control = { cancelled: false };
  try {
    const images = exportImages(PREVIEW_DIM);
    const logo = await loadLogo();
    try { if (document.fonts && document.fonts.load) await document.fonts.load('900 64px Inter'); } catch (e) { /* ignore */ }
    const mid = motionId();
    const tplIdx = S.tpl;
    $('busyText').textContent = 'Recording reel…';
    $('busyBar').hidden = false;
    $('busyHint').hidden = false;
    $('busyCancel').hidden = false;
    $('busyCancel').onclick = () => { control.cancelled = true; };
    const result = await recordReel({
      duration: reelDuration(mid),
      control,
      onProgress: (p) => { $('busyFill').style.width = Math.round(p * 100) + '%'; },
      draw: (ctx, t) => drawReelFrame(ctx, {
        t, motionId: mid, tplIdx, logo,
        getLayout: (i) => layoutFor(i),
        getImages: () => images,
        titleFor: (i) => TEMPLATES[i].name,
      }),
    });
    if (!result) { toast('Reel cancelled.'); return; }
    if (!result.blob.size) throw new Error('Recording was empty');
    await saveBlob(result.blob, `kivo-grid-reel-${stamp()}.${result.ext}`);
    toast(result.ext === 'mp4' ? 'Reel saved!' : 'Reel saved as WebM. Most apps accept it; convert to MP4 if Facebook rejects it.', 5000);
  } catch (err) {
    console.error(err);
    toast('Could not record the reel: ' + (err && err.message ? err.message : 'unknown error'), 5000);
  } finally {
    hideBusy();
    $('busyCancel').onclick = null;
  }
}

$('exportBtn').addEventListener('click', openExport);
$('closeModal').addEventListener('click', closeExport);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeExport(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeExport(); });
$('savePng').addEventListener('click', exportPNG);
$('saveReel').addEventListener('click', exportReel);

// drag & drop files onto the page
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// test hook (harmless in production)
window.__kivo = { S, setTab, setTemplate, setFilter, setMotion, setCount, addFiles, useSamples, swapSlots };

renderUI();
resizeCanvas();
requestAnimationFrame(frame);

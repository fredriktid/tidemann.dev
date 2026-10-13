<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { loadSim, type Sim } from '@/lib/wasm';

const props = defineProps<{ src: string; fallback: string; alt: string }>();

const field = ref<HTMLDivElement | null>(null);
const box = ref<HTMLDivElement | null>(null);
const terrainCanvas = ref<HTMLCanvasElement | null>(null);
const tileCanvas = ref<HTMLCanvasElement | null>(null);
const contourCanvas = ref<HTMLCanvasElement | null>(null);

const ready = ref(false);
const aerial = ref(false);
const lensOn = ref(false);
const spot = ref<{ x: number; y: number; h: number } | null>(null);

// Survey constants. The contour interval is shared by the terrain tint and the tiles.
const LEVELS = 22;
const STEP = 1 / (LEVELS + 1);
const WATER = 4 * STEP;
const BASE = 0.36;
const RELIEF = 0.6;
const SEED = 2001;
const METRES = 1200;

const IDLE_BLOCK = 8;
const FINE = 2;
const RADIUS = 80;
const MIN_ALPHA = 28;
const GAP = 0.14;

let sim: Sim | null = null;
let tctx: CanvasRenderingContext2D | null = null;
let cctx: CanvasRenderingContext2D | null = null;
let kctx: CanvasRenderingContext2D | null = null;
let img = 256;
let dpr = 1;
let fieldW = 0;
let fieldH = 0;
let boxX = 0;
let boxY = 0;
let boxS = 0;
let cell = 6;
let gw = 0;
let gh = 0;
let segs: Float32Array | null = null;
let lvl: Int32Array | null = null;
let heights: Float32Array | null = null;
let raf = 0;
let drawRaf = 0;
let mx = 0;
let my = 0;
let reducedMotion = false;
let resizeObserver: ResizeObserver | null = null;
let resizeRaf = 0;

// Stepped hypsometric ramp, kept in step with paint() in the wasm module.
function ramp(h: number): [number, number, number] {
  if (h < WATER) return [201, 223, 240];
  const q = (Math.floor((h - WATER) / STEP) * STEP) / (1 - WATER);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  if (q < 0.45) {
    const t = q / 0.45;
    return [mix(207, 226, t), mix(225, 234, t), mix(184, 205, t)];
  }
  if (q < 0.75) {
    const t = (q - 0.45) / 0.3;
    return [mix(226, 238, t), mix(234, 233, t), mix(205, 214, t)];
  }
  const t = (q - 0.75) / 0.25;
  return [mix(238, 246, t), mix(233, 243, t), mix(214, 234, t)];
}

function sizeCanvas(el: HTMLCanvasElement, w: number, h: number) {
  el.width = Math.round(w * dpr);
  el.height = Math.round(h * dpr);
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
}

function measure() {
  const f = field.value;
  const b = box.value;
  if (!f || !b) return false;
  const fr = f.getBoundingClientRect();
  const br = b.getBoundingClientRect();
  fieldW = Math.max(1, Math.round(fr.width));
  fieldH = Math.max(1, Math.round(fr.height));
  boxX = br.left - fr.left;
  boxY = br.top - fr.top;
  boxS = Math.max(1, br.width);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cell = Math.max(5, Math.ceil(fieldW / 250), Math.ceil(fieldH / 250));
  gw = Math.ceil(fieldW / cell) + 1;
  gh = Math.ceil(fieldH / cell) + 1;
  return true;
}

function survey() {
  if (!sim) return;
  const e = sim.exports;
  e.terrain(gw, gh, SEED, cell / 260);
  e.basin(gw * 0.9, gh * 0.8, gw * 0.13, gh * 0.2, 0.55);
  e.stamp(boxX / cell, boxY / cell, boxS / cell, BASE, RELIEF);
  e.paint(WATER, STEP);
  const total = e.march(LEVELS, 0, 1);
  segs = sim.segments(total).slice();
  lvl = sim.levels(LEVELS).slice();
  heights = sim.heights(gw * gh).slice();

  const rgba = sim.rgba(gw * gh);
  const off = document.createElement('canvas');
  off.width = gw;
  off.height = gh;
  off.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(rgba), gw, gh), 0, 0);

  const t = terrainCanvas.value;
  if (t && tctx) {
    sizeCanvas(t, fieldW, fieldH);
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(off, -cell / 2, -cell / 2, gw * cell, gh * cell);
  }
  const k = contourCanvas.value;
  if (k) sizeCanvas(k, fieldW, fieldH);
  const c = tileCanvas.value;
  if (c) sizeCanvas(c, boxS, boxS);
}

function drawContours(upTo: number) {
  if (!kctx || !segs || !lvl) return;
  kctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  kctx.clearRect(0, 0, fieldW, fieldH);
  kctx.lineCap = 'round';
  const s = cell;
  for (let k = 3; k < LEVELS && k <= upTo; k++) {
    const shore = k === 3;
    const index = (k + 1) % 5 === 0;
    kctx.beginPath();
    for (let i = lvl[k]; i < lvl[k + 1]; i++) {
      const o = i * 4;
      kctx.moveTo(segs[o] * s, segs[o + 1] * s);
      kctx.lineTo(segs[o + 2] * s, segs[o + 3] * s);
    }
    kctx.strokeStyle = shore ? 'rgba(47, 111, 176, 0.9)' : index ? 'rgba(122, 76, 32, 0.9)' : 'rgba(138, 90, 43, 0.55)';
    kctx.lineWidth = shore ? 1.1 : index ? 1.35 : 0.7;
    kctx.stroke();
  }
  labelIndexContours(upTo);
}

// Height figures on index contours, set along the line with a paper knockout, as on a printed sheet.
function labelIndexContours(upTo: number) {
  if (!kctx || !segs || !lvl) return;
  const ctx = kctx;
  ctx.font = '600 10px "Schibsted Grotesk Variable", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 4; k < LEVELS && k <= upTo; k += 5) {
    const count = lvl[k + 1] - lvl[k];
    if (count < 40) continue;
    const label = String(Math.round(((k + 1) * STEP * METRES) / 10) * 10);
    for (const frac of [0.23, 0.71]) {
      const o = (lvl[k] + Math.floor(count * frac)) * 4;
      const x = ((segs[o] + segs[o + 2]) / 2) * cell;
      const y = ((segs[o + 1] + segs[o + 3]) / 2) * cell;
      if (x > boxX - 8 && x < boxX + boxS + 8 && y > boxY - 8 && y < boxY + boxS + 8) continue;
      let a = Math.atan2(segs[o + 3] - segs[o + 1], segs[o + 2] - segs[o]);
      if (a > Math.PI / 2) a -= Math.PI;
      if (a < -Math.PI / 2) a += Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const w = ctx.measureText(label).width + 6;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(-w / 2, -6, w, 12);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(122, 76, 32, 0.95)';
      ctx.fillText(label, 0, 0.5);
      ctx.restore();
    }
  }
}

function drawIn() {
  cancelAnimationFrame(drawRaf);
  if (reducedMotion) {
    drawContours(LEVELS);
    return;
  }
  const start = performance.now();
  const duration = 1400;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    drawContours(3 + Math.floor(eased * (LEVELS - 3)));
    if (t < 1) drawRaf = requestAnimationFrame(tick);
  };
  drawRaf = requestAnimationFrame(tick);
}

function renderTiles(active: number) {
  if (!sim || !cctx) return;
  const count = sim.exports.pixelate(IDLE_BLOCK, FINE, mx, my, active, RADIUS, MIN_ALPHA);
  const cells = sim.cells(count);
  const s = boxS / img;
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cctx.clearRect(0, 0, boxS, boxS);
  for (let i = 0; i < count; i++) {
    const o = i * 8;
    const b = cells[o + 2];
    const px = cells[o] * s;
    const py = cells[o + 1] * s;
    const w = b * s;
    const gap = Math.min(w * GAP, 2.5);
    const a = (cells[o + 6] / 255) * sim.exports.cropFade(cells[o] + b / 2, cells[o + 1] + b / 2);
    if (a < 0.04) continue;
    let r = cells[o + 3];
    let g = cells[o + 4];
    let bl = cells[o + 5];
    if (!aerial.value) {
      const lum = (r * 0.2126 + g * 0.7152 + bl * 0.0722) / 255;
      // Hypsometric tint, deepened toward forest shadow where the photo is dark.
      const [tr, tg, tb] = ramp(BASE + RELIEF * lum);
      const d = Math.max(0, 1 - lum * 1.35) * 0.78;
      r = tr + (74 - tr) * d;
      g = tg + (104 - tg) * d;
      bl = tb + (58 - tb) * d;
    }
    cctx.fillStyle = `rgba(${r | 0},${g | 0},${bl | 0},${a.toFixed(3)})`;
    cctx.fillRect(px + gap * 0.5, py + gap * 0.5, w - gap, w - gap);
  }
}

function heightAt(x: number, y: number) {
  if (!heights) return 0;
  const gx = Math.min(gw - 1, Math.max(0, Math.round(x / cell)));
  const gy = Math.min(gh - 1, Math.max(0, Math.round(y / cell)));
  return heights[gy * gw + gx];
}

function onMove(e: PointerEvent) {
  const f = field.value;
  if (!f || !ready.value) return;
  const r = f.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  spot.value = { x, y, h: Math.round(heightAt(x, y) * METRES) };
  const inBox = x >= boxX && x <= boxX + boxS && y >= boxY && y <= boxY + boxS;
  mx = ((x - boxX) / boxS) * img;
  my = ((y - boxY) / boxS) * img;
  if (inBox !== lensOn.value) lensOn.value = inBox;
  if (inBox) {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => renderTiles(1));
  } else if (!inBox && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
    renderTiles(0);
  }
}

function onLeave() {
  spot.value = null;
  lensOn.value = false;
  cancelAnimationFrame(raf);
  raf = 0;
  if (ready.value) renderTiles(0);
}

function setAerial(value: boolean) {
  aerial.value = value;
  if (contourCanvas.value) contourCanvas.value.style.opacity = value ? '0.35' : '1';
  if (ready.value) renderTiles(lensOn.value ? 1 : 0);
}

function rebuild(animate: boolean) {
  if (!measure()) return;
  survey();
  renderTiles(0);
  if (animate) drawIn();
  else drawContours(LEVELS);
}

onMounted(async () => {
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  tctx = terrainCanvas.value?.getContext('2d') ?? null;
  cctx = tileCanvas.value?.getContext('2d') ?? null;
  kctx = contourCanvas.value?.getContext('2d') ?? null;
  if (!tctx || !cctx || !kctx) return;

  const image = new Image();
  image.decoding = 'async';
  image.src = props.src;
  try {
    const [loaded] = await Promise.all([
      image.decode().then(() => image),
      loadSim().then((s) => (sim = s)),
      document.fonts?.ready,
    ]);
    if (!sim) return;
    img = sim.exports.imgSize();
    const off = document.createElement('canvas');
    off.width = img;
    off.height = img;
    const octx = off.getContext('2d', { willReadFrequently: true });
    if (!octx) return;
    octx.drawImage(loaded, 0, 0, img, img);
    sim.imageSrc().set(octx.getImageData(0, 0, img, img).data);
    sim.exports.prepareFace();
  } catch {
    return;
  }

  rebuild(true);
  ready.value = true;

  let lastW = fieldW;
  let lastH = fieldH;
  resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      const r = field.value?.getBoundingClientRect();
      if (!r || (Math.round(r.width) === lastW && Math.abs(Math.round(r.height) - lastH) < 2)) return;
      lastW = Math.round(r.width);
      lastH = Math.round(r.height);
      rebuild(false);
    });
  });
  if (field.value) resizeObserver.observe(field.value);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  cancelAnimationFrame(drawRaf);
  cancelAnimationFrame(resizeRaf);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div
    ref="field"
    class="survey"
    :class="{ 'is-ready': ready, 'is-lens': lensOn }"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <canvas ref="terrainCanvas" class="survey-layer" aria-hidden="true"></canvas>
    <div class="survey-grid" aria-hidden="true"></div>
    <div ref="box" class="survey-portrait" @click="setAerial(!aerial)">
      <img :src="fallback" :alt="alt" width="32" height="32" class="survey-fallback" fetchpriority="high" />
      <canvas ref="tileCanvas" class="survey-tiles" aria-hidden="true"></canvas>
    </div>
    <canvas ref="contourCanvas" class="survey-layer survey-contours" aria-hidden="true"></canvas>

    <div v-if="spot" class="survey-spot" :style="{ transform: `translate(${spot.x}px, ${spot.y}px)` }" aria-hidden="true">
      <svg width="9" height="8" viewBox="0 0 9 8"><path d="M4.5 0 9 8H0Z" fill="currentColor" /></svg>
      <span>{{ spot.h }}</span>
    </div>

    <div class="survey-controls">
      <div class="survey-scale" aria-live="polite">
        <span class="survey-scale-bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>Tile {{ lensOn ? `${FINE} px under the lens` : `${IDLE_BLOCK} px` }} · contours every {{ Math.round(STEP * METRES) }} m</span>
      </div>
      <div class="survey-layers" role="group" aria-label="Map layer">
        <button type="button" :aria-pressed="!aerial" @click="setAerial(false)">Map</button>
        <button type="button" :aria-pressed="aerial" @click="setAerial(true)">Aerial</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.survey {
  position: absolute;
  inset: 0;
  overflow: hidden;
  container-type: size;
  cursor: crosshair;
  touch-action: pan-y;
  user-select: none;
}

.survey-layer {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
}

.survey-contours {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.survey-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(to right, var(--color-grid) 1px, transparent 1px) 0 0 / var(--km) var(--km),
    linear-gradient(to bottom, var(--color-grid) 1px, transparent 1px) 0 0 / var(--km) var(--km);
}

.survey-portrait {
  --s: min(80cqh, 92cqw);
  position: absolute;
  width: var(--s);
  height: var(--s);
  left: calc(50cqw - var(--s) / 2);
  top: calc(50cqh - var(--s) / 2);
  cursor: crosshair;
}

@container (min-width: 1100px) {
  .survey-portrait {
    --s: min(88cqh, 60cqw);
    left: calc(42cqw - var(--s) / 2);
    top: calc(52cqh - var(--s) / 2);
  }
}

.survey-fallback,
.survey-tiles {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.survey-fallback {
  image-rendering: pixelated;
  object-fit: contain;
}

.survey-tiles {
  opacity: 0;
}

.is-ready .survey-tiles {
  opacity: 1;
}

.is-ready .survey-fallback {
  visibility: hidden;
}

.survey-spot {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.9rem 0 0 0.9rem;
  color: var(--color-ink);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  text-shadow:
    0 0 2px var(--color-paper),
    0 0 2px var(--color-paper),
    0 0 3px var(--color-paper);
}

.survey-controls {
  position: absolute;
  left: 0.75rem;
  top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.75rem;
  pointer-events: none;
}

.survey-scale {
  display: grid;
  gap: 0.35rem;
  padding: 0.5rem 0.65rem;
  background: color-mix(in oklab, var(--color-paper) 88%, transparent);
  color: var(--color-ink);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.survey-scale-bar {
  display: flex;
  width: 8rem;
  height: 0.4rem;
  border: 1px solid var(--color-ink);
}

.survey-scale-bar i {
  flex: 1;
}

.survey-scale-bar i:nth-child(odd) {
  background: var(--color-ink);
}

.survey-layers {
  display: flex;
  border: 1px solid var(--color-ink);
  background: var(--color-paper);
  pointer-events: auto;
}

.survey-layers button {
  min-height: 2.5rem;
  padding: 0 1rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-ink);
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.survey-layers button + button {
  border-left: 1px solid var(--color-ink);
}

.survey-layers button[aria-pressed='true'] {
  background: var(--color-ink);
  color: var(--color-paper);
}

.survey-layers button:not([aria-pressed='true']):hover {
  background: var(--color-forest);
}

@media (hover: none) {
  .survey-spot {
    display: none;
  }
}
</style>

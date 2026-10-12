<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { loadSim, type Sim } from '@/lib/wasm';

const props = defineProps<{ src: string; fallback: string; alt: string }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const ready = ref(false);
const mono = ref(false);

let sim: Sim | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let size = 256;
let cssSize = 0;
let dpr = 1;
let raf = 0;
let hovering = false;
let mx = 0;
let my = 0;
let block = 8;
let resizeObserver: ResizeObserver | null = null;

const IDLE_BLOCK = 8;
const FINE = 2;
const RADIUS = 88;
const MIN_ALPHA = 28;
const GAP = 0.16;
const ACCENT = [200, 255, 61];

const monoCache: string[] = [];
for (let i = 0; i <= 32; i++) {
  monoCache.push(`rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${(i / 32).toFixed(3)})`);
}

function measure() {
  const el = canvas.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  cssSize = Math.max(1, rect.width);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  el.width = Math.round(cssSize * dpr);
  el.height = Math.round(cssSize * dpr);
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render(active: number) {
  if (!sim || !ctx) return;
  const count = sim.exports.pixelate(block, FINE, mx, my, active, RADIUS, MIN_ALPHA);
  const cells = sim.cells(count);
  const s = cssSize / size;
  const isMono = mono.value;

  ctx.clearRect(0, 0, cssSize, cssSize);
  for (let i = 0; i < count; i++) {
    const o = i * 8;
    const b = cells[o + 2];
    const px = cells[o] * s;
    const py = cells[o + 1] * s;
    const w = b * s;
    const gap = Math.min(w * GAP, 3);
    const a = cells[o + 6] / 255;
    if (isMono) {
      const lum = (cells[o + 3] * 0.2126 + cells[o + 4] * 0.7152 + cells[o + 5] * 0.0722) / 255;
      ctx.fillStyle = monoCache[Math.round(Math.min(1, lum * 1.25) * a * 32)];
    } else {
      ctx.fillStyle = `rgba(${cells[o + 3]},${cells[o + 4]},${cells[o + 5]},${a.toFixed(3)})`;
    }
    ctx.fillRect(px + gap * 0.5, py + gap * 0.5, w - gap, w - gap);
  }
}

function loop() {
  cancelAnimationFrame(raf);
  const tick = () => {
    if (!hovering) return;
    render(1);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function toImageCoords(e: PointerEvent) {
  const el = canvas.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  mx = ((e.clientX - rect.left) / rect.width) * size;
  my = ((e.clientY - rect.top) / rect.height) * size;
}

function onEnter(e: PointerEvent) {
  hovering = true;
  toImageCoords(e);
  if (ready.value && block === IDLE_BLOCK) loop();
}

function onMove(e: PointerEvent) {
  toImageCoords(e);
  if (!hovering) onEnter(e);
}

function onLeave() {
  hovering = false;
  cancelAnimationFrame(raf);
  if (ready.value) render(0);
}

function onClick() {
  mono.value = !mono.value;
  if (ready.value) render(hovering ? 1 : 0);
}

onMounted(async () => {
  const el = canvas.value;
  if (!el) return;
  ctx = el.getContext('2d');
  if (!ctx) return;
  measure();

  const img = new Image();
  img.decoding = 'async';
  img.src = props.src;

  try {
    const [loaded] = await Promise.all([img.decode().then(() => img), loadSim().then((s) => (sim = s))]);
    if (!sim) return;
    size = sim.exports.imgSize();
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d', { willReadFrequently: true });
    if (!octx) return;
    octx.drawImage(loaded, 0, 0, size, size);
    sim.imageSrc().set(octx.getImageData(0, 0, size, size).data);
  } catch {
    return;
  }

  block = IDLE_BLOCK;
  render(0);
  ready.value = true;
  resizeObserver = new ResizeObserver(() => {
    measure();
    render(hovering ? 1 : 0);
  });
  resizeObserver.observe(el);
  if (hovering) loop();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div
    class="pixel-portrait"
    :class="{ 'is-ready': ready }"
    @pointerenter="onEnter"
    @pointermove="onMove"
    @pointerleave="onLeave"
    @click="onClick"
  >
    <img :src="fallback" :alt="alt" width="32" height="32" class="pixel-fallback" loading="eager" decoding="sync" fetchpriority="high" />
    <canvas ref="canvas" class="pixel-canvas" aria-hidden="true"></canvas>
    <span class="pixel-hint mono" aria-hidden="true">{{ mono ? 'click for colour' : 'hover · click' }}</span>
  </div>
</template>

<style scoped>
.pixel-portrait {
  position: relative;
  aspect-ratio: 1;
  width: 100%;
  cursor: crosshair;
  user-select: none;
  touch-action: pan-y;
  filter: drop-shadow(0 30px 50px rgba(0, 0, 0, 0.6));
}

.pixel-fallback,
.pixel-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.pixel-fallback {
  image-rendering: pixelated;
  object-fit: contain;
}

.pixel-canvas {
  opacity: 0;
}

.is-ready .pixel-canvas {
  opacity: 1;
}

.is-ready .pixel-fallback {
  visibility: hidden;
}

.pixel-hint {
  position: absolute;
  right: 0.5rem;
  bottom: 0.25rem;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--color-fg) 12%, transparent);
  background: color-mix(in oklab, var(--color-bg) 70%, transparent);
  color: var(--color-muted);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  backdrop-filter: blur(6px);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.is-ready .pixel-hint {
  opacity: 1;
}

@media (hover: none) {
  .pixel-hint {
    display: none;
  }
}
</style>

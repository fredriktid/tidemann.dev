<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { loadSim, type Sim } from '@/lib/wasm';

const canvas = ref<HTMLCanvasElement | null>(null);
const count = ref(0);
const ms = ref(0);
const ready = ref(false);
const failed = ref(false);

let sim: Sim | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;
let running = false;
let visible = true;
let width = 0;
let height = 0;
let dpr = 1;
let mouseX = 0;
let mouseY = 0;
let mouseActive = 0;
let strength = 0.9;
let ema = 0;
let frames = 0;
let reducedMotion = false;
let resizeObserver: ResizeObserver | null = null;
let intersection: IntersectionObserver | null = null;

const ACCENT = 'rgba(200, 255, 61, 0.55)';
const DIM = 'rgba(242, 239, 232, 0.16)';
const TRAIL = 'rgba(10, 10, 11, 0.4)';

function particleCount(w: number, h: number) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const base = Math.floor((w * h) / (coarse ? 1400 : 800));
  return Math.max(200, Math.min(coarse ? 700 : 2400, base));
}

function measure() {
  const el = canvas.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  width = Math.max(1, Math.round(rect.width));
  height = Math.max(1, Math.round(rect.height));
  dpr = Math.min(2, window.devicePixelRatio || 1);
  el.width = Math.round(width * dpr);
  el.height = Math.round(height * dpr);
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw() {
  if (!sim || !ctx) return;
  const p = sim.particles();
  const n = sim.exports.size();
  ctx.fillStyle = TRAIL;
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const vx = p[o + 2];
    const vy = p[o + 3];
    if (vx * vx + vy * vy >= 1.6) continue;
    ctx.rect(p[o], p[o + 1], 1.2, 1.2);
  }
  ctx.fillStyle = DIM;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const vx = p[o + 2];
    const vy = p[o + 3];
    if (vx * vx + vy * vy < 1.6) continue;
    ctx.rect(p[o], p[o + 1], 1.6, 1.6);
  }
  ctx.fillStyle = ACCENT;
  ctx.fill();
}

function frame(now: number) {
  if (!running || !sim) return;
  const dt = last ? Math.min(2, (now - last) / 16.667) : 1;
  last = now;

  const t0 = performance.now();
  sim.exports.step(dt, mouseX, mouseY, mouseActive, strength);
  const t1 = performance.now();
  ema = frames < 10 ? (ema * frames + (t1 - t0)) / (frames + 1) : ema * 0.95 + (t1 - t0) * 0.05;
  frames++;
  if ((frames & 15) === 0) ms.value = ema;

  draw();
  raf = requestAnimationFrame(frame);
}

function start() {
  if (running || !sim || reducedMotion || !visible || document.hidden) return;
  running = true;
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  cancelAnimationFrame(raf);
}

function renderStill() {
  if (!sim || !ctx) return;
  for (let i = 0; i < 240; i++) sim.exports.step(1, 0, 0, 0, 0);
  ctx.fillStyle = '#0a0a0b';
  ctx.fillRect(0, 0, width, height);
  draw();
  ms.value = 0;
}

function onPointerMove(e: PointerEvent) {
  const el = canvas.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  mouseActive = mouseX >= 0 && mouseY >= 0 && mouseX <= width && mouseY <= height ? 1 : 0;
}

function onPointerLeave() {
  mouseActive = 0;
}

function onPointerDown() {
  strength = -1.4;
}

function onPointerUp() {
  strength = 0.9;
}

function onVisibility() {
  if (document.hidden) stop();
  else start();
}

onMounted(async () => {
  const el = canvas.value;
  if (!el) return;
  ctx = el.getContext('2d', { alpha: false });
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  measure();

  try {
    sim = await loadSim();
  } catch {
    failed.value = true;
    return;
  }

  const n = particleCount(width, height);
  count.value = sim.exports.init(n, width, height, (Date.now() & 0xffffffff) >>> 0);
  ctx.fillStyle = '#0a0a0b';
  ctx.fillRect(0, 0, width, height);
  ready.value = true;

  resizeObserver = new ResizeObserver(() => {
    if (!sim) return;
    measure();
    sim.exports.resize(width, height);
    if (reducedMotion) renderStill();
  });
  resizeObserver.observe(el);

  intersection = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) start();
      else stop();
    },
    { threshold: 0 },
  );
  intersection.observe(el);

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibility);

  if (reducedMotion) renderStill();
  else start();
});

onBeforeUnmount(() => {
  stop();
  resizeObserver?.disconnect();
  intersection?.disconnect();
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerdown', onPointerDown);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  document.removeEventListener('pointerleave', onPointerLeave);
  document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<template>
  <div class="particle-field" :class="{ 'is-ready': ready }" aria-hidden="true">
    <canvas ref="canvas" class="particle-canvas"></canvas>
    <div v-if="ready" class="wasm-badge">
      <span class="wasm-dot"></span>
      <span class="wasm-text">
        {{ count.toLocaleString('en-US') }} particles · WebAssembly ·
        <span class="wasm-ms">{{ ms.toFixed(2) }} ms</span>/frame
      </span>
    </div>
    <div v-else-if="failed" class="wasm-badge">
      <span class="wasm-dot is-off"></span>
      <span class="wasm-text">WebAssembly unavailable</span>
    </div>
  </div>
</template>

<style scoped>
.particle-field {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: 0;
  transition: opacity 1.2s ease;
}

.particle-field.is-ready {
  opacity: 1;
}

.particle-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.wasm-badge {
  position: absolute;
  left: max(1rem, env(safe-area-inset-left));
  bottom: 1.25rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid color-mix(in oklab, var(--color-fg) 14%, transparent);
  border-radius: 999px;
  background: color-mix(in oklab, var(--color-bg) 72%, transparent);
  backdrop-filter: blur(8px);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.02em;
  color: var(--color-muted);
  pointer-events: none;
  white-space: nowrap;
}

.wasm-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--color-accent);
  box-shadow: 0 0 10px var(--color-accent);
  animation: pulse 2s ease-in-out infinite;
}

.wasm-dot.is-off {
  background: var(--color-muted);
  box-shadow: none;
  animation: none;
}

.wasm-ms {
  color: var(--color-fg);
  font-variant-numeric: tabular-nums;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wasm-dot {
    animation: none;
  }
}

@media (max-width: 640px) {
  .wasm-badge {
    bottom: 0.75rem;
    font-size: 0.62rem;
  }
}
</style>

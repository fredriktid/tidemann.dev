const MAX: i32 = 8192;
const STRIDE: usize = 16;
const BUF: usize = memory.data(MAX * 16);

let count: i32 = 0;
let width: f32 = 1;
let height: f32 = 1;
let time: f32 = 0;
let rng: u32 = 0x9e3779b9;

@inline
function rand(): f32 {
  rng ^= rng << 13;
  rng ^= rng >> 17;
  rng ^= rng << 5;
  return <f32>(rng & 0xffffff) / 16777216.0;
}

@inline
function fieldX(x: f32, y: f32, t: f32): f32 {
  return Mathf.sin(y * 0.0038 + t * 0.35) + Mathf.cos((x + y) * 0.0021 - t * 0.2) * 0.6;
}

@inline
function fieldY(x: f32, y: f32, t: f32): f32 {
  return Mathf.cos(x * 0.0034 - t * 0.3) + Mathf.sin((x - y) * 0.0019 + t * 0.25) * 0.6;
}

export function init(n: i32, w: f32, h: f32, seed: u32): i32 {
  count = n > MAX ? MAX : (n < 0 ? 0 : n);
  width = w;
  height = h;
  time = 0;
  rng = seed == 0 ? 0x9e3779b9 : seed;
  for (let i: i32 = 0; i < count; i++) {
    const p = BUF + <usize>i * STRIDE;
    store<f32>(p, rand() * w);
    store<f32>(p + 4, rand() * h);
    store<f32>(p + 8, (rand() - 0.5) * 0.4);
    store<f32>(p + 12, (rand() - 0.5) * 0.4);
  }
  return count;
}

export function resize(w: f32, h: f32): void {
  const sx = w / width;
  const sy = h / height;
  for (let i: i32 = 0; i < count; i++) {
    const p = BUF + <usize>i * STRIDE;
    store<f32>(p, load<f32>(p) * sx);
    store<f32>(p + 4, load<f32>(p + 4) * sy);
  }
  width = w;
  height = h;
}

export function step(dt: f32, mx: f32, my: f32, active: i32, strength: f32): void {
  time += dt;
  const t = time;
  const w = width;
  const h = height;
  const radius: f32 = 180;
  const r2 = radius * radius;
  const damp: f32 = 0.985;
  const maxSpeed: f32 = 2.6;

  for (let i: i32 = 0; i < count; i++) {
    const p = BUF + <usize>i * STRIDE;
    let x = load<f32>(p);
    let y = load<f32>(p + 4);
    let vx = load<f32>(p + 8);
    let vy = load<f32>(p + 12);

    vx += fieldX(x, y, t) * 0.045 * dt;
    vy += fieldY(x, y, t) * 0.045 * dt;

    if (active != 0) {
      const dx = x - mx;
      const dy = y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2 && d2 > 1) {
        const d = Mathf.sqrt(d2);
        const f: f32 = (<f32>1.0 - d / radius) * strength * dt;
        vx += (dx / d) * f;
        vy += (dy / d) * f;
      }
    }

    vx *= damp;
    vy *= damp;
    const sp2 = vx * vx + vy * vy;
    if (sp2 > maxSpeed * maxSpeed) {
      const s = maxSpeed / Mathf.sqrt(sp2);
      vx *= s;
      vy *= s;
    }

    x += vx * dt;
    y += vy * dt;

    if (x < -4) x += w + 8;
    else if (x > w + 4) x -= w + 8;
    if (y < -4) y += h + 8;
    else if (y > h + 4) y -= h + 8;

    store<f32>(p, x);
    store<f32>(p + 4, y);
    store<f32>(p + 8, vx);
    store<f32>(p + 12, vy);
  }
}

export function ptr(): usize {
  return BUF;
}

export function size(): i32 {
  return count;
}

const IMG: i32 = 256;
const MAX_CELLS: i32 = 65536;
const CELL_STRIDE: usize = 8;
const SRC: usize = memory.data(IMG * IMG * 4);
const CELLS: usize = memory.data(MAX_CELLS * 8);

let cellCount: i32 = 0;

export function srcPtr(): usize {
  return SRC;
}

export function cellsPtr(): usize {
  return CELLS;
}

export function imgSize(): i32 {
  return IMG;
}

@inline
function emitCell(bx: i32, by: i32, b: i32, minAlpha: u32): void {
  let r: u32 = 0;
  let g: u32 = 0;
  let bl: u32 = 0;
  let a: u32 = 0;
  for (let y = by; y < by + b; y++) {
    let p = SRC + <usize>((y * IMG + bx) << 2);
    for (let x = 0; x < b; x++) {
      const pa = <u32>load<u8>(p + 3);
      r += <u32>load<u8>(p) * pa;
      g += <u32>load<u8>(p + 1) * pa;
      bl += <u32>load<u8>(p + 2) * pa;
      a += pa;
      p += 4;
    }
  }
  const n: u32 = <u32>(b * b);
  const avgA = a / n;
  if (avgA < minAlpha || a == 0 || cellCount >= MAX_CELLS) return;
  const c = CELLS + <usize>cellCount * CELL_STRIDE;
  store<u8>(c, <u8>bx);
  store<u8>(c + 1, <u8>by);
  store<u8>(c + 2, <u8>b);
  store<u8>(c + 3, <u8>(r / a));
  store<u8>(c + 4, <u8>(g / a));
  store<u8>(c + 5, <u8>(bl / a));
  store<u8>(c + 6, <u8>avgA);
  cellCount++;
}

export function pixelate(block: i32, fine: i32, mx: f32, my: f32, active: i32, radius: f32, minAlpha: i32): i32 {
  const coarse = block < 1 ? 1 : (block > IMG ? IMG : block);
  const inner = fine < 1 ? 1 : (fine > coarse ? coarse : fine);
  const r2 = radius * radius;
  const threshold = <u32>(minAlpha < 0 ? 0 : (minAlpha > 255 ? 255 : minAlpha));
  cellCount = 0;
  for (let by: i32 = 0; by < IMG; by += coarse) {
    for (let bx: i32 = 0; bx < IMG; bx += coarse) {
      let b = coarse;
      if (active != 0) {
        const cx = <f32>bx + <f32>coarse * 0.5 - mx;
        const cy = <f32>by + <f32>coarse * 0.5 - my;
        const d2 = cx * cx + cy * cy;
        if (d2 < r2) {
          const t = Mathf.sqrt(d2) / radius;
          let s = <i32>(<f32>inner + <f32>(coarse - inner) * t * t);
          let pow: i32 = inner;
          while (pow * 2 <= s) pow *= 2;
          b = pow > coarse ? coarse : pow;
        }
      }
      if (b == coarse) {
        emitCell(bx, by, coarse, threshold);
      } else {
        for (let sy = by; sy < by + coarse; sy += b) {
          for (let sx = bx; sx < bx + coarse; sx += b) {
            emitCell(sx, sy, b, threshold);
          }
        }
      }
    }
  }
  return cellCount;
}

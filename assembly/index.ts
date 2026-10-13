// Portrait pixelation, terrain generation and contour tracing for the survey map.

const IMG: i32 = 256;
const MAX_CELLS: i32 = 65536;
const CELL_STRIDE: usize = 8;
const SRC: usize = memory.data(IMG * IMG * 4);
const CELLS: usize = memory.data(MAX_CELLS * 8);

const HF_MAX: i32 = 65536;
const HF: usize = memory.data(HF_MAX * 4);
const TMP: usize = memory.data(HF_MAX * 4);
const RGBA: usize = memory.data(HF_MAX * 4);
const FACE: usize = memory.data(IMG * IMG * 4);
const FACE_A: usize = memory.data(IMG * IMG * 4);

const SEG_MAX: i32 = 65536;
const SEG: usize = memory.data(SEG_MAX * 16);
const LVL_MAX: i32 = 64;
const LVL: usize = memory.data((LVL_MAX + 1) * 4);

let cellCount: i32 = 0;
let hw: i32 = 0;
let hh: i32 = 0;
let segCount: i32 = 0;

export function srcPtr(): usize {
  return SRC;
}

export function cellsPtr(): usize {
  return CELLS;
}

export function heightPtr(): usize {
  return HF;
}

export function rgbaPtr(): usize {
  return RGBA;
}

export function segPtr(): usize {
  return SEG;
}

export function levelPtr(): usize {
  return LVL;
}

export function imgSize(): i32 {
  return IMG;
}

// ---------------------------------------------------------------------------
// Pixelation: block-average the portrait, with a finer lens around the pointer.

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

// ---------------------------------------------------------------------------
// Terrain: fractal value noise, normalised to 0..1.

@inline
function hash(x: i32, y: i32, seed: u32): f32 {
  let h: u32 = <u32>x * 374761393 + <u32>y * 668265263 + seed * 2246822519;
  h = (h ^ (h >> 13)) * 1274126177;
  h ^= h >> 16;
  return <f32>(h & 0xffffff) / 16777215.0;
}

@inline
function smooth(t: f32): f32 {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: f32, y: f32, seed: u32): f32 {
  const ix = <i32>Mathf.floor(x);
  const iy = <i32>Mathf.floor(y);
  const fx = smooth(x - <f32>ix);
  const fy = smooth(y - <f32>iy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

@inline
function hAt(x: i32, y: i32): f32 {
  return load<f32>(HF + <usize>((y * hw + x) << 2));
}

@inline
function hSet(x: i32, y: i32, v: f32): void {
  store<f32>(HF + <usize>((y * hw + x) << 2), v);
}

export function terrain(w: i32, h: i32, seed: u32, freq: f32): i32 {
  if (w * h > HF_MAX) return 0;
  hw = w;
  hh = h;
  let lo: f32 = 1e9;
  let hi: f32 = -1e9;
  for (let y: i32 = 0; y < h; y++) {
    for (let x: i32 = 0; x < w; x++) {
      let amp: f32 = 1;
      let f: f32 = freq;
      let sum: f32 = 0;
      for (let o: u32 = 0; o < 5; o++) {
        sum += valueNoise(<f32>x * f, <f32>y * f, seed + o * 101) * amp;
        amp *= 0.5;
        f *= 2.03;
      }
      hSet(x, y, sum);
      if (sum < lo) lo = sum;
      if (sum > hi) hi = sum;
    }
  }
  const span = hi - lo > 1e-6 ? hi - lo : <f32>1;
  for (let i: i32 = 0; i < w * h; i++) {
    const p = HF + <usize>(i << 2);
    store<f32>(p, (load<f32>(p) - lo) / span);
  }
  return w * h;
}

// ---------------------------------------------------------------------------
// Portrait height: alpha-weighted luminance, blurred, in image space.

function blurInto(src: usize, dst: usize, w: i32, h: i32, r: i32): void {
  // Horizontal pass into TMP, vertical pass into dst.
  for (let y: i32 = 0; y < h; y++) {
    for (let x: i32 = 0; x < w; x++) {
      let s: f32 = 0;
      let n: f32 = 0;
      for (let k: i32 = -r; k <= r; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= w) continue;
        s += load<f32>(src + <usize>((y * w + xx) << 2));
        n += 1;
      }
      store<f32>(TMP + <usize>((y * w + x) << 2), s / n);
    }
  }
  for (let y: i32 = 0; y < h; y++) {
    for (let x: i32 = 0; x < w; x++) {
      let s: f32 = 0;
      let n: f32 = 0;
      for (let k: i32 = -r; k <= r; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= h) continue;
        s += load<f32>(TMP + <usize>((yy * w + x) << 2));
        n += 1;
      }
      store<f32>(dst + <usize>((y * w + x) << 2), s / n);
    }
  }
}

// Fade toward the photo's crop edges so the bust settles into the land instead of ending in a cut.
export function cropFade(x: f32, y: f32): f32 {
  const size = <f32>IMG;
  const side = Mathf.min(x, size - 1 - x) / 22.0;
  const bottom = (size - 1 - y) / 56.0;
  let f = Mathf.min(side, bottom);
  f = f < 0 ? <f32>0 : (f > 1 ? <f32>1 : f);
  return smooth(f);
}

export function prepareFace(): void {
  for (let i: i32 = 0; i < IMG * IMG; i++) {
    const p = SRC + <usize>(i << 2);
    const a = <f32>load<u8>(p + 3) / 255.0 * cropFade(<f32>(i % IMG), <f32>(i / IMG));
    const lum = (<f32>load<u8>(p) * 0.2126 + <f32>load<u8>(p + 1) * 0.7152 + <f32>load<u8>(p + 2) * 0.0722) / 255.0;
    store<f32>(FACE + <usize>(i << 2), lum * a);
    store<f32>(FACE_A + <usize>(i << 2), a);
  }
  blurInto(FACE, FACE, IMG, IMG, 3);
  blurInto(FACE_A, FACE_A, IMG, IMG, 3);
}

@inline
function sampleFace(buf: usize, u: f32, v: f32): f32 {
  const x: f32 = u < 0 ? <f32>0 : (u > <f32>(IMG - 1) ? <f32>(IMG - 1) : u);
  const y: f32 = v < 0 ? <f32>0 : (v > <f32>(IMG - 1) ? <f32>(IMG - 1) : v);
  const ix = <i32>x;
  const iy = <i32>y;
  const ix1 = ix + 1 < IMG ? ix + 1 : ix;
  const iy1 = iy + 1 < IMG ? iy + 1 : iy;
  const fx = x - <f32>ix;
  const fy = y - <f32>iy;
  const a = load<f32>(buf + <usize>((iy * IMG + ix) << 2));
  const b = load<f32>(buf + <usize>((iy * IMG + ix1) << 2));
  const c = load<f32>(buf + <usize>((iy1 * IMG + ix) << 2));
  const d = load<f32>(buf + <usize>((iy1 * IMG + ix1) << 2));
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

// Flatten the terrain into a clearing around the portrait, then raise the face out of it.
export function stamp(x0: f32, y0: f32, size: f32, base: f32, relief: f32): void {
  const cx = x0 + size * 0.5;
  const cy = y0 + size * 0.5;
  const reach = size * 0.62;
  for (let y: i32 = 0; y < hh; y++) {
    for (let x: i32 = 0; x < hw; x++) {
      const dx = <f32>x - cx;
      const dy = <f32>y - cy;
      const d = Mathf.sqrt(dx * dx + dy * dy) / reach;
      let h = hAt(x, y);
      if (d < 1.4) {
        const t = d < 0.75 ? <f32>1 : smooth(<f32>1 - (d - 0.75) / 0.65);
        h = h + (base - 0.06 - h) * t * 0.55;
      }
      const u = (<f32>x - x0) / size * <f32>IMG;
      const v = (<f32>y - y0) / size * <f32>IMG;
      if (u > -2 && v > -2 && u < <f32>(IMG + 1) && v < <f32>(IMG + 1)) {
        const a = sampleFace(FACE_A, u, v);
        if (a > 0.001) {
          const lum = sampleFace(FACE, u, v) / a;
          const face = base + relief * lum;
          h = h + (face - h) * a;
        }
      }
      hSet(x, y, h);
    }
  }
}

// Sink a lake basin into the terrain, deepest at its centre.
export function basin(cx: f32, cy: f32, rx: f32, ry: f32, depth: f32): void {
  for (let y: i32 = 0; y < hh; y++) {
    for (let x: i32 = 0; x < hw; x++) {
      const dx = (<f32>x - cx) / rx;
      const dy = (<f32>y - cy) / ry;
      const d = Mathf.sqrt(dx * dx + dy * dy);
      if (d >= 1) continue;
      const t = smooth(<f32>1 - d);
      hSet(x, y, hAt(x, y) - depth * t);
    }
  }
}

// ---------------------------------------------------------------------------
// Contours: marching squares, segments grouped by level.

@inline
function lerpEdge(a: f32, b: f32, t: f32): f32 {
  const d = b - a;
  return d == 0 ? <f32>0.5 : (t - a) / d;
}

@inline
function pushSeg(x1: f32, y1: f32, x2: f32, y2: f32): void {
  if (segCount >= SEG_MAX) return;
  const p = SEG + <usize>(segCount << 4);
  store<f32>(p, x1);
  store<f32>(p + 4, y1);
  store<f32>(p + 8, x2);
  store<f32>(p + 12, y2);
  segCount++;
}

export function march(levels: i32, lo: f32, hi: f32): i32 {
  const n = levels > LVL_MAX ? LVL_MAX : levels;
  segCount = 0;
  for (let k: i32 = 0; k < n; k++) {
    store<i32>(LVL + <usize>(k << 2), segCount);
    const t = lo + (hi - lo) * <f32>(k + 1) / <f32>(n + 1);
    for (let y: i32 = 0; y < hh - 1; y++) {
      for (let x: i32 = 0; x < hw - 1; x++) {
        const a = hAt(x, y);
        const b = hAt(x + 1, y);
        const c = hAt(x + 1, y + 1);
        const d = hAt(x, y + 1);
        const idx = (a > t ? 1 : 0) | (b > t ? 2 : 0) | (c > t ? 4 : 0) | (d > t ? 8 : 0);
        if (idx == 0 || idx == 15) continue;
        const fx = <f32>x;
        const fy = <f32>y;
        // Edge crossing points: top, right, bottom, left.
        const tx = fx + lerpEdge(a, b, t);
        const ry = fy + lerpEdge(b, c, t);
        const bx = fx + lerpEdge(d, c, t);
        const ly = fy + lerpEdge(a, d, t);
        switch (idx) {
          case 1: case 14: pushSeg(fx, ly, tx, fy); break;
          case 2: case 13: pushSeg(tx, fy, fx + 1, ry); break;
          case 3: case 12: pushSeg(fx, ly, fx + 1, ry); break;
          case 4: case 11: pushSeg(fx + 1, ry, bx, fy + 1); break;
          case 6: case 9: pushSeg(tx, fy, bx, fy + 1); break;
          case 7: case 8: pushSeg(fx, ly, bx, fy + 1); break;
          case 5:
            pushSeg(fx, ly, tx, fy);
            pushSeg(fx + 1, ry, bx, fy + 1);
            break;
          case 10:
            pushSeg(tx, fy, fx + 1, ry);
            pushSeg(fx, ly, bx, fy + 1);
            break;
        }
      }
    }
  }
  store<i32>(LVL + <usize>(n << 2), segCount);
  return segCount;
}

// ---------------------------------------------------------------------------
// Paint: stepped hypsometric tint with northwest hillshade, as RGBA.

@inline
function mix(a: f32, b: f32, t: f32): f32 {
  return a + (b - a) * t;
}

export function paint(water: f32, step: f32): void {
  for (let y: i32 = 0; y < hh; y++) {
    for (let x: i32 = 0; x < hw; x++) {
      const h = hAt(x, y);
      const xl = x > 0 ? x - 1 : x;
      const xr = x < hw - 1 ? x + 1 : x;
      const yu = y > 0 ? y - 1 : y;
      const yd = y < hh - 1 ? y + 1 : y;
      const gx = hAt(xr, y) - hAt(xl, y);
      const gy = hAt(x, yd) - hAt(x, yu);
      // Light from the northwest; positive when the slope faces it.
      let shade = (-gx - gy) * 9.0;
      shade = shade < -1 ? -1 : (shade > 1 ? 1 : shade);

      let r: f32;
      let g: f32;
      let b: f32;
      if (h < water) {
        r = 201; g = 223; b = 240;
        shade *= 0.15;
      } else {
        const q = Mathf.floor((h - water) / step) * step / (<f32>1 - water);
        // Lowland forest green, through pale open ground, to bare high land.
        if (q < 0.45) {
          const t = q / 0.45;
          r = mix(207, 226, t); g = mix(225, 234, t); b = mix(184, 205, t);
        } else if (q < 0.75) {
          const t = (q - 0.45) / 0.3;
          r = mix(226, 238, t); g = mix(234, 233, t); b = mix(205, 214, t);
        } else {
          const t = (q - 0.75) / 0.25;
          r = mix(238, 246, t); g = mix(233, 243, t); b = mix(214, 234, t);
        }
      }
      const k: f32 = shade > 0 ? shade * 0.06 : shade * 0.14;
      r = r + (shade > 0 ? (255 - r) : r) * k;
      g = g + (shade > 0 ? (255 - g) : g) * k;
      b = b + (shade > 0 ? (255 - b) : b) * k;
      const p = RGBA + <usize>((y * hw + x) << 2);
      store<u8>(p, <u8>(r < 0 ? 0 : (r > 255 ? 255 : r)));
      store<u8>(p + 1, <u8>(g < 0 ? 0 : (g > 255 ? 255 : g)));
      store<u8>(p + 2, <u8>(b < 0 ? 0 : (b > 255 ? 255 : b)));
      store<u8>(p + 3, 255);
    }
  }
}

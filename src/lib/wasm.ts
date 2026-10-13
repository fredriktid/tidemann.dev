export interface SimExports {
  memory: WebAssembly.Memory;
  srcPtr(): number;
  cellsPtr(): number;
  heightPtr(): number;
  rgbaPtr(): number;
  segPtr(): number;
  levelPtr(): number;
  imgSize(): number;
  pixelate(
    block: number,
    fine: number,
    mx: number,
    my: number,
    active: number,
    radius: number,
    minAlpha: number,
  ): number;
  terrain(w: number, h: number, seed: number, freq: number): number;
  prepareFace(): void;
  cropFade(x: number, y: number): number;
  basin(cx: number, cy: number, rx: number, ry: number, depth: number): void;
  stamp(x0: number, y0: number, size: number, base: number, relief: number): void;
  march(levels: number, lo: number, hi: number): number;
  paint(water: number, step: number): void;
}

export interface Sim {
  exports: SimExports;
  imageSrc(): Uint8ClampedArray;
  cells(count: number): Uint8Array;
  heights(count: number): Float32Array;
  rgba(count: number): Uint8ClampedArray;
  segments(count: number): Float32Array;
  levels(count: number): Int32Array;
}

const cache = new Map<string, Promise<WebAssembly.Module>>();

function loadModule(url: string) {
  let pending = cache.get(url);
  if (!pending) {
    const request = fetch(url);
    pending =
      'compileStreaming' in WebAssembly
        ? WebAssembly.compileStreaming(request)
        : request.then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b));
    cache.set(url, pending);
  }
  return pending;
}

export async function loadSim(url = '/wasm/sim.wasm'): Promise<Sim> {
  const instance = await WebAssembly.instantiate(await loadModule(url), {});
  const exports = instance.exports as unknown as SimExports;
  const imgBytes = exports.imgSize() * exports.imgSize() * 4;
  const mem = () => exports.memory.buffer;
  return {
    exports,
    imageSrc: () => new Uint8ClampedArray(mem(), exports.srcPtr(), imgBytes),
    cells: (count) => new Uint8Array(mem(), exports.cellsPtr(), count * 8),
    heights: (count) => new Float32Array(mem(), exports.heightPtr(), count),
    rgba: (count) => new Uint8ClampedArray(mem(), exports.rgbaPtr(), count * 4),
    segments: (count) => new Float32Array(mem(), exports.segPtr(), count * 4),
    levels: (count) => new Int32Array(mem(), exports.levelPtr(), count + 1),
  };
}

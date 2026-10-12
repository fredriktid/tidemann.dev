export interface SimExports {
  memory: WebAssembly.Memory;
  init(n: number, w: number, h: number, seed: number): number;
  resize(w: number, h: number): void;
  step(dt: number, mx: number, my: number, active: number, strength: number): void;
  ptr(): number;
  size(): number;
  srcPtr(): number;
  cellsPtr(): number;
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
}

export interface Sim {
  exports: SimExports;
  particles(): Float32Array;
  imageSrc(): Uint8ClampedArray;
  cells(count: number): Uint8Array;
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
  let view: Float32Array | null = null;
  let buffer: ArrayBuffer | null = null;
  const imgBytes = exports.imgSize() * exports.imgSize() * 4;
  return {
    exports,
    particles() {
      if (!view || buffer !== exports.memory.buffer) {
        buffer = exports.memory.buffer;
        view = new Float32Array(buffer, exports.ptr(), exports.size() * 4);
      }
      return view;
    },
    imageSrc() {
      return new Uint8ClampedArray(exports.memory.buffer, exports.srcPtr(), imgBytes);
    },
    cells(count) {
      return new Uint8Array(exports.memory.buffer, exports.cellsPtr(), count * 8);
    },
  };
}

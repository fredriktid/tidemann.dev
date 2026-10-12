# tidemann.dev

Source for [tidemann.dev](https://tidemann.dev).

## Running it

```sh
pnpm install
pnpm dev
```

Both `pnpm dev` and `pnpm build` compile `assembly/index.ts` to `public/wasm/sim.wasm` first, so there's nothing extra to run.

## Layout

- `src/content/` – all the text on the page: intro, timeline, projects
- `assembly/index.ts` – the particle simulation and the block-average pixelation, written in AssemblyScript
- `src/components/ParticleField.vue` – draws the simulation on a canvas
- `src/components/PixelPortrait.vue` – the portrait, rendered as tiles from the wasm output
- `public/avatar.png` – the portrait the tiles are built from
- `public/logos/` – client logos

Static output ends up in `dist/`.

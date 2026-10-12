import { routes, type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'astro',
  buildCommand: 'pnpm build',
  outputDirectory: 'dist',
  headers: [
    routes.cacheControl('/_astro/(.*)', { public: true, maxAge: '1 year', immutable: true }),
    routes.cacheControl('/wasm/(.*)', { public: true, maxAge: '1 day', sMaxAge: '1 year', staleWhileRevalidate: '1 year' }),
    routes.header('/wasm/(.*)', [{ key: 'content-type', value: 'application/wasm' }]),
  ],
};

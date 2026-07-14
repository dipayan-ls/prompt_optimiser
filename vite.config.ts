import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// NOTE: there is deliberately no `define` block here.
// `define` is a literal text substitution performed at build time, so anything
// routed through it is embedded verbatim in the public JS bundle. Secrets must
// never go through it. Only VITE_-prefixed vars reach the client, via
// import.meta.env, and those are public by definition — see .env.example.
export default defineConfig({
  base: '/prompt_optimiser/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // Proxy the optimize endpoint to a locally running Worker (`npm run worker`)
    // so local dev exercises the same same-origin path as production.
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});

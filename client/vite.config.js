import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const clientRoot = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: clientRoot,
  build: { outDir: 'dist' },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { host: '127.0.0.1', port: 4173, proxy: { '/api': 'http://127.0.0.1:3001' } }
});

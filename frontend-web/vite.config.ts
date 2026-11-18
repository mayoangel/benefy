import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const unified = process.env.BENEFY_UNIFIED_ENV === '1';
const backend = process.env.VITE_BACKEND_PROXY || 'http://127.0.0.1:8001';

export default defineConfig({
  plugins: [react()],
  // El launcher suministra las variables públicas; no mezclar otros .env.
  envDir: unified ? false : undefined,
  cacheDir: unified ? '/tmp/benefy-vite' : undefined,
  server: unified ? {
    strictPort: true,
    watch: { usePolling: true, interval: 300 },
    proxy: Object.fromEntries(['/api', '/health', '/admin', '/static'].map(path => [path, { target: backend }])),
  } : undefined,
});

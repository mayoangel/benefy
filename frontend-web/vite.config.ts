import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const docker = process.env.BENEFY_DOCKER_ENV === '1';
const backend = process.env.VITE_BACKEND_PROXY || 'http://127.0.0.1:8001';

export default defineConfig({
  plugins: [react()],
  // El launcher suministra las variables públicas; no mezclar otros .env.
  envDir: docker ? false : undefined,
  cacheDir: docker ? '/tmp/benefy-vite' : undefined,
  server: docker ? {
    strictPort: true,
    watch: { usePolling: true, interval: 300 },
    proxy: Object.fromEntries(['/api', '/health', '/admin', '/static'].map(path => [path, { target: backend }])),
  } : undefined,
});

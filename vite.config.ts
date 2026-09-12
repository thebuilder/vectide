import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [cloudflare()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('three/examples/')) return 'effects';
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});

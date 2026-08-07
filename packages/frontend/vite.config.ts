import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend (PWA) — ポート 51730 (要件 #1 §2.6)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 51730,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:30010',
        changeOrigin: true,
      },
    },
  },
});

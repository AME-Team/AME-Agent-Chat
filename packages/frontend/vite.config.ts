import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Frontend (PWA) — ポート 51730 (要件 #1 §2.6)
export default defineConfig({
  plugins: [
    react(),
    // インストール可能な PWA + 独立ネイティブウィンドウ (要件 #1 §3.1.6, Issue #66)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'AME Agent Chat',
        short_name: 'AME Chat',
        description: 'AI Agent (OpenCode) のリッチなチャット UI',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#005B99',
        lang: 'ja',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
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

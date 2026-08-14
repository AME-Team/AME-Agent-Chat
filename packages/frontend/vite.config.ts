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
    // 配信ドメイン (ame-agent-chat.tamtarminworldjapan.win) 経由で dev サーバへアクセスするため、
    // Vite の host ガード (DNS リバインディング対策) を通過できるよう許可リストへ追加する。
    // ドメイン変更時はここも同時に更新すること (更新しないとアクセスが 403 で遮断される)。
    allowedHosts: ['ame-agent-chat.tamtarminworldjapan.win'],
    proxy: {
      '/api': {
        target: 'http://localhost:30010',
        changeOrigin: true,
      },
    },
  },
});

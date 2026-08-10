import { defineConfig } from 'vitepress';

const base = '/AME-Agent-Chat/';

const jaGuide = [
  { text: 'はじめに', link: '/guide/getting-started' },
  { text: 'インストール', link: '/guide/installation' },
  { text: 'クイックスタート', link: '/guide/quickstart' },
  { text: 'チャット機能', link: '/guide/chat' },
  { text: 'セッション管理', link: '/guide/sessions' },
  { text: 'スラッシュコマンド', link: '/guide/commands' },
  { text: '承認フロー', link: '/guide/approvals' },
  { text: '設定（モデル・Tier）', link: '/guide/settings' },
  { text: '便利な機能と Tips', link: '/guide/tips' },
];

const jaArchitecture = [
  { text: 'アーキテクチャ概要', link: '/architecture/overview' },
  { text: 'フロントエンド', link: '/architecture/frontend' },
  { text: 'Agent Core（BFF）', link: '/architecture/agent-core' },
  { text: 'Gatekeeper', link: '/architecture/gatekeeper' },
  { text: 'Docker 構成', link: '/architecture/docker' },
  { text: 'セキュリティ', link: '/architecture/security' },
];

const jaReference = [
  { text: '設定リファレンス', link: '/reference/configuration' },
  { text: 'API リファレンス', link: '/reference/api' },
  { text: 'ポート一覧', link: '/reference/ports' },
];

const enGuide = [
  { text: 'Getting Started', link: '/en/guide/getting-started' },
  { text: 'Installation', link: '/en/guide/installation' },
  { text: 'Quickstart', link: '/en/guide/quickstart' },
  { text: 'Chat Features', link: '/en/guide/chat' },
  { text: 'Session Management', link: '/en/guide/sessions' },
  { text: 'Slash Commands', link: '/en/guide/commands' },
  { text: 'Approval Flow', link: '/en/guide/approvals' },
  { text: 'Settings (Models & Tiers)', link: '/en/guide/settings' },
  { text: 'Tips & Tricks', link: '/en/guide/tips' },
];

const enArchitecture = [
  { text: 'Architecture Overview', link: '/en/architecture/overview' },
  { text: 'Frontend', link: '/en/architecture/frontend' },
  { text: 'Agent Core (BFF)', link: '/en/architecture/agent-core' },
  { text: 'Gatekeeper', link: '/en/architecture/gatekeeper' },
  { text: 'Docker Setup', link: '/en/architecture/docker' },
  { text: 'Security', link: '/en/architecture/security' },
];

const enReference = [
  { text: 'Configuration Reference', link: '/en/reference/configuration' },
  { text: 'API Reference', link: '/en/reference/api' },
  { text: 'Ports', link: '/en/reference/ports' },
];

const googleFontsStylesheet =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans:wght@400;500;700&family=Noto+Serif+JP:wght@400;700&family=Noto+Serif:wght@400;700&family=Noto+Sans+Mono:wght@400;500;700&display=swap';

export default defineConfig({
  base,
  lang: 'ja',
  title: 'AME Agent Chat',
  description:
    'OpenCode（AI エージェント）をリッチな UI で安全・低コスト運用するローカル開発環境のドキュメント',
  cleanUrls: true,
  ignoreDeadLinks: [(link) => link.startsWith('http://localhost:')],
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: googleFontsStylesheet }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { name: 'theme-color', content: '#005B99' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'AME Agent Chat' }],
  ],
  locales: {
    root: {
      label: '日本語',
      lang: 'ja',
      title: 'AME Agent Chat',
      description:
        'OpenCode（AI エージェント）をリッチな UI で安全・低コスト運用するローカル開発環境のドキュメント',
      themeConfig: {
        langMenuLabel: '言語',
        darkModeSwitchLabel: 'テーマ',
        darkModeSwitchTitle: 'ダークモードに切替',
        lightModeSwitchTitle: 'ライトモードに切替',
        sidebarMenuLabel: 'メニュー',
        returnToTopLabel: 'トップへ戻る',
        docFooter: { prev: '前のページ', next: '次のページ' },
        outline: { label: 'このページ', level: [2, 3] },
        nav: [
          { text: 'ガイド', link: '/guide/getting-started', activeMatch: '/guide/' },
          { text: 'アーキテクチャ', link: '/architecture/overview', activeMatch: '/architecture/' },
          { text: 'リファレンス', link: '/reference/configuration', activeMatch: '/reference/' },
        ],
        sidebar: {
          '/guide/': [{ text: 'ガイド', items: jaGuide }],
          '/architecture/': [{ text: 'アーキテクチャ', items: jaArchitecture }],
          '/reference/': [{ text: 'リファレンス', items: jaReference }],
        },
        socialLinks: [{ icon: 'github', link: 'https://github.com/tarminjapan/AME-Agent-Chat' }],
        footer: {
          message: 'Windows / Linux / macOS 対応ローカル開発環境',
          copyright: 'Copyright © 2026 AME Agent Chat',
        },
        search: {
          provider: 'local',
          options: {
            translations: {
              button: { buttonText: '検索', buttonAriaLabel: '検索' },
              modal: {
                noResultsText: '検索結果がありません',
                resetButtonTitle: 'クリア',
                footer: {
                  selectText: '選択',
                  navigateText: '移動',
                  closeText: '閉じる',
                },
              },
            },
          },
        },
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      title: 'AME Agent Chat',
      description:
        'Documentation for the local development environment that runs the OpenCode AI agent behind a rich, safe and low-cost UI',
      themeConfig: {
        langMenuLabel: 'Language',
        darkModeSwitchLabel: 'Theme',
        darkModeSwitchTitle: 'Switch to dark theme',
        lightModeSwitchTitle: 'Switch to light theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Back to top',
        docFooter: { prev: 'Previous page', next: 'Next page' },
        outline: { label: 'On this page', level: [2, 3] },
        nav: [
          { text: 'Guide', link: '/en/guide/getting-started', activeMatch: '/en/guide/' },
          {
            text: 'Architecture',
            link: '/en/architecture/overview',
            activeMatch: '/en/architecture/',
          },
          { text: 'Reference', link: '/en/reference/configuration', activeMatch: '/en/reference/' },
        ],
        sidebar: {
          '/en/guide/': [{ text: 'Guide', items: enGuide }],
          '/en/architecture/': [{ text: 'Architecture', items: enArchitecture }],
          '/en/reference/': [{ text: 'Reference', items: enReference }],
        },
        socialLinks: [{ icon: 'github', link: 'https://github.com/tarminjapan/AME-Agent-Chat' }],
        footer: {
          message: 'A cross-platform local development environment for AI coding agents',
          copyright: 'Copyright © 2026 AME Agent Chat',
        },
        search: {
          provider: 'local',
          options: {
            translations: {
              button: { buttonText: 'Search', buttonAriaLabel: 'Search' },
              modal: {
                noResultsText: 'No results found',
                resetButtonTitle: 'Clear',
                footer: {
                  selectText: 'to select',
                  navigateText: 'to navigate',
                  closeText: 'to close',
                },
              },
            },
          },
        },
      },
    },
  },
});

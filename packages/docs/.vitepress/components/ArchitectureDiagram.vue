<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ variant?: 'ja' | 'en' }>();

const common = {
  hostOs: 'HOST OS',
  container: 'CONTAINER',
  browser: 'Browser',
  frontendTitle: 'Frontend',
  frontendSub: 'React PWA',
  frontendPort: '51730',
  proxyLabel: 'Vite proxy /api → :30010',
  sseLabel: 'EventSource /api/events (SSE)',
  gatekeeperTitle: 'Gatekeeper',
  gatekeeperSub: 'Hono + SQLite',
  gatekeeperPort: '58780',
  agentCoreTitle: 'Agent Core',
  agentCoreSub: 'Hono BFF',
  agentCorePort: '30010',
  opencodeTitle: 'OpenCode Server',
  opencodeSub: 'opencode serve',
  opencodePort: '40960',
};

const localized = {
  ja: {
    gatekeeperItems: [
      'ポリシー判定（classify）',
      'セッション / メッセージ / 設定の永続化',
      '承認監査ログ・トークン使用量',
    ],
    httpLabel: 'HTTP（設定 / 使用量 / 承認 / 検索）',
    hostLinkLabel: 'host.docker.internal:58780（コンテナ）/ :58780（dev）',
    published: '公開ポート',
    agentCoreItems: [
      'LLM ルーター（regex でティア判定）',
      '@opencode-ai/sdk',
      'SSE プロキシ（/api/events）',
    ],
    opencodeLabel: 'HTTP（localhost:40960）',
    private: '非公開',
    workspaceLabel: 'ワークスペース（/workspace bind mount）で実行',
  },
  en: {
    gatekeeperItems: [
      'policy classification (classify)',
      'session / message / settings persistence',
      'approval audit log · token usage',
    ],
    httpLabel: 'HTTP (settings / usage / approvals / search)',
    hostLinkLabel: 'host.docker.internal:58780 (container) / :58780 (dev)',
    published: 'published port',
    agentCoreItems: [
      'LLM router (regex tier classification)',
      '@opencode-ai/sdk',
      'SSE proxy (/api/events)',
    ],
    opencodeLabel: 'HTTP (localhost:40960)',
    private: 'private',
    workspaceLabel: 'runs on the workspace (/workspace bind mount)',
  },
} as const;

const t = computed(() => ({ ...common, ...localized[props.variant ?? 'ja'] }));
</script>

<template>
  <figure class="arch-diagram">
    <!-- HOST OS -->
    <section class="zone">
      <p class="zone-header">{{ t.hostOs }}</p>
      <div class="zone-body">
        <div class="flow-row">
          <div class="node node-slim">
            <span class="node-title">{{ t.browser }}</span>
          </div>
          <svg class="h-arrow" viewBox="0 0 40 12" width="40" height="12" aria-hidden="true">
            <line x1="0" y1="6" x2="34" y2="6" stroke="currentColor" stroke-width="2" />
            <path d="M40 6 L32 2.5 L32 9.5 Z" fill="currentColor" />
          </svg>
          <div class="node node-frontend">
            <div class="node-title-line">
              <span class="node-title">{{ t.frontendTitle }}</span>
              <span class="port-badge">:{{ t.frontendPort }}</span>
            </div>
            <span class="node-sub">{{ t.frontendSub }}</span>
            <ul class="node-items node-items--links">
              <li>{{ t.proxyLabel }}</li>
              <li>{{ t.sseLabel }}</li>
            </ul>
          </div>
        </div>

        <div class="conn">
          <span class="conn-line"></span>
          <svg class="conn-arrow" viewBox="0 0 12 7" width="12" height="7" aria-hidden="true">
            <path d="M0 0 L6 7 L12 0 Z" fill="currentColor" />
          </svg>
        </div>

        <div class="node node-gatekeeper">
          <div class="node-title-line">
            <span class="node-title">{{ t.gatekeeperTitle }}</span>
            <span class="port-badge">:{{ t.gatekeeperPort }}</span>
          </div>
          <span class="node-sub">{{ t.gatekeeperSub }}</span>
          <ul class="node-items">
            <li v-for="item in t.gatekeeperItems" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="conn conn--labeled">
          <span class="conn-line"></span>
          <svg class="conn-arrow" viewBox="0 0 12 7" width="12" height="7" aria-hidden="true">
            <path d="M0 7 L6 0 L12 7 Z" fill="currentColor" />
          </svg>
          <span class="conn-label">{{ t.httpLabel }}</span>
        </div>
      </div>
    </section>

    <!-- HOST ⇄ CONTAINER -->
    <div class="cross-conn">
      <span class="conn-line"></span>
      <svg class="conn-arrow" viewBox="0 0 12 7" width="12" height="7" aria-hidden="true">
        <path d="M0 0 L6 7 L12 0 Z" fill="currentColor" />
      </svg>
      <span class="cross-label">{{ t.hostLinkLabel }}</span>
    </div>

    <!-- CONTAINER -->
    <section class="zone">
      <p class="zone-header">{{ t.container }}</p>
      <div class="zone-body">
        <div class="node node-agent">
          <div class="node-title-line">
            <span class="node-title">{{ t.agentCoreTitle }}</span>
            <span class="port-badge">:{{ t.agentCorePort }}</span>
            <span class="tag">{{ t.published }}</span>
          </div>
          <span class="node-sub">{{ t.agentCoreSub }}</span>
          <ul class="node-items">
            <li v-for="item in t.agentCoreItems" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="conn conn--labeled">
          <span class="conn-line"></span>
          <svg class="conn-arrow" viewBox="0 0 12 7" width="12" height="7" aria-hidden="true">
            <path d="M0 0 L6 7 L12 0 Z" fill="currentColor" />
          </svg>
          <span class="conn-label">{{ t.opencodeLabel }}</span>
        </div>

        <div class="node node-opencode">
          <div class="node-title-line">
            <span class="node-title">{{ t.opencodeTitle }}</span>
            <span class="port-badge">:{{ t.opencodePort }}</span>
            <span class="tag">{{ t.private }}</span>
          </div>
          <span class="node-sub">{{ t.opencodeSub }}</span>
          <p class="node-detail">{{ t.workspaceLabel }}</p>
        </div>
      </div>
    </section>
  </figure>
</template>

<style scoped>
.arch-diagram {
  display: flex;
  flex-direction: column;
  margin: 24px 0;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.zone {
  border: 1px dashed var(--vp-c-border-hard);
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  padding: 16px;
}

.zone-header {
  margin: 0 0 16px;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--vp-c-brand-1);
}

.zone-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.flow-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.node {
  border: 1px solid var(--vp-c-border-hard);
  border-radius: 8px;
  background: var(--vp-c-bg);
  padding: 12px 16px;
  min-width: 0;
}

.node-slim {
  padding: 8px 16px;
}

.node-frontend,
.node-gatekeeper,
.node-agent,
.node-opencode {
  flex: 1 1 240px;
  max-width: 360px;
}

.node-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.node-title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.node-sub {
  display: block;
  margin-top: 2px;
  font-size: 0.8125rem;
}

.port-badge {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-radius: 6px;
  padding: 1px 6px;
}

.tag {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 6px;
  padding: 1px 6px;
}

.node-items {
  margin: 8px 0 0;
  padding-left: 20px;
  display: grid;
  gap: 2px;
  font-size: 0.8125rem;
}

.node-detail {
  margin: 8px 0 0;
  font-size: 0.8125rem;
}

.node-items--links {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
}

.h-arrow {
  color: var(--vp-c-brand-2);
  flex-shrink: 0;
}

.conn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.conn-line {
  width: 2px;
  min-height: 24px;
  background: var(--vp-c-brand-2);
}

.conn-arrow {
  color: var(--vp-c-brand-2);
}

.conn--labeled {
  position: relative;
}

.conn-label {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  text-align: center;
}

.cross-conn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 0;
}

.cross-label {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  text-align: center;
  max-width: 100%;
}
</style>

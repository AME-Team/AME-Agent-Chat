<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ variant?: 'ja' | 'en' }>();

const common = {
  browser: 'Browser',
  frontend: 'Frontend',
  frontendSub: 'React PWA · :51730',
  agentCore: 'Agent Core',
  agentCoreSub: 'BFF · :30010',
  opencode: 'OpenCode Server',
  opencodeSub: ':40960',
  gatekeeper: 'Gatekeeper',
  gatekeeperSub: 'Hono + SQLite · :58780',
};

const sseLabel: Record<'ja' | 'en', string> = {
  ja: 'SSE（EventSource /api/events）',
  en: 'SSE (EventSource /api/events)',
};

const t = computed(() => ({ ...common, sse: sseLabel[props.variant ?? 'ja'] }));
</script>

<template>
  <figure class="system-diagram">
    <div class="top">
      <span class="node">{{ t.browser }}</span>
      <svg class="arrow-h" viewBox="0 0 40 12" width="40" height="12" aria-hidden="true">
        <line x1="0" y1="6" x2="34" y2="6" stroke="currentColor" stroke-width="2" />
        <path d="M40 6 L32 2.5 L32 9.5 Z" fill="currentColor" />
      </svg>
      <span class="node">
        <span class="node-title">{{ t.frontend }}</span>
        <span class="node-sub">{{ t.frontendSub }}</span>
      </span>
    </div>

    <span class="crossbar"></span>

    <div class="split">
      <div class="col">
        <svg class="arrow-v" viewBox="0 0 12 7" width="12" height="7" aria-hidden="true">
          <path d="M0 0 L6 7 L12 0 Z" fill="currentColor" />
        </svg>
        <span class="node">
          <span class="node-title">{{ t.agentCore }}</span>
          <span class="node-sub">{{ t.agentCoreSub }}</span>
        </span>

        <span class="crossbar crossbar--narrow"></span>

        <div class="split split--nested">
          <div class="col">
            <svg class="arrow-v" viewBox="0 0 12 7" width="12" height="7" aria-hidden="true">
              <path d="M0 0 L6 7 L12 0 Z" fill="currentColor" />
            </svg>
            <span class="node">
              <span class="node-title">{{ t.opencode }}</span>
              <span class="node-sub">{{ t.opencodeSub }}</span>
            </span>
          </div>
          <div class="col">
            <svg class="arrow-v" viewBox="0 0 12 7" width="12" height="7" aria-hidden="true">
              <path d="M0 0 L6 7 L12 0 Z" fill="currentColor" />
            </svg>
            <span class="node">
              <span class="node-title">{{ t.gatekeeper }}</span>
              <span class="node-sub">{{ t.gatekeeperSub }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="col">
        <svg class="arrow-v" viewBox="0 0 12 7" width="12" height="7" aria-hidden="true">
          <path d="M0 0 L6 7 L12 0 Z" fill="currentColor" />
        </svg>
        <span class="node">
          <span class="node-title">{{ t.sse }}</span>
        </span>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.system-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 24px 0;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  gap: 0;
}

.top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.arrow-h {
  color: var(--vp-c-brand-2);
  flex-shrink: 0;
}

.arrow-v {
  color: var(--vp-c-brand-2);
  margin: 8px 0 0;
}

.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 160px;
  padding: 8px 16px;
  border: 1px solid var(--vp-c-border-hard);
  border-radius: 8px;
  background: var(--vp-c-bg);
  text-align: center;
}

.node-title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.node-sub {
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-3);
}

.crossbar {
  display: block;
  width: 50%;
  height: 2px;
  margin: 8px 0 0;
  background: var(--vp-c-brand-2);
}

.crossbar--narrow {
  width: 40%;
}

.split {
  display: flex;
  justify-content: space-evenly;
  gap: 24px;
  width: 100%;
}

.split--nested {
  justify-content: center;
}

.col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
</style>

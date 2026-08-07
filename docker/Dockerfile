# AME Agent Chat — All-in-One コンテナ (要件 #1 §2.4, §3.3.1)
# S1 では Node のみ。将来フェーズで Python/C#/Go/C++ を追加 (要件 #3.3.1)。
# Agent Core (30010) と OpenCode Server (40960) を同一コンテナ内で同居起動 (要件 #1 §2.4)。

FROM node:24-bookworm-slim

# supervisord でプロセス同居管理 (要件 #1 §2.4) + 動作確認用 curl
RUN apt-get update \
    && apt-get install -y --no-install-recommends supervisor curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 非 root ユーザで実行 (要件 #1 §4.1 権限最小化)
USER node
ENV NODE_ENV=development
WORKDIR /app

# pnpm 有効化 (packageManager フィールドと同一版本)
RUN corepack enable pnpm && corepack prepare pnpm@11.20.0 --activate

# OpenCode (AI Agent) をユーザ環境へ導入 + postinstall
RUN npm install -g opencode-ai@1.18.14 \
    && cd "$(npm root -g)/opencode-ai" && node ./postinstall.mjs

# アプリケーション (ワークスペース全体をコピーして agent-core 起動に必要な依存を導入)
COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY --chown=node:node packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter @ame-agent-chat/agent-core...

# bind mount 先 (ホストワークスペース) — 要件 #1 §2.4
RUN mkdir -p /workspace
WORKDIR /workspace

ENV PORT=30010 \
    OPENCODE_BASE_URL=http://localhost:40960 \
    GATEKEEPER_URL=http://host.docker.internal:87880 \
    CORS_ORIGIN=http://localhost:51730

EXPOSE 30010

# supervisord で opencode serve (40960) + agent-core (30010) を同居起動
COPY --chown=node:node docker/supervisord.conf /etc/supervisor/conf.d/ame.conf
CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:30010/health || exit 1

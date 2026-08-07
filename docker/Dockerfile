# AME Agent Chat — All-in-One コンテナ (要件 #1 §2.4, §3.3.1)
# S1 では Node のみ。将来フェーズで Python/C#/Go/C++ を追加 (要件 #3.3.1)。
# Agent Core (30010) と OpenCode Server (40960) を同一コンンテナ内で同居起動 (要件 #1 §2.4)。

FROM node:24-bookworm-slim

# === root 権限でシステム/グローバルツールを導入 ===
RUN apt-get update \
    && apt-get install -y --no-install-recommends supervisor curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# packageManager フィールドから pnpm バージョンを決定(ハードコード回避)
COPY package.json /tmp/pkg.json
RUN corepack enable pnpm \
    && corepack prepare "$(node -p "require('/tmp/pkg.json').packageManager")" --activate

RUN npm install -g opencode-ai@1.18.14 \
    && cd "$(npm root -g)/opencode-ai" && node ./postinstall.mjs

# 自己完結型 supervisord 設定を配置(Debian 既定 config に依存しない)
COPY docker/supervisord.conf /etc/supervisor/ame-supervisord.conf

# === 非 root ユーザでアプリ配置・実行 (要件 #1 §4.1 権限最小化) ===
USER node
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY --chown=node:node packages/ ./packages/
# S1 は tsx による直接実行(ビルド工程なし)。devDeps も導入されるため tsx 利用可。
RUN pnpm install --frozen-lockfile --filter @ame-agent-chat/agent-core...

# bind mount 先 (ホストワークスペース) — 要件 #1 §2.4
RUN mkdir -p /workspace
WORKDIR /workspace

ENV PORT=30010 \
    HOST=0.0.0.0 \
    OPENCODE_BASE_URL=http://localhost:40960 \
    GATEKEEPER_URL=http://host.docker.internal:87880 \
    CORS_ORIGIN=http://localhost:51730

EXPOSE 30010

# supervisord で opencode serve (40960) + agent-core (30010) を同居起動
CMD ["supervisord", "-n", "-c", "/etc/supervisor/ame-supervisord.conf"]

# ヘルスチェックは Dockerfile に一本化 (compose 側で重複定義しない)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:30010/health || exit 1

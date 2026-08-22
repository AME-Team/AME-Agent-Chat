# Installation

## Prerequisites

The following environment is required to run AME Agent Chat.

| Requirement | Spec                                                             |
| ----------- | ---------------------------------------------------------------- |
| OS          | Windows 10/11, macOS, Linux (major distributions)                |
| Node.js     | **24 or later** (check with `node -v`)                           |
| pnpm        | **11.20.0 or later** (matches the repository's `packageManager`) |
| Docker      | Required when using the Docker container setup (`pnpm start`)    |

### Check Node.js and pnpm

```bash
node -v
# v24.x.x or later is required

pnpm -v
# 11.20.0 or later is required
```

If pnpm is not installed, install it with:

```bash
npm install -g pnpm
```

::: tip
The recommended Node.js version is listed in the `.nvmrc` file. If you use `nvm`, run `nvm use` to match it.
:::

## Installing from a release package (GitHub Releases)

If you just want to download and use the app, the GitHub release archive is the easiest path.

1. Open the [Releases](https://github.com/tarminjapan/AME-Agent-Chat/releases) page and download the
   **source archive** for the version you want (`ame-agent-chat-<version>.zip` or `.tar.gz`).
   - Version tags use the `v1.2.3` format. The latest release is listed first.
2. Extract the downloaded archive.
3. Install dependencies and start from the extracted directory.

::: code-group

```bash [zip]
unzip ame-agent-chat-1.2.3.zip
cd ame-agent-chat-1.2.3
pnpm install
pnpm start
```

```bash [tar.gz]
tar -xzf ame-agent-chat-1.2.3.tar.gz
cd ame-agent-chat-1.2.3
pnpm install
pnpm start
```

:::

::: tip

- The archive bundles the full source plus `pnpm-lock.yaml`, so dependencies install reproducibly.
- `pnpm start` (one-command start) requires Docker. If you do not use Docker, use `pnpm dev` (host-based) instead.
- See [Quickstart](/en/guide/quickstart) for the launch details.
- For developers, the git clone approach is described in [Cloning the repository](#cloning-the-repository).
  :::

### Starting from the Docker image (GHCR)

On each release a Docker image is also published to `ghcr.io/tarminjapan/AME-Agent-Chat`. To run the
Agent Core + OpenCode stack in a container, reference a tag with `docker compose`.

## Cloning the repository (for developers)

```bash
git clone https://github.com/tarminjapan/AME-Agent-Chat.git
cd AME-Agent-Chat
```

## Install dependencies

```bash
pnpm install
```

All dependencies for the monorepo packages (frontend / agent-core / gatekeeper / shared / docs) are installed at once.

## Choosing how to run

After setup, choose one of two ways to run, depending on your use case.

- **Local development mode**: `pnpm dev` — runs all packages on the host in parallel ([Quickstart](/en/guide/quickstart))
- **One-command start**: `pnpm start` — starts the Docker container (Agent Core + OpenCode), Gatekeeper and Frontend together

See [Quickstart](/en/guide/quickstart) for the full steps.

## Verifying the setup

### Build and static checks

```bash
pnpm typecheck    # Type-check all packages
pnpm lint         # ESLint
pnpm format:check # Prettier check
pnpm build        # Build all packages
```

### Quality gates (for developers)

This repository ships an AI review system (Dual-Gate).

- **Gate 1**: static analysis, secret scanning and AI review run on every pre-commit
- **Gate 2**: posting `/request-review` on a PR triggers an AI review

See `AGENTS.md` and `.ame-review/` in the repository for details.

## Troubleshooting

### `pnpm install` fails

- Make sure Node.js is 24 or later.
- Align the pnpm version to `11.20.0` or later (`corepack enable` also helps).

### Docker is not found

- Start Docker Desktop (Windows / macOS) or the Docker Engine (Linux).
- If you do not use the container setup, you can use `pnpm dev` (host-based) instead.

### Port conflicts

- If the default ports (see [Ports](/en/reference/ports)) are in use, stop the conflicting processes or change them via environment variables.

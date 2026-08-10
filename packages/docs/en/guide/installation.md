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

## Clone the repository

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

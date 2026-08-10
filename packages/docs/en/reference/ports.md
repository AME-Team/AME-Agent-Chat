# Ports

The ports used by each component.

## Overview

| Component          | Port      | Scope                             | Description                             |
| ------------------ | --------- | --------------------------------- | --------------------------------------- |
| Frontend (PWA)     | **51730** | Host                              | Chat UI                                 |
| Agent Core (BFF)   | **30010** | Host or container (published)     | REST / SSE relay                        |
| OpenCode Server    | **40960** | Container-internal only (private) | AI agent                                |
| Gatekeeper         | **58780** | Host                              | Policy and persistence                  |
| Docs (development) | **51740** | Host                              | This documentation site (VitePress dev) |

::: tip
The original requirement document listed `87880` for Gatekeeper, but that exceeds the TCP port limit (65535), so it was corrected to `58780`.
:::

## Per execution mode

| Mode                  | Frontend   | Gatekeeper | Agent Core                  | OpenCode                  |
| --------------------- | ---------- | ---------- | --------------------------- | ------------------------- |
| `pnpm dev`            | host 51730 | host 58780 | host 30010                  | host 40960 (auto-start)   |
| `pnpm start` (Docker) | host 51730 | host 58780 | container 30010 (published) | container 40960 (private) |

## Communication paths

- **Browser → Frontend → Agent Core**: Vite proxy / SSE (`/api`)
- **Agent Core → OpenCode**: `http://localhost:40960` (same host or same container)
- **Agent Core → Gatekeeper**: `http://localhost:58780` (dev) or `http://host.docker.internal:58780` (container)
- **OpenCode → Gatekeeper**: no direct communication (via Agent Core)

## Handling port conflicts

If a port is in use, you can work around it in the following ways.

- Identify and stop the process using the port
- Change the port of each service with environment variables (e.g. `PORT`)
- After changing, also update the CORS origin (`CORS_ORIGIN`) and proxy settings accordingly

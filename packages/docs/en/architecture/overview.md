# Architecture Overview

AME Agent Chat is a **pnpm workspace monorepo** made of four packages, with an OpenCode Server running behind them.

## Overall layout

```
┌─────────────────────── HOST OS ───────────────────────┐
│                                                       │
│  Browser ──► Frontend (React PWA, :51730)             │
│               │  Vite proxy /api → :30010              │
│               │  EventSource /api/events (SSE)         │
│               ▼                                        │
│  ┌─────────────────────────────────────────────┐      │
│  │ Gatekeeper (Hono + SQLite, :58780)          │      │
│  │  - policy classification (classify)          │      │
│  │  - session / message / settings persistence │      │
│  │  - approval audit log · token usage         │      │
│  └───────▲─────────────────────────────────────┘      │
│          │ HTTP (settings / usage / approvals / search)│
└──────────┼─────────────────────────────────────────────┘
           │ host.docker.internal:58780 (container) / :58780 (dev)
┌──────────▼─────────────────── CONTAINER ───────────────┐
│  Agent Core (Hono BFF, :30010) ◄── published port       │
│    ├── LLM router (regex tier classification)           │
│    ├── @opencode-ai/sdk                                 │
│    └── SSE proxy (/api/events)                          │
│          │ HTTP (localhost:40960)                       │
│  OpenCode Server (opencode serve, :40960) ◄─ private    │
│    └── runs on the workspace (/workspace bind mount)    │
└─────────────────────────────────────────────────────────┘
```

## Roles of each component

| Package               | Role                                                                            | Port  |
| --------------------- | ------------------------------------------------------------------------------- | ----- |
| `packages/frontend`   | React PWA. Chat UI, session management, settings UI                             | 51730 |
| `packages/agent-core` | Hono BFF. OpenCode SDK connection, LLM router, SSE proxy, approval coordination | 30010 |
| `packages/gatekeeper` | Hono + SQLite. File-I/O policy, persistence, approval audit, usage aggregation  | 58780 |
| `packages/shared`     | Shared type definitions (Tier / Effort / Session / SSE / Command, etc.)         | —     |

## Request flow

1. Frontend input is sent to Agent Core's `POST /api/sessions/:id/messages`
2. Agent Core handles special notation (`!` bash, `@` file refs) and compresses history if needed
3. The **LLM router** classifies the task into a tier (high / middle / low) and selects a model
4. The prompt is sent to the OpenCode Server through the OpenCode SDK
5. The response is delivered to the frontend in real time over SSE (`/api/events`)

## Approval flow

1. OpenCode emits a permission request (`permission.updated`)
2. Agent Core's SSE proxy detects it and posts to Gatekeeper `POST /api/approvals`
3. Gatekeeper classifies the policy → Allow / Approval / Deny
4. If approval is required, a dialog is shown in the frontend and the user decides
5. Agent Core sends the result to OpenCode and records the decision in the audit log

## Execution modes

The same codebase supports two execution modes.

| Mode                   | Agent Core / OpenCode                                  | How to start |
| ---------------------- | ------------------------------------------------------ | ------------ |
| Local development mode | Run on the host in parallel                            | `pnpm dev`   |
| One-command start      | Agent Core + OpenCode co-located in a Docker container | `pnpm start` |

In both modes, Frontend (51730) and Gatekeeper (58780) run on the host. Inside the container, port 40960 (OpenCode) is private and not directly accessible from outside.

## Details

- [Frontend](/en/architecture/frontend)
- [Agent Core (BFF)](/en/architecture/agent-core)
- [Gatekeeper](/en/architecture/gatekeeper)
- [Docker Setup](/en/architecture/docker)
- [Security](/en/architecture/security)

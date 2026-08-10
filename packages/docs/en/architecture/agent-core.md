# Agent Core (BFF)

`packages/agent-core` is a **Hono-based BFF** that bridges the frontend and the OpenCode Server. It runs on port 30010, on the host or in a Docker container.

## Main responsibilities

- Session / message operations using the OpenCode SDK (`@opencode-ai/sdk`)
- **LLM router** for model selection
- SSE proxying (OpenCode → frontend)
- Approval-flow coordination (bridging with Gatekeeper)
- Extensions such as file references, bash execution and OGP previews

## Environment variables

| Variable            | Default                  | Description         |
| ------------------- | ------------------------ | ------------------- |
| `PORT`              | `30010`                  | Listen port         |
| `HOST`              | `0.0.0.0`                | Bind address        |
| `OPENCODE_BASE_URL` | `http://localhost:40960` | OpenCode Server URL |
| `CORS_ORIGIN`       | `http://localhost:51730` | Allowed origin      |
| `GATEKEEPER_URL`    | `http://localhost:58780` | Gatekeeper URL      |

## LLM router

The task content is classified with **zero-cost regex classification** and routed to one of three tiers.

| Result | Condition                                                                                                                  | Routed to                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| High   | Keywords for architecture / debugging / refactoring / optimization / performance / security / test design / migration etc. | high tier                   |
| Low    | Light tasks such as search, listing, `cat` / `head` / `tail` / `version` / `help` / `status`                               | low tier                    |
| Other  | Not classifiable                                                                                                           | middle tier (safe fallback) |

The actual provider, model and reasoning effort are read from the settings stored in Gatekeeper (with a 30 s TTL cache).

## Main APIs

See [API Reference](/en/reference/api) for full specifications.

| Route                        | Description                                             |
| ---------------------------- | ------------------------------------------------------- |
| `/health`                    | Health check (also checks OpenCode reachability)        |
| `/api/sessions`              | List / create / rename / delete / fork sessions         |
| `/api/sessions/:id/messages` | Fetch / send messages (`!` bash, `@` file refs)         |
| `/api/events`                | SSE streaming (proxies OpenCode events)                 |
| `/api/permissions`           | Approval flow (coordinates with Gatekeeper)             |
| `/api/settings`              | Read / write settings (transparent proxy to Gatekeeper) |
| `/api/files`                 | File search for `@` references                          |
| `/api/ogp`                   | Link previews (with SSRF protection)                    |
| `/api/auth`                  | Provider authentication                                 |

## Robustness

- When OpenCode is unreachable, it returns **503** without leaking internal errors.
- The SSE proxy uses a 15-second heartbeat and aborts on client disconnect.
- Token usage recording is idempotent, keyed by message ID.

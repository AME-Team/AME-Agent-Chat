# API Reference

The APIs used by the frontend. All of them go through Agent Core (BFF); from the browser you use the `/api` path (forwarded to 30010 by the Vite proxy).

## Health

| Method | Path      | Description                                                                |
| ------ | --------- | -------------------------------------------------------------------------- |
| GET    | `/health` | Health check. Returns `ok` / `degraded` depending on OpenCode reachability |
| GET    | `/meta`   | app name, version and port info                                            |

## Sessions

| Method | Path                        | Description                              |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/api/sessions`             | List sessions                            |
| POST   | `/api/sessions`             | Create a session                         |
| GET    | `/api/sessions/:id`         | Get a session                            |
| PATCH  | `/api/sessions/:id`         | Rename                                   |
| DELETE | `/api/sessions/:id`         | Delete                                   |
| POST   | `/api/sessions/:id/fork`    | Fork from a message point                |
| POST   | `/api/sessions/:id/share`   | Share a session                          |
| POST   | `/api/sessions/:id/unshare` | Unshare                                  |
| GET    | `/api/search?q=`            | Full-text search (relayed to Gatekeeper) |
| POST   | `/api/import`               | Import a session from JSON               |

## Current directory (Issue #56)

| Method | Path       | Description                                                                           |
| ------ | ---------- | ------------------------------------------------------------------------------------- |
| GET    | `/api/cwd` | Current directory and selectable projects (`current` / `projects`)                    |
| POST   | `/api/cwd` | Select current directory with `{ "directory": "/path" }` and persist it to Gatekeeper |

## Messages

| Method | Path                          | Description                                           |
| ------ | ----------------------------- | ----------------------------------------------------- |
| GET    | `/api/sessions/:id/messages`  | List messages                                         |
| POST   | `/api/sessions/:id/messages`  | Send a message (`!` bash, `@` file refs, attachments) |
| POST   | `/api/sessions/:id/abort`     | Abort generation                                      |
| POST   | `/api/sessions/:id/command`   | Run a slash command                                   |
| POST   | `/api/sessions/:id/summarize` | Summarize and compress history (`/compact`)           |
| POST   | `/api/sessions/:id/init`      | Create / update AGENTS.md (`/init`)                   |
| GET    | `/api/files?q=`               | File search for `@` references                        |
| GET    | `/api/ogp?url=`               | OGP link preview (with SSRF protection)               |

## Events (SSE)

| Method | Path          | Description                                                                                                                                   |
| ------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/events` | Proxies OpenCode events. Delivers `message.updated`, `message.part.updated`, `session.idle`, `permission.updated`, etc. (15-second heartbeat) |

## Permissions / approvals

| Method | Path                            | Description                                                                             |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------- |
| POST   | `/api/permissions/:id/decision` | Sends an approve / always / reject decision to OpenCode and records it in the audit log |
| GET    | `/api/permissions/history`      | Get approval history                                                                    |

## Settings & usage

| Method | Path            | Description                    |
| ------ | --------------- | ------------------------------ |
| GET    | `/api/settings` | Get settings (from Gatekeeper) |
| PUT    | `/api/settings` | Save settings (to Gatekeeper)  |
| GET    | `/api/usage`    | Aggregate token usage and cost |

## Logs (Issue #73)

| Method | Path                 | Description                                                          |
| ------ | -------------------- | -------------------------------------------------------------------- |
| GET    | `/api/logs/download` | Returns the full log as `text/plain` (concatenated with `.1` if any) |

::: warning Note

- Logs may contain request details and SDK call contents. This API requires the same **shared token (`x-terminal-token`) + Origin check** as the terminal API. Set `LOG_API_ENABLED=false` (default `true`) to disable this API entirely.
- The response is limited to the **last 10MB** (when exceeded, the tail is returned with the `X-Log-Truncated: true` header).
  :::

## Models

| Method | Path             | Description               |
| ------ | ---------------- | ------------------------- |
| GET    | `/api/providers` | List available providers  |
| GET    | `/api/models`    | List models               |
| GET    | `/api/commands`  | Slash-command definitions |

## Auth

| Method | Path                  | Description                   |
| ------ | --------------------- | ----------------------------- |
| GET    | `/api/auth/providers` | List auth providers           |
| POST   | `/api/auth/login`     | Start provider authentication |

## Backend internal APIs (Gatekeeper)

Internal APIs called from Agent Core. You normally do not need to reference them directly.

| Method | Path                          | Description                                  |
| ------ | ----------------------------- | -------------------------------------------- |
| POST   | `/api/policy/validate`        | Policy classification for paths and commands |
| POST   | `/api/approvals`              | Register and classify permission requests    |
| GET    | `/api/approvals?status=`      | Fetch pending / history                      |
| POST   | `/api/approvals/:id/decision` | Record a decision                            |
| GET    | `/api/approvals/history`      | Audit log                                    |
| POST   | `/api/usage`                  | Record token usage                           |

## Notes

- All endpoints except SSE return JSON.
- When OpenCode is unreachable, a 503 is returned and internal errors are not disclosed.
- Endpoint implementations live in `packages/agent-core/src/routes/`.

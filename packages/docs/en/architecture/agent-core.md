# Agent Core (BFF)

`packages/agent-core` is a **Hono-based BFF** that bridges the frontend and the OpenCode Server. It runs on port 30010, on the host or in a Docker container.

## Main responsibilities

- Session / message operations using the OpenCode SDK (`@opencode-ai/sdk`)
- **LLM router** for model selection
- SSE proxying (OpenCode → frontend)
- Approval-flow coordination (bridging with Gatekeeper)
- Extensions such as file references, bash execution and OGP previews

## Environment variables

| Variable            | Default                  | Description                                                                                                                                                                       |
| ------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`              | `30010`                  | Listen port                                                                                                                                                                       |
| `HOST`              | `0.0.0.0`                | Bind address                                                                                                                                                                      |
| `OPENCODE_BASE_URL` | `http://localhost:40960` | OpenCode Server URL                                                                                                                                                               |
| `CORS_ORIGIN`       | `http://localhost:51730` | Allowed origin (comma-separated). Only a standalone `*` enables all origins. No subdomain wildcards; exact match, no trailing slash. See the [settings guide](/en/guide/settings) |
| `GATEKEEPER_URL`    | `http://localhost:58780` | Gatekeeper URL                                                                                                                                                                    |
| `LOG_FILE`          | OS temp directory        | Log file output path (Issue #73)                                                                                                                                                  |
| `LOG_MAX_SIZE`      | `1048576` (1MB)          | Rotation threshold (bytes) (Issue #73)                                                                                                                                            |
| `LOG_API_ENABLED`   | `true`                   | Enable/disable `/api/logs/download` (Issue #73)                                                                                                                                   |

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
| `/api/logs/download`         | Log download (Issue #73)                                |

## Logging (Issue #73)

- In addition to the console, the logger appends ISO-timestamped records to `LOG_FILE` (default: `agent-core.log` under the OS temp directory). Level control follows `LOG_LEVEL`.
- When the file exceeds 1MB it is rotated to the `.1` generation. The "Download logs" button in settings fetches `GET /api/logs/download`, which returns both generations concatenated.
- Logs may contain request details and SDK call contents, so the download API requires the same shared token + Origin check as the terminal API. It can also be disabled with `LOG_API_ENABLED=false`.

## Current directory (Issue #56)

- The selected current directory is persisted to Gatekeeper's `app_settings` (`currentDirectory`) and restored on Agent Core startup (cached for 5 minutes after restoration; external changes are re-read after the TTL expires).
- **Restore guarantee**: the `/api/*` middleware only joins in-flight restoration and starts new restore attempts in the background, so it never blocks requests. Session APIs such as `/api/sessions` return results scoped to the restored directory **once restoration has succeeded**. If restoration fails (e.g., Gatekeeper unavailable), results fall back to the default directory and restoration is retried on subsequent requests.
- **Client retry**: the frontend retries restoration up to 3 times at 2.5s intervals (longer than the server-side 2s retry throttle) on startup. It keeps retrying until `settingsOk` (settings read successfully = permanently unset) is true, and reloads the session list for the restored directory when delayed restoration succeeds. If all attempts fail transiently, it re-checks in the background up to 3 times at 5s intervals and corrects the session list once recovered.
- `withDirectory()` injects the selected directory into the OpenCode SDK `directory` query so sessions, messages, and file search operate per directory.

## Robustness

- When OpenCode is unreachable, it returns **503** without leaking internal errors.
- The SSE proxy uses a 15-second heartbeat and aborts on client disconnect.
- Token usage recording is idempotent, keyed by message ID.

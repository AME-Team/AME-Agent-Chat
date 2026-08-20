# Gatekeeper

`packages/gatekeeper` is a **Hono + SQLite** security and persistence layer. It runs on port 58780 on the host OS.

## Main responsibilities

- **Policy classification**: decides allow / approval / deny for file I/O and command execution
- **Persistence**: stores sessions, messages, settings, approval history and token usage in SQLite
- **Approval audit**: records every permission request and decision, and exposes them as history
- **Full-text search**: LIKE search over session titles and message contents

## Policy engine

Agent permission requests are classified by `classify()` as follows.

| Condition                                                               | Result       |
| ----------------------------------------------------------------------- | ------------ |
| Host OS shell / process execution (`execute` type, shell-command match) | **Deny**     |
| Package installation (pip / npm / pnpm / yarn / apt / brew / gem)       | **Approval** |
| Access outside the workspace (path-traversal protection)                | **Approval** |
| Other in-workspace I/O                                                  | **Allow**    |

The in/out-of-workspace check normalizes paths with `resolve()` + `relative()`.

## Database

SQLite (better-sqlite3 + Drizzle ORM). Data is stored CWD-independently in `packages/gatekeeper/data/ame.db`.

| Table               | Contents                                                        |
| ------------------- | --------------------------------------------------------------- |
| `sessions`          | Sessions (title, created / updated timestamps, pinned)          |
| `chat_messages`     | Messages (role, content, provider / model / reasoning effort)   |
| `app_settings`      | Key-value settings (tier config, etc.)                          |
| `approval_requests` | Approval requests and decision history (policy, reason, result) |
| `token_usages`      | Token usage and cost                                            |

Drizzle migrations are applied automatically at startup. Legacy CWD-based databases are migrated automatically.

## Main APIs

| Route                                 | Description                                  |
| ------------------------------------- | -------------------------------------------- |
| `GET/POST /api/sessions`              | List, search and create sessions             |
| `GET/POST /api/sessions/:id/messages` | Fetch and save messages                      |
| `GET/PUT /api/settings`               | Read / write settings                        |
| `POST /api/policy/validate`           | Policy classification for paths and commands |
| `POST /api/approvals`                 | Register and classify permission requests    |
| `GET /api/approvals`                  | Fetch pending / history                      |
| `POST /api/approvals/:id/decision`    | Record approve / always / reject decisions   |
| `GET/POST /api/usage`                 | Record and aggregate token usage             |

## Safety design

- In production, error responses hide internal details (SQL, paths).
- WAL mode and foreign-key constraints are enabled.
- The workspace base for policy classification is resolved from `AME_WORKSPACE_ROOT`, the stored `currentDirectory` setting, or the process working directory at startup. Agent-reported workspace paths are not trusted for boundary protection.

See also [Security](/en/architecture/security).

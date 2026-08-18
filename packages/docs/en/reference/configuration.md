# Configuration Reference

A reference for each component's environment variables and the user-configurable items.

::: tip Loading environment variables
For local runs (`pnpm dev` / Gatekeeper's `pnpm start`), each package's `dev` / `start` scripts (and Gatekeeper's `db:migrate`) automatically load a `.env` file located in the package directory (e.g. `packages/agent-core/.env`) at startup (Node's native `--env-file-if-exists`). This flag requires Node v22.9.0+ (or v20.19.0+); this repository uses Node 24 in `.node-version`, `engines.node` and `docker/Dockerfile`, so the requirement is met. Copy `.env.example` to `packages/<pkg>/.env` to use it. Environment variables already set (e.g. via a shell `export`) take precedence over `.env`.

Agent Core started via Docker uses the environment variables passed by `docker compose` (usually the repository-root `.env`). The container image is built excluding `.env` (via `.dockerignore`) and starts from `/app` (separate from the workspace mount), so the host's `packages/agent-core/.env` is not referenced in Docker. The source of a setting therefore differs depending on the execution mode, so configure values such as `CORS_ORIGIN` per mode. Also, since `.env` is loaded independently per package, variables needed by multiple packages must be duplicated in each package's `.env`.
:::

## Agent Core environment variables

| Variable            | Default                  | Description         |
| ------------------- | ------------------------ | ------------------- |
| `PORT`              | `30010`                  | Listen port         |
| `HOST`              | `0.0.0.0`                | Bind address        |
| `OPENCODE_BASE_URL` | `http://localhost:40960` | OpenCode Server URL |
| `CORS_ORIGIN`       | `http://localhost:51730` | CORS-allowed origin |
| `GATEKEEPER_URL`    | `http://localhost:58780` | Gatekeeper API URL  |

## Gatekeeper environment variables

| Variable             | Default                           | Description                                                            |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `PORT`               | `58780`                           | Listen port                                                            |
| `HOST`               | `0.0.0.0`                         | Bind address                                                           |
| `CORS_ORIGIN`        | `http://localhost:51730`          | CORS-allowed origin                                                    |
| `AME_WORKSPACE_ROOT` | CWD at startup                    | base directory used to decide whether a path is "inside the workspace" |
| `AME_DB_PATH`        | `packages/gatekeeper/data/ame.db` | SQLite database location                                               |
| `NODE_ENV`           | —                                 | when `production`, internal details are hidden from error responses    |

::: tip
If `AME_WORKSPACE_ROOT` is empty, paths are treated as "outside the workspace" by the policy engine, so setting it explicitly is recommended.
:::

## Docker / script environment variables

| Variable         | Default                             | Description                                                                                       |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `WORKSPACE_DIR`  | current directory                   | directory bind-mounted to `/workspace` by `docker compose` (the repository root for `pnpm start`) |
| `CORS_ORIGIN`    | `http://localhost:51730`            | CORS origin passed to Agent Core from Docker Compose                                              |
| `GATEKEEPER_URL` | `http://host.docker.internal:58780` | Gatekeeper URL passed to Agent Core from Docker Compose                                           |

## App settings (changed from the UI)

### Appearance

| Setting      | Choices                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| Theme        | `light` / `dark` / `system`                                                       |
| Accent color | Trust Blue / Stable Green / Grounded Orange / Sophisticated Indigo / Clarity Teal |
| Language     | `ja` / `en`                                                                       |

### Models

| Setting             | Contents                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| Effort preset       | `deep` / `smart` / `normal` / `lite` / `rush`                            |
| Per-tier models     | provider, model and reasoning effort for each tier (high / middle / low) |
| Reasoning effort    | `high` / `middle` / `low` / `nothing`                                    |
| Context compression | ON / OFF                                                                 |

### Notifications

| Setting              | Default |
| -------------------- | ------- |
| Sound notification   | ON      |
| Desktop notification | ON      |
| Volume               | 0.6     |

Model settings are stored in the Gatekeeper `app_settings` table and cached on the backend for 30 seconds.

## Default model configuration

| Tier   | Provider      | Model               | Reasoning |
| ------ | ------------- | ------------------- | --------- |
| High   | `opencode-go` | `glm-5.2`           | Middle    |
| Middle | `opencode-go` | `qwen-3.7-plus`     | Middle    |
| Low    | `opencode-go` | `deepseek-v4-flash` | Low       |

## Effort preset matrix

| Preset | High tier | Middle tier | Low tier |
| ------ | --------- | ----------- | -------- |
| Deep   | High      | Middle      | Low      |
| Smart  | High      | High        | Low      |
| Normal | Middle    | Middle      | Low      |
| Lite   | Middle    | Low         | Low      |
| Rush   | Low       | Low         | Low      |

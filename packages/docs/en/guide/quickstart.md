# Quickstart

Once installation is complete, start the environment using one of the following methods.

## Method A: Local development mode (recommended)

Runs all packages (Frontend / Agent Core / Gatekeeper) on the host in parallel.
If `opencode serve` is not running, it is started automatically.

```bash
pnpm dev
```

Once started, the following URLs are available.

| Service            | URL                    |
| ------------------ | ---------------------- |
| Frontend (chat UI) | http://localhost:51730 |
| Agent Core (BFF)   | http://localhost:30010 |
| Gatekeeper         | http://localhost:58780 |

Open **http://localhost:51730** in your browser and start a conversation with "New chat".

::: tip
`pnpm dev` only starts the OpenCode Server (40960) if it is not already running. It is **only stopped automatically when it was auto-started**. If `opencode serve` is already running, it is reused.
:::

## Method B: One-command start (Docker)

Runs Agent Core and OpenCode Server together in a Docker container, with Frontend and Gatekeeper on the host. The browser opens automatically.

```bash
pnpm start
```

To stop:

```bash
pnpm stop
```

::: warning Linux users
The container runs as the `node` (uid 1000) user. On Linux, match the ownership of the workspace directory to uid 1000.

```bash
sudo chown -R 1000:1000 <workspace-directory>
```

Docker Desktop on Windows / macOS resolves this automatically, so this is not needed there.
:::

## Method C: Operate Docker manually

You can also start and stop just the container directly with Docker Compose.

```bash
# Start (bind-mounts the workspace to /workspace; default is the current directory)
WORKSPACE_DIR=$(pwd) docker compose up -d --build

# Follow the logs
docker compose logs -f agent

# Stop
docker compose down
```

In this setup, the container hosts Agent Core (30010 · published) and OpenCode Server (40960 · private) together. Frontend (51730) and Gatekeeper (58780) must be started separately on the host.

## Your first conversation

1. Type a message in the input box at the bottom of the chat screen and press **Enter** to send it.
2. The agent analyzes the task and routes it to an appropriate model (tier) automatically.
3. When operations such as file writes are required, an **approval dialog** appears. Review the details and choose "Approve" or "Reject".
4. Responses stream to the screen in real time.

For more details see [Chat Features](/en/guide/chat).

## Next steps

- [Chat Features](/en/guide/chat) — special notation, attachments, editing and more
- [Slash Commands](/en/guide/commands) — convenient commands starting with `/`
- [Approval Flow](/en/guide/approvals) — policy classification and approval
- [Settings](/en/guide/settings) — customizing models, tiers and themes

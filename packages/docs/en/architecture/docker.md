# Docker Setup

In the Docker setup, **Agent Core and the OpenCode Server run together in one container**. Frontend and Gatekeeper run on the host.

## Split of work

| Component       | Where it runs         | Port  |
| --------------- | --------------------- | ----- |
| Frontend        | Host                  | 51730 |
| Gatekeeper      | Host                  | 58780 |
| Agent Core      | Container (published) | 30010 |
| OpenCode Server | Container (private)   | 40960 |

The OpenCode Server (40960) inside the container is **not published to the host**. It is not directly reachable from outside. The container reaches Gatekeeper via `host.docker.internal:58780`.

## Image characteristics

| Item            | Details                                           |
| --------------- | ------------------------------------------------- |
| Base            | `node:24-bookworm-slim`                           |
| User            | `node` (uid 1000, non-root least privilege)       |
| Process manager | supervisord (auto-restarts OpenCode + Agent Core) |
| OpenCode        | `opencode-ai@1.18.14` installed globally          |
| Workspace       | host directory bind-mounted to `/workspace`       |
| Health check    | `http://localhost:30010/health`                   |

## docker-compose.yml

```yaml
services:
  agent:
    build: ./docker
    container_name: ame-agent
    volumes:
      - ${WORKSPACE_DIR:-.}:/workspace # default: current directory
    ports:
      - '30010:30010' # only Agent Core is published
    extra_hosts:
      - host.docker.internal:host-gateway # to reach Gatekeeper on Linux
    restart: unless-stopped
```

## Start / stop

```bash
# Start (specify the workspace)
WORKSPACE_DIR=/path/to/workspace docker compose up -d --build

# Follow the logs
docker compose logs -f agent

# Stop
docker compose down
```

### Using `pnpm start`

`pnpm start` uses this Docker setup automatically.

1. Verifies Docker is running (auto-launches Docker Desktop on Windows / macOS)
2. Starts Gatekeeper on the host
3. Starts Frontend on the host
4. Health-checks Gatekeeper (58780) and Frontend (51730)
5. Runs `docker compose up -d --build` (`WORKSPACE_DIR` is the repository root)
6. Health-checks Agent Core (30010), then opens the browser

`pnpm stop` stops the container and the host processes.

## Note for Linux hosts

The container runs as `node` (uid 1000), so on Linux the bind-mounted workspace directory should be owned by uid 1000.

```bash
sudo chown -R 1000:1000 /path/to/workspace
```

Docker Desktop on Windows / macOS resolves this automatically, so it is not needed there.

## Environment variables

| Variable            | Default                             | Description                                 |
| ------------------- | ----------------------------------- | ------------------------------------------- |
| `WORKSPACE_DIR`     | current directory                   | host workspace bind-mounted to `/workspace` |
| `CORS_ORIGIN`       | `http://localhost:51730`            | origin allowed by Agent Core                |
| `OPENCODE_BASE_URL` | `http://localhost:40960`            | OpenCode URL inside the container           |
| `GATEKEEPER_URL`    | `http://host.docker.internal:58780` | Gatekeeper URL                              |

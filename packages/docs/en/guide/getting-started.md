# Getting Started

AME Agent Chat is a **local development environment** for running the AI coding agent [OpenCode](https://opencode.ai) behind a rich web UI, safely and at low cost.

It works on Windows / Linux / macOS. You chat with the agent in your browser while file edits, command execution and package installs are controlled through a **safe approval flow**.

## What you can do

| Feature             | Description                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Chat                | Real-time streaming responses with SSE, Markdown, code highlighting and link previews                  |
| Thinking visibility | Collapsible reasoning blocks and a tool-execution log for the agent's internal work                    |
| Session management  | Create, rename, fork and delete sessions, plus full-text search and JSON import / export               |
| Approval flow       | A policy engine classifies file writes and other operations; dangerous ones require your approval      |
| Cost optimization   | Tasks are automatically routed to high / middle / low tier models. Token usage and cost are visualized |
| Themes              | Light / dark / system themes with five accent colors (Trust Blue, etc.)                                |
| Multilingual        | Japanese / English UI switching                                                                        |

## System layout

The environment is made of four components working behind an OpenCode Server.

```
Browser ──► Frontend (React PWA, :51730)
              │
              ├──► Agent Core (BFF, :30010) ──► OpenCode Server (:40960)
              │          │
              │          └──► Gatekeeper (Hono + SQLite, :58780)
              │
              └── SSE (EventSource /api/events)
```

- **Frontend**: a React PWA that provides the chat UI
- **Agent Core (BFF)**: a Hono server bridging the frontend and OpenCode. Handles the LLM router, SSE proxy and approval coordination
- **Gatekeeper**: stores sessions, messages, settings, approval history and usage in SQLite, and decides file I/O policy
- **OpenCode Server**: the AI agent itself that actually executes tasks

See the [architecture overview](/en/architecture/overview) for details.

## Reading path

1. [Installation](/en/guide/installation) — prerequisites and setup
2. [Quickstart](/en/guide/quickstart) — the fastest way to start
3. [Chat Features](/en/guide/chat) — learn the daily workflow
4. [Approval Flow](/en/guide/approvals) — understand safe operations
5. [Settings](/en/guide/settings) — optimize models and cost

## Related resources

- [GitHub repository](https://github.com/tarminjapan/AME-Agent-Chat)
- [OpenCode documentation](https://opencode.ai/docs)
- For developers: [Architecture](/en/architecture/overview) and [API reference](/en/reference/api)

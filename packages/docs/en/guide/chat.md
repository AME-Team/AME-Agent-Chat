# Chat Features

The chat screen lets you interact with the OpenCode agent in real time.
This page explains the input, display and editing features in detail.

## Sending a message

- Type a message in the input box at the bottom and press **Enter** to send it.
- **Shift + Enter** inserts a newline (it does not send).
- While the agent is responding, the send button changes to a **Stop** button. Click it to abort generation.

### Input assistance

- **Draft auto-save**: your per-session input is saved automatically and restored when you switch sessions.
- **Input history**: press **↑ / ↓** at the start/end of the input box to recall past inputs (up to 20 entries per session).
- **Character and token estimate**: the character count and an estimated token count are shown under the input box (Japanese is estimated at ~1.5 chars/token, others at ~4 chars/token).

## Special notation

The following special notation is available in chat input.

### `@File references`

Typing `@` followed by part of a file name shows a file-search suggestion. The selected file's content is embedded in the prompt and passed to the agent.

```
Read this file and review it: @src/router.ts
```

Only files that pass the policy validation are embedded (see [Approval Flow](/en/guide/approvals)).

### `!Bash execution`

Messages starting with `!` (except `![`) are executed as shell commands in the sandbox, and the result is shown in the chat.

```
!git status
!ls -la
```

### `/Slash commands`

Typing `/` shows the command palette. See [Slash Commands](/en/guide/commands) for details.

## Attachments

- The paperclip button, drag & drop and pasting images from the clipboard are supported.
- **Limits**: up to 5 MB per file and up to 4 files at once.

## Rendering responses

### Streaming

Agent responses are delivered over SSE and rendered character by character in real time. A cursor symbol `▍` is shown at the end while generating.

### Markdown

- Responses are rendered as Markdown (GFM compatible).
- Tables, blockquotes, lists and images are supported.
- Code blocks are shown with **syntax highlighting**, a language label and a **copy button**.

### Reasoning blocks

What the agent internally thinks is shown in a collapsible **reasoning block**. Toggle it with the `/thinking` command or by clicking the block.

### Tool-execution view

When the agent calls tools such as file edits or command execution, a **"Tool execution (N)"** accordion appears above the thread. You can check each tool's name, state and input.

### Link previews

Up to 2 URLs in a response are previewed as cards using OGP metadata.

## Message actions

Hovering over a message reveals its action buttons.

| Action            | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| Edit & regenerate | Edit a message you sent and resend it. Later responses are discarded |
| Preview           | Open the response as a read-only Markdown preview                    |
| Pin               | Pin the message (saved in the browser)                               |
| Copy              | Copy the response to the clipboard                                   |

### Long-message collapsing

Responses longer than 1500 characters are collapsed automatically. Toggle them with the "Expand / Collapse" button.

## Viewport behavior

- The view auto-scrolls to the bottom as new messages arrive.
- Scrolling back up pauses auto-follow, and a floating **jump to latest** button appears at the bottom right.

## Collapsible sidebar (Issue #57)

Click the **panel icon** at the far left of the header to show/hide the session sidebar. When collapsed, the chat area uses the full width. The collapsed state is saved in the browser and persists across restarts.

## Current directory selection (Issue #56)

Click the **folder icon** (or the current directory label) in the header to open the current-directory dialog.

- **Projects**: choose from the workspaces OpenCode knows about.
- **Custom path**: type a path directly into the text box and press "Select".

The selected directory is saved to Gatekeeper and restored on the next launch. Switching reloads the session list scoped to that directory.

## Terminal (Issue #65)

`Ctrl / Cmd + J` toggles the **terminal panel** at the bottom of the screen. Type a command and press Enter to run it inside the sandbox; the output is shown in monospace and the history is kept even when the panel is closed.

::: warning Execution environment
The terminal runs commands in the **OpenCode sandbox** (`session.shell`), same as `!Bash`. It can modify files in the workspace without an approval dialog, so prefer read-only inspection commands.
:::

::: info Shell state
Each command runs in a fresh shell, so changes like `cd` or environment variables are not carried over to the next command.
:::

## Keyboard shortcuts

| Shortcut         | Action                                                   |
| ---------------- | -------------------------------------------------------- |
| `Ctrl / Cmd + N` | Start a new chat (session)                               |
| `Ctrl / Cmd + J` | Toggle the terminal panel                                |
| `?`              | Open the help dialog (when the input box is not focused) |

## Checking connectivity

If Agent Core or the OpenCode Server is unreachable, a warning is shown in the chat screen. Connectivity is determined by a health check (`/health`). If startup fails, see [Quickstart](/en/guide/quickstart).

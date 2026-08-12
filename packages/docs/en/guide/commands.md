# Slash Commands

Typing `/` in the chat input opens the **command palette**, which you can navigate with the arrow keys and Enter.

## Command list

| Command     | Aliases                | Description                                       | Status      |
| ----------- | ---------------------- | ------------------------------------------------- | ----------- |
| `/new`      | `/clear`               | Start a new session                               | Available   |
| `/sessions` | `/resume`, `/continue` | Show and switch sessions                          | Available   |
| `/models`   | —                      | List and switch models (ties into Effort presets) | Available   |
| `/compact`  | `/summarize`           | Summarize and compress session history            | Available   |
| `/init`     | —                      | Create / update AGENTS.md                         | Available   |
| `/export`   | —                      | Export the session as Markdown / JSON             | Available   |
| `/import`   | —                      | Restore a session from an exported JSON           | Available   |
| `/share`    | —                      | Share a session (Output Prompts integration)      | Coming soon |
| `/unshare`  | —                      | Unshare a session                                 | Coming soon |
| `/connect`  | —                      | Add a provider (auth integration)                 | Available   |
| `/theme`    | —                      | Switch the theme (dark mode, etc.)                | Available   |
| `/thinking` | —                      | Toggle reasoning-block display                    | Available   |
| `/undo`     | —                      | Undo (including file changes; requires Git)       | Available   |
| `/redo`     | —                      | Redo (only valid after `/undo`)                   | Available   |
| `/details`  | —                      | Toggle tool-execution details                     | Coming soon |
| `/help`     | —                      | Help dialog (commands and shortcuts)              | Available   |

## Details on the main commands

### `/new` and `/clear`

Discards the current session and starts a new one. `/clear` is an alias.

### `/sessions`

Shows the list of saved sessions and lets you switch between them.

### `/compact`

Summarizes and compresses long session history. This reduces the cost growth caused by context bloat.

### `/init`

Creates or updates `AGENTS.md` at the repository root. It defines guidelines for the agent when working.

### `/export`

Downloads the current session as **Markdown** or **JSON**.

### `/import`

Restores sessions and messages from an exported **JSON** file (see [Session Management](/en/guide/sessions)).

### `/undo` and `/redo`

Undo / redo operations, including agent file changes. Use them on a **Git repository**.

## Special notation

Apart from commands, the following special notation is available in input (also explained in [Chat Features](/en/guide/chat)).

| Notation    | Meaning                                            |
| ----------- | -------------------------------------------------- |
| `@filename` | File reference. Embeds the content into the prompt |
| `!command`  | Run a shell command in the sandbox (except `![`)   |

## Help

Use `/help` or the `?` shortcut to open the help dialog and view the command and shortcut lists.

# Session Management

Chat conversations are saved and managed in **sessions**. The sidebar lists, searches and organizes them.

## Creating a session

- Use the **New chat** button at the top of the sidebar, or `Ctrl / Cmd + N`.
- Sessions you create yourself are titled automatically with the first 30 characters of the first message.

## Session list operations

The sidebar supports the following operations.

| Operation | How                                                        |
| --------- | ---------------------------------------------------------- |
| Pin       | Pin icon for fixed display (saved in browser localStorage) |
| Rename    | Double-click the title to edit                             |
| Fork      | Duplicate icon to branch from the last message             |
| Delete    | Trash icon (with confirmation dialog)                      |
| Sort      | By updated / created / name                                |

### Forking

Forking a session creates a new session with the same history without changing the original.
This is handy when you want to try a different approach.

## Full-text search

Typing in the search box at the top of the sidebar searches **both session titles and message contents** (with a 300 ms debounce). The search runs against Gatekeeper's SQLite database.

## Import / Export

### Export

The `/export` command downloads the current session as **Markdown** or **JSON**.

### Import

The `/import` command restores an exported JSON file. Sessions and messages are saved to Gatekeeper.

## Sharing sessions

The `/share` and `/unshare` commands are supported (implemented on the backend; marked "coming soon" in the UI).

## Persistence

- Sessions and messages are stored in the **Gatekeeper** SQLite database (`packages/gatekeeper/data/ame.db`).
- UI state such as pinned items and input history is stored in the browser's localStorage.
- Conversation history is retained across restarts.

::: tip
If an older version stored data in a CWD-based `data/ame.db`, it is migrated automatically to the new location on the first start.
:::

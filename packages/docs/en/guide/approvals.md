# Approval Flow

In AME Agent Chat, the agent's file I/O and command execution are classified by the **Gatekeeper** policy engine, and only the operations that need it are sent to the user for approval. This provides a safety layer that prevents an AI agent from accidentally performing destructive operations.

## Enabling permission requests

OpenCode allows most operations without asking by default, so the approval dialog would never appear. To route operations through the policy engine, this repository ships an OpenCode config (`opencode.jsonc`) that sets `bash` and `edit` to `"ask"`.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": "ask",
    "edit": "ask",
  },
}
```

With this config, every shell command and file edit emits a `permission.updated` event that Agent Core relays to Gatekeeper. Only the operations that the policy classifies as **approval** show a dialog, so everyday in-workspace commands such as `git status` and `ls` continue to run automatically.

## How classification works

Every time the agent asks for a permission, Gatekeeper classifies it automatically.

| Policy                              | Result       | Description                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host OS shell execution             | **Deny**     | Shell / interpreter / process execution is always forbidden (`execute` type or `bash`/`sh`/`zsh`/`eval` etc. as a command)                                                                                                                        |
| Package installation                | **Approval** | `pip` / `npm` / `pnpm` / `yarn` / `apt` / `brew` / `gem` / `uv` / `cargo` / `go` etc. `install`/`add`/`remove` require approval                                                                                                                   |
| Destructive operations              | **Approval** | `rm` / `mv` / `dd` / `mkfs` / system-path overwrites / forced restarts / process kills / destructive `git` (`checkout .`, `restore <path>`, `reset --hard`, `clean -f`) etc.                                                                      |
| High-impact permission / truncate   | **Approval** | Recursive ownership/permission changes (`chmod -R`, `--recursive`, `chown -R`), permission changes targeting system paths, zero-size truncate (`truncate -s 0`, `--size=0`, `-s 0M`), immutable/append-only `chattr` (`+i` / `=i` / `+=i` / `+a`) |
| Script / binary execution           | **Approval** | Running a workspace-local executable such as `./deploy.sh` (opaque content cannot be statically verified)                                                                                                                                         |
| Inline arbitrary code               | **Approval** | `python -c` / `node -e` / `--eval` etc. that execute arbitrary code inline                                                                                                                                                                        |
| Command substitution / indirect ops | **Approval** | `$(...)`, backticks, `find -delete` / `xargs rm` whose safety cannot be statically verified                                                                                                                                                       |
| Access outside the workspace        | **Approval** | Paths that resolve outside the workspace require approval (path-traversal protection)                                                                                                                                                             |
| Reads / writes inside the workspace | **Allow**    | Other in-workspace I/O (direct non-destructive commands like `git status`, `ls`, `cat`) are allowed automatically                                                                                                                                 |

The classification result is handled as follows.

- **Allow**: an automatic `once` is sent and the operation runs without user interaction.
- **Approval**: an **approval dialog** is shown in the frontend.
- **Deny**: an automatic `reject` is sent and the operation is not executed.

## Approval dialog

When an approval is required, a dialog appears in the chat screen. Review the operation type, target path, command and reason, then choose one of the following.

| Action       | Meaning                                                  |
| ------------ | -------------------------------------------------------- |
| Approve      | Allow this operation once (`once`)                       |
| Always Allow | Auto-allow this kind of operation from now on (`always`) |
| Reject       | Reject this operation (`reject`)                         |

::: tip Note
"Always Allow" grants a permanent permission for that kind of operation. Review the details carefully before selecting it.
:::

## Approval history (audit log)

Every permission request and approve / reject decision is recorded in Gatekeeper's SQLite database, and can be reviewed in the **Approval History** dialog.

- Open it from the history icon in the header.
- Each record stores the type, target, policy result, decision and timestamp.

## Specifying the workspace

The base used to determine whether a path is "inside the workspace" is, in order of priority: the `AME_WORKSPACE_ROOT` environment variable, the stored `currentDirectory` setting, and the Gatekeeper process working directory at startup. See [Configuration Reference](/en/reference/configuration).

## Design details

For the policy-classification logic and data structures, see:

- [Gatekeeper](/en/architecture/gatekeeper) — policy engine implementation
- [Security](/en/architecture/security) — the full safety design
- [API Reference](/en/reference/api) — approval API specifications

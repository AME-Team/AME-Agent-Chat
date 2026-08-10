# Approval Flow

In AME Agent Chat, the agent's file I/O and command execution are classified by the **Gatekeeper** policy engine, and only the operations that need it are sent to the user for approval. This provides a safety layer that prevents an AI agent from accidentally performing destructive operations.

## How classification works

Every time the agent asks for a permission, Gatekeeper classifies it automatically.

| Policy                              | Result       | Description                                                                                             |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Host OS shell execution             | **Deny**     | Shell / process execution on the host OS is always forbidden (matches `execute` type or shell commands) |
| Package installation                | **Approval** | `pip` / `npm` / `pnpm` / `yarn` / `apt` / `brew` / `gem` etc. require approval                          |
| Access outside the workspace        | **Approval** | Paths that resolve outside the workspace require approval (path-traversal protection)                   |
| Reads / writes inside the workspace | **Allow**    | Other in-workspace I/O is allowed automatically                                                         |

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

The base used to determine whether a path is "inside the workspace" is set with the Gatekeeper `AME_WORKSPACE_ROOT` environment variable. The default is the current working directory at startup. See [Configuration Reference](/en/reference/configuration).

## Design details

For the policy-classification logic and data structures, see:

- [Gatekeeper](/en/architecture/gatekeeper) — policy engine implementation
- [Security](/en/architecture/security) — the full safety design
- [API Reference](/en/reference/api) — approval API specifications

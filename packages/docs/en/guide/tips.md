# Tips & Tricks

Useful features and hints for getting the most out of the chat.

## Being efficient

### Make context explicit with file references

Typing `@` followed by a file path embeds its content into the prompt. Explicitly referencing relevant files yields better answers than vague instructions.

```
Optimize the routing in @src/router.ts
```

### Quick command execution

To quickly check shell commands, use input starting with `!`.

```
!ls src/
!git log --oneline -5
```

### Compress long history

When a session grows long and cost becomes a concern, use `/compact` to summarize and compress the history. Enabling "Compress context" in settings automates this.

## Using it safely

### Check the approval details

Choosing "Always Allow" auto-allows that kind of operation from then on. Especially for access outside the workspace or package installation, review carefully before deciding.

### Monitor changes to important files

`/undo` can revert file changes on a Git repository. Committing before important work is a safe practice.

## Organizing and reusing

### Compare approaches with forks

To try multiple approaches, fork the session and try them in parallel. The original session is preserved.

### Export to share

`/export` writes a session out as Markdown or JSON — convenient for sharing findings or keeping records.

### Find past conversations with full-text search

The search box covers **entire message contents**, not just titles. Great for finding how you solved something before.

## Customizing the display

### Toggling reasoning blocks

Use `/thinking` to show the agent's reasoning process. Run it again to hide it.

### Tool-execution details

The "Tool execution" accordion shows the tools the agent invoked. You can see what was edited or executed.

### Light / dark switching

Use dark mode in dim environments and light mode in bright ones. Choose from the five accent colors to match your taste.

## Troubleshooting

### A response is stuck

- Interrupt with the **Stop** button during generation, then rephrase and resend the prompt.
- You can also fix a message you sent with **Edit & regenerate**.

### Cannot reach Agent Core

- If the chat shows "Cannot reach Agent Core", review the startup steps in [Quickstart](/en/guide/quickstart).
- `pnpm dev` starts the OpenCode Server automatically. If running manually, make sure `opencode serve` is listening on port 40960.

### Settings are not reflected

- Model settings are cached for 30 seconds on the backend. Wait a moment and check again.

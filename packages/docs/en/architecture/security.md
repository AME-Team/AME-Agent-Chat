# Security

AME Agent Chat includes multiple defense layers for operating an AI agent safely.

## 1. Policy-based file-I/O control

Every agent permission request is classified by the Gatekeeper policy engine.

- **Host OS shell execution is always denied** (only sandboxed execution is allowed)
- **Package installation requires approval**
- **Path-traversal protection**: paths are normalized and verified to stay inside the workspace. External access requires approval

## 2. Approval + audit trail

- Operations that need approval are reviewed by the user in a frontend dialog.
- Every permission request and decision (approve / always / reject) is recorded in SQLite and can be reviewed in the **Approval History**.

## 3. Container isolation

- The OpenCode Server runs inside the container as a non-root user (uid 1000).
- The OpenCode port (40960) is **not published to the host**.
- The host workspace is the only bind mount.

## 4. `@` file-reference validation

`@path` references embedded into prompts are only read when the Gatekeeper policy returns `allow`. Unauthorized files are never embedded.

## 5. SSRF protection for OGP previews

Link previews (`/api/ogp`) are fetched server-side with the following protections:

- Private IPs, loopback and reserved ranges are rejected
- Hosts are validated after DNS resolution
- `.local` / `.internal` hosts are rejected

## 6. Error-message information hiding

- When OpenCode is unreachable, a 503 is returned without leaking internal errors.
- Gatekeeper hides internals such as SQL and paths from error responses in production.

## 7. Usage visibility

Token usage and cost are recorded per provider × model and can be reviewed in the Usage dialog, making sudden cost spikes easier to detect.

## 8. Least privilege

- The container runs as non-root
- `.dockerignore` excludes `.env` and `node_modules` from the image
- Secret scanning (gitleaks) runs in the pre-commit hook
- An AI review system (Dual-Gate) acts as a quality and security gate

## Recommendations

- Keep only the files you need in the workspace.
- Do not place secrets you want to keep private inside the workspace.
- "Always Allow" stays effective permanently for that kind of operation, so review its impact before choosing it.

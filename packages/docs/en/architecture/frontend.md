# Frontend

`packages/frontend` is a **React PWA** that provides the interface for interacting with the OpenCode agent. It runs on port 51730.

## Tech stack

| Layer            | Technology                                                   |
| ---------------- | ------------------------------------------------------------ |
| UI framework     | React 19                                                     |
| Build tool       | Vite + React plugin                                          |
| Language         | TypeScript (strict, `verbatimModuleSyntax`)                  |
| Styling          | Tailwind CSS 3 (8px grid, `--color-primary` token)           |
| State management | Zustand (app / ui / settings stores)                         |
| i18n             | Custom lightweight i18n (ja/en dictionaries + React context) |
| Markdown         | react-markdown + remark-gfm + rehype-highlight               |
| PWA              | vite-plugin-pwa (Service Worker, standalone display)         |
| Icons            | lucide-react                                                 |
| Shared types     | `@ame-agent-chat/shared`                                     |

## Screen layout

There is no routing library; the app is a single screen plus dialogs.

- **Sidebar**: session list, search, new chat, sorting
- **Header**: theme / accent color / language switching and dialog launchers
- **ChatView**: message thread, tool-execution accordion
- **MessageInput**: send / stop / attachments
- **Dialogs**: help, approval, model settings, approval history, auth, usage, preview

## Backend connection

In development, the Vite proxy forwards all `/api` requests to Agent Core (30010). The browser only ever talks to the same origin.

- Regular APIs: REST (sessions / messages / settings / search, etc.)
- Streaming: an `EventSource` subscribes to `/api/events` and reflects SSE events into the store

## Data persistence

| Data                                                       | Stored in            |
| ---------------------------------------------------------- | -------------------- |
| Sessions, messages, settings, approval history, usage      | Gatekeeper (SQLite)  |
| Theme, accent color, language, notification settings, pins | Browser localStorage |

## PWA

- Runs with `display: standalone` and is installable.
- Theme color is `#005B99` (Trust Blue).
- The Service Worker is registered immediately on startup and updates are applied automatically.

## Design (ame-ui)

The frontend UI follows the ame-ui philosophy.

- **8px grid**, `rounded-md/lg`, structure through spacing
- Five accent colors (Trust Blue / Stable Green / Grounded Orange / Sophisticated Indigo / Clarity Teal)
- Light / dark / system themes
- Google Fonts (Noto family) with automatic font switching for ja/en
- WCAG 2.1 AA compliance (contrast, focus indicators, `aria` attributes)

This documentation site is designed to the same ame-ui standards.

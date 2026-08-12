# Settings (Models & Tiers)

Use the icons at the top right of the header to change the theme, accent color, language, model settings and usage.

## Theme and appearance

Click the theme icon in the header to cycle through **Light → Dark → System**. The icon shows the current state (Sun / Moon / Monitor).

### Accent color

A single-point color with the following **5 presets** is available. Different values are applied in light / dark mode (WCAG 2.1 AA compliant).

| Name                 | Light     | Dark      |
| -------------------- | --------- | --------- |
| Trust Blue           | `#005B99` | `#3B82C4` |
| Stable Green         | `#2D6A4F` | `#4F8A6E` |
| Grounded Orange      | `#C2410C` | `#DD6B3D` |
| Sophisticated Indigo | `#4338CA` | `#7C79E8` |
| Clarity Teal         | `#0F766E` | `#2FA39A` |

### Language

The language dropdown in the header switches between **日本語 / English**. The UI font also switches accordingly (Noto Sans JP for Japanese, Noto Sans for English).

## Model selection (header)

The model dropdown in the header lets you select the model to use, just like a normal chat app (Issue #62). The selected model is sent with each message.

- **Auto (default)**: no model is specified. With orchestration disabled (the default), opencode's default model is used.

## Model settings (Tiers and Effort)

Open the **model settings dialog** from the "Settings" icon in the header. This is where you customize the LLM strategy.

### LLM orchestration

The **"LLM orchestration"** checkbox (default: **off**) enables automatic model selection by task when no model is specified. When off, the model selected in the header (or opencode's default) is used (Issue #62).

::: tip Orchestration vs. model selection
Enabling orchestration resets the header model selection to **Auto (default)** so automatic routing takes priority. To use a specific model, keep orchestration off and select it in the header.
:::

### Tiers (3-layer model tiers)

With orchestration enabled, tasks are automatically routed to one of three tiers based on their content.

| Tier   | Role                                                                 | Default model (provider: opencode-go) | Default reasoning |
| ------ | -------------------------------------------------------------------- | ------------------------------------- | ----------------- |
| High   | Complex tasks such as architecture design, debugging and refactoring | `glm-5.2`                             | Middle            |
| Middle | General implementation and questions (fallback for classification)   | `qwen3.7-plus`                        | Middle            |
| Low    | Light tasks such as search, listing and file reference               | `deepseek-v4-flash`                   | Low               |

For each tier you can set the **provider / model / reasoning effort** individually.

### Reasoning effort

The reasoning effort can be chosen from 4 levels.

| Value   | Meaning      |
| ------- | ------------ |
| High    | Think deeply |
| Middle  | Standard     |
| Low     | Lightweight  |
| Nothing | No reasoning |

### Effort presets

Choosing one of the 5 presets for the "quality × cost" balance applies the reasoning efforts to all tiers at once.

| Preset | High tier | Middle tier | Low tier | Use case                       |
| ------ | --------- | ----------- | -------- | ------------------------------ |
| Deep   | High      | Middle      | Low      | Highest quality, deep thinking |
| Smart  | High      | High        | Low      | Accuracy first                 |
| Normal | Middle    | Middle      | Low      | Balanced (default)             |
| Lite   | Middle    | Low         | Low      | Lightweight, low cost          |
| Rush   | Low       | Low         | Low      | Fastest, cheapest              |

### Context compression

Enabling the **"Compress context"** checkbox (default: **off**) summarizes history before sending, keeping context from bloating. Useful for cutting cost.

### Chat width (Issue #63)

The chat area (main window) width can be adjusted from 5 presets. Changes apply immediately and are stored in local storage. For responsive behavior, small screens take the maximum width up to the preset's `max-w-*` limit (narrow presets may not reach full width on smaller screens).

| Preset      | Max width             |
| ----------- | --------------------- |
| Full width  | None (full width)     |
| Wide        | `max-w-5xl`           |
| Medium-wide | `max-w-4xl`           |
| Standard    | `max-w-3xl` (default) |
| Narrow      | `max-w-2xl`           |

## Usage and cost

The "Usage" icon in the header shows **token usage and cost** per provider × model. Usage is recorded in Gatekeeper.

## Notifications

While the browser window is unfocused, you can receive the following notifications (saved in the browser's localStorage).

| Setting              | Default                   |
| -------------------- | ------------------------- |
| Sound notification   | ON (880 Hz · 0.15 s beep) |
| Desktop notification | ON                        |
| Volume               | 0.6                       |

## Persistence

- Model settings (tiers / effort / compression) are stored in the **Gatekeeper** `app_settings` table (shared across sessions).
- Theme, accent color, language and notification settings are stored in the browser's localStorage.

::: tip
The backend LLM router caches model settings for 30 seconds. If changes are not reflected immediately, wait a moment.
:::

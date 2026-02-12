# Bulut

A lightweight, embeddable AI chatbot widget for React, Next.js, and Vite applications. Renders inside a Shadow DOM so its styles never leak into your app.

## Features

- Voice input with real-time STT → LLM → TTS pipeline
- Floating chat window with streaming responses
- Built-in tool calling (page navigation, element interaction)
- Themeable via a single hex colour prop
- Zero-CSS — everything is scoped inside Shadow DOM
- Accessibility mode for hands-free usage
- Tiny footprint — ships as a single JS bundle

## Installation

```bash
npm install bulutbot
```

## Quick Start

### React / Vite

```tsx
import { Bulut } from 'bulutbot';

function App() {
  return (
    <>
      <h1>My App</h1>
      <Bulut
        projectId="your-project-id"
      />
    </>
  );
}

export default App;
```

### Next.js (App Router)

The component is marked `'use client'` internally, so you can use it directly in Server Components:

```tsx
// app/layout.tsx
import { Bulut } from 'bulut';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Bulut
          projectId="your-project-id"
        />
      </body>
    </html>
  );
}
```

Or import it inside a client component if you need to control it conditionally:

```tsx
// components/ChatWidget.tsx
'use client';

import { Bulut } from 'bulut';

export function ChatWidget() {
  return (
    <Bulut
      projectId="your-project-id"
      baseColor="#0ea5e9"
      voice="ali"
    />
  );
}
```

### Next.js (Pages Router)

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { Bulut } from 'bulut';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Bulut
        projectId="your-project-id"
      />
    </>
  );
}
```

### Vanilla HTML (Embed Script)

For non-React sites, use the `bulut/embed` entry point:

```html
<script type="module">
  import Bulut from 'https://unpkg.com/bulut/dist/embed.js';
  Bulut.init({
    projectId: 'your-project-id',
  });
</script>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | — | **Required.** Your Bulut project ID. |
| `backendBaseUrl` | `string` | `"http://localhost:8000"` | Backend API URL. |
| `model` | `string` | `"google/gemini-3-flash-preview:nitro"` | LLM model identifier. |
| `voice` | `"zeynep" \| "ali"` | `"zeynep"` | Voice for TTS output. |
| `baseColor` | `string` | `"#6C03C1"` | Primary theme colour (hex). Button, header, and user message bubbles will use this colour. |

## Embed API

When using the `bulut/embed` script entry, the following methods are available:

### `Bulut.init(options)`

Initialize the widget. Accepts the same props as the React component, plus:

- `containerId` (optional) — ID of an existing DOM element to mount into. If omitted, a container is created automatically.

```js
Bulut.init({
  projectId: 'your-project-id',
  baseColor: '#0ea5e9',
});
```

### `Bulut.destroy()`

Remove the widget from the page and clean up.

### `Bulut.isReady()`

Returns `true` if the widget is currently initialized.

## Theming

Pass a `baseColor` hex string to change the accent colour across the entire widget:

```tsx
<Bulut projectId="..." baseColor="#0ea5e9" />
```

The widget inherits the host page's `font-family`, so it will match your site's typography automatically.

## How It Works

The `<Bulut>` React component dynamically imports the Preact-based widget at runtime and mounts it inside a Shadow DOM container. This means:

1. **No style conflicts** — widget CSS is fully isolated.
2. **SSR-safe** — the dynamic import avoids `window`/`document` at build time.
3. **Lightweight** — Preact keeps the bundle small while React stays your app's framework.

## Browser Support

Modern browsers that support ES2020+:

- Chrome 80+
- Firefox 80+
- Safari 14+
- Edge 80+

## License

MIT

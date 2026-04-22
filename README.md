# expo-webview-bridge

A lightweight, fully-typed bidirectional message bridge between React Native and WebView for Expo. Send typed messages in both directions, pass initial config, set cookies and storage — all with a clean React API.

## Features

- **Bidirectional messaging** — RN → WebView and WebView → RN with typed payloads
- **Auto-injected bridge** — `window.Bridge` is available in the WebView before the page scripts run
- **Initial params** — pass read-only config/tokens into the WebView as `Bridge.params`
- **Web storage** — pre-populate cookies, `localStorage`, and `sessionStorage`
- **`onClose`** — let the web page signal RN to unmount the WebView
- **`onError`** — unified error callback covering both directions of the bridge
- **Wildcard subscriptions** — `Bridge.on('*', handler)` catches all message types
- **Full TypeScript** — everything is typed end-to-end

## Installation

Install the package and its peer dependency:

```bash
npx expo install react-native-webview
```

Then add the library (once published to npm):

```bash
npm install expo-webview-bridge
```

> **Expo Go** — `react-native-webview` requires native code and is not bundled in the standard Expo Go client. Use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`npx expo run:ios` / `npx expo run:android`) to test.

## Quick Start

```tsx
import React, { useRef, useState } from 'react';
import { View, Button } from 'react-native';
import { WebViewBridge, WebViewBridgeRef } from 'expo-webview-bridge';

const HTML = `
  <button onclick="Bridge.send('hello', { from: 'web' })">Send to RN</button>
  <script>
    Bridge.on('ping', (payload) => console.log('RN says:', payload));
  </script>
`;

export default function App() {
  const ref = useRef<WebViewBridgeRef>(null);

  return (
    <View style={{ flex: 1 }}>
      <Button title="Ping WebView" onPress={() => ref.current?.sendMessage('ping', { ts: Date.now() })} />
      <WebViewBridge
        ref={ref}
        source={{ html: HTML }}
        onMessage={(type, payload) => console.log('[RN]', type, payload)}
        onReady={() => console.log('bridge ready')}
      />
    </View>
  );
}
```

## Architecture

```
React Native                          WebView
──────────────────────────────────────────────────────
ref.sendMessage('type', payload) ──►  Bridge.on('type', handler)
onMessage(type, payload)         ◄──  Bridge.send('type', payload)
onClose()                        ◄──  Bridge.close()
onError(error)                   ◄──  Bridge.on() handler throws
                                       (reported as __bridge_error__)
```

The bridge script is injected via `injectedJavaScriptBeforeContentLoaded`, so `window.Bridge` (and `Bridge.params`) are available synchronously before any page script runs.

---

## API Reference

### `<WebViewBridge>`

Extends all `react-native-webview` `WebView` props. The following props are added or replaced:

| Prop | Type | Description |
|---|---|---|
| `onMessage` | `(type: string, payload: unknown) => void` | Called for every message received from the WebView. |
| `onReady` | `() => void` | Called once the bridge script has initialised inside the WebView. |
| `onClose` | `() => void` | Called when the web side invokes `Bridge.close()`. Use this to unmount or hide the WebView. |
| `onError` | `(error: BridgeError) => void` | Called when the bridge encounters an error in either direction (see [Error Handling](#error-handling)). |
| `initialParams` | `Record<string, unknown>` | Data passed into the WebView as `Bridge.params` (read-only, available before the page loads). |
| `webStorage` | `WebStorageConfig` | Cookies, `localStorage`, and `sessionStorage` entries written after the page loads. |
| `injectedJavaScriptBeforeContentLoaded` | `string` | Extra JS injected alongside the bridge script (before page load). |

> `onMessage` and `injectedJavaScriptBeforeContentLoaded` from `react-native-webview` are replaced by the bridge's versions — use the props above instead.

---

### Ref — `WebViewBridgeRef`

Attach a `ref` to get imperative access:

```tsx
const ref = useRef<WebViewBridgeRef>(null);
<WebViewBridge ref={ref} ... />
```

| Method | Description |
|---|---|
| `sendMessage(type, payload?)` | Send a typed message into the WebView. |
| `on(type, handler)` | Subscribe to a message type from the WebView. Returns an unsubscribe function. |
| `off(type, handler)` | Remove a specific handler. |

```tsx
// Subscribe imperatively (useful in effects or outside the component tree)
useEffect(() => {
  const unsub = ref.current?.on<{ count: number }>('counter', (payload) => {
    console.log(payload.count);
  });
  return unsub;
}, []);
```

---

### Web-side `Bridge` API

The following is available as `window.Bridge` inside the WebView (no import needed):

| Member | Description |
|---|---|
| `Bridge.params` | Read-only object containing the `initialParams` passed from RN. Available synchronously before page scripts run. |
| `Bridge.send(type, payload?)` | Send a message to React Native. |
| `Bridge.close()` | Signal React Native to close/unmount the WebView (triggers `onClose`). |
| `Bridge.on(type, handler)` | Subscribe to a message from RN. Returns an unsubscribe function. |
| `Bridge.off(type, handler)` | Remove a specific handler. |
| `Bridge.on('*', handler)` | Wildcard — receives every message type. |

```js
// Available before page scripts run
console.log(Bridge.params.user); // → "Gaurav"

// Subscribe to a message from RN
const unsub = Bridge.on('theme', (payload) => {
  document.body.className = payload.mode;
});

// Send a message to RN
Bridge.send('pageReady', { url: location.href });

// Ask RN to close the WebView
Bridge.close();
```

---

## Examples

### Passing initial config (`initialParams`)

`initialParams` is injected before the page loads. It is frozen and available as `Bridge.params`.

```tsx
<WebViewBridge
  source={{ uri: 'https://myapp.com' }}
  initialParams={{ userId: '42', theme: 'dark', token: 'Bearer abc' }}
/>
```

```js
// Inside the WebView — available synchronously
const { userId, theme, token } = Bridge.params;
```

### Closing the WebView

```tsx
const [visible, setVisible] = useState(true);

{visible && (
  <WebViewBridge
    source={{ uri: 'https://myapp.com' }}
    onClose={() => setVisible(false)}
  />
)}
```

```js
// Inside the WebView
document.getElementById('close-btn').onclick = () => Bridge.close();
```

### Pre-populating storage (`webStorage`)

Applied via `injectedJavaScript` (after load) so it never blocks bridge initialisation.

```tsx
<WebViewBridge
  source={{ uri: 'https://myapp.com' }}
  webStorage={{
    cookies: [
      { name: 'session', value: 'abc-xyz', path: '/', maxAge: 3600 },
      { name: 'locale',  value: 'en-IN',   path: '/', secure: true },
    ],
    localStorage: {
      authToken: 'Bearer eyJhbGc...',
      theme: 'dark',
    },
    sessionStorage: {
      lastRoute: '/dashboard',
    },
  }}
/>
```

> **Note:** `webStorage` is applied after the page loads. It is available in event handlers and on-demand reads, but not in synchronous inline `<script>` tags.

### Type-specific subscriptions via ref

```tsx
useEffect(() => {
  const unsubA = ref.current?.on<{ x: number }>('position', ({ x }) => {
    console.log('x =', x);
  });
  const unsubB = ref.current?.on('*', (payload, type) => {
    console.log('any message:', type, payload);
  });
  return () => { unsubA?.(); unsubB?.(); };
}, []);
```

---

## Error Handling

Pass `onError` to receive a `BridgeError` whenever something goes wrong:

```tsx
<WebViewBridge
  onError={(error) => {
    console.error(error.source, error.message, error.detail);
  }}
/>
```

### `BridgeError`

```ts
interface BridgeError {
  source: BridgeErrorSource;
  message: string;
  detail?: unknown; // original error object or extra context
}

type BridgeErrorSource =
  | 'rn-to-webview'     // error while sending RN → WebView
  | 'webview-to-rn'     // error while receiving WebView → RN
  | 'webview-internal'; // a Bridge.on() handler threw inside the WebView
```

| Source | What triggers it |
|---|---|
| `rn-to-webview` | WebView not mounted, payload serialization failed, `injectJavaScript` threw |
| `webview-to-rn` | Malformed JSON from WebView, RN-side `Bridge.on()` handler threw |
| `webview-internal` | Web-side `Bridge.on()` handler threw — caught by the bridge script and sent back as a message |

---

## Monorepo Structure

This repository is a monorepo used for development and testing.

```
expo-webview-bridge/
├── packages/
│   └── expo-webview-bridge/   # The library
│       └── src/
│           ├── index.ts
│           ├── types.ts
│           ├── bridgeScript.ts
│           ├── storageScript.ts
│           ├── useWebViewBridge.ts
│           └── WebViewBridge.tsx
└── apps/
    └── example/               # Expo test app
```

### Running the example app

```bash
npm install
cd apps/example
npx expo start --offline
```

Metro watches the entire monorepo root, so edits to the library source hot-reload in the example app immediately — no rebuild needed.

### Requirements

- Node.js >= 20.19.4
- Expo SDK 54
- React Native 0.81

---

## License

MIT

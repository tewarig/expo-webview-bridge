import type { WebViewProps } from 'react-native-webview';

export interface BridgeMessage<T = unknown> {
  type: string;
  payload?: T;
}

export type MessageHandler<T = unknown> = (payload: T, type: string) => void;

export type Unsubscribe = () => void;

export interface WebViewBridgeRef {
  /** Send a typed message to the WebView */
  sendMessage: <T = unknown>(type: string, payload?: T) => void;
  /** Subscribe to messages from the WebView. Returns an unsubscribe function. */
  on: <T = unknown>(type: string, handler: MessageHandler<T>) => Unsubscribe;
  /** Unsubscribe a specific handler */
  off: <T = unknown>(type: string, handler: MessageHandler<T>) => void;
}

export interface WebViewBridgeProps
  extends Omit<WebViewProps, 'onMessage' | 'injectedJavaScriptBeforeContentLoaded'> {
  /**
   * Called when any message arrives from the WebView bridge.
   * Use `ref.on(type, handler)` for type-specific subscriptions.
   */
  onMessage?: <T = unknown>(type: string, payload: T) => void;
  /** Called once the bridge script has loaded inside the WebView */
  onReady?: () => void;
  /** Extra JS to inject alongside the bridge script */
  injectedJavaScriptBeforeContentLoaded?: string;
}

import type { WebViewProps } from 'react-native-webview';

export interface BridgeMessage<T = unknown> {
  type: string;
  payload?: T;
}

export interface CookieConfig {
  name: string;
  value: string;
  /** Defaults to "/" */
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** UTC date string e.g. "Fri, 31 Dec 2027 23:59:59 GMT" */
  expires?: string;
  /** Lifetime in seconds */
  maxAge?: number;
}

export interface WebStorageConfig {
  /** Cookies set via document.cookie before the page loads */
  cookies?: CookieConfig[];
  /** Key-value pairs written to localStorage before the page loads */
  localStorage?: Record<string, string>;
  /** Key-value pairs written to sessionStorage before the page loads */
  sessionStorage?: Record<string, string>;
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
  /**
   * Called when the web side invokes Bridge.close().
   * Use this to unmount or hide the WebView in your UI.
   */
  onClose?: () => void;
  /**
   * Data available in the web side as Bridge.params (read-only).
   * Injected before the page loads — useful for passing config, tokens, user info, etc.
   */
  initialParams?: Record<string, unknown>;
  /**
   * Query params appended to the source URI.
   * Only applied when source is a { uri } object — ignored for inline HTML sources.
   */
  sourceParams?: Record<string, string>;
  /**
   * Cookies, localStorage, and sessionStorage entries written into the WebView
   * before the page loads.
   */
  webStorage?: WebStorageConfig;
  /** Extra JS to inject alongside the bridge script */
  injectedJavaScriptBeforeContentLoaded?: string;
}

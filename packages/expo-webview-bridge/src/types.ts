import type { WebViewProps } from 'react-native-webview';

export interface BridgeMessage<T = unknown> {
  type: string;
  payload?: T;
}

/** Which side of the bridge produced the error */
export type BridgeErrorSource =
  | 'rn-to-webview'    // error sending a message from RN into the WebView
  | 'webview-to-rn'    // error receiving / handling a message from the WebView
  | 'webview-internal'; // a handler registered with Bridge.on() threw inside the WebView

export interface BridgeError {
  source: BridgeErrorSource;
  message: string;
  /** Original error object or extra context */
  detail?: unknown;
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
   * Cookies, localStorage, and sessionStorage entries written into the WebView
   * after the page loads. Applied via injectedJavaScript so it doesn't block
   * bridge initialisation.
   */
  webStorage?: WebStorageConfig;
  /**
   * Called whenever the bridge encounters an error in either direction.
   * Covers: serialization failures, parse errors, handler exceptions, and
   * errors reported back from Bridge.on() callbacks inside the WebView.
   */
  onError?: (error: BridgeError) => void;
  /** Extra JS to inject alongside the bridge script */
  injectedJavaScriptBeforeContentLoaded?: string;
}

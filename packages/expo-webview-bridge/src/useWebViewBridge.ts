import { useRef, useCallback } from 'react';
import type { WebView } from 'react-native-webview';
import type { BridgeError, BridgeMessage, MessageHandler, Unsubscribe } from './types';

export function useWebViewBridge(
  onErrorRef: React.RefObject<((error: BridgeError) => void) | undefined>,
) {
  const webViewRef = useRef<WebView>(null);
  const handlers = useRef<Record<string, MessageHandler[]>>({});

  const reportError = useCallback((error: BridgeError) => {
    onErrorRef.current?.(error);
  }, [onErrorRef]);

  const sendMessage = useCallback(<T = unknown>(type: string, payload?: T) => {
    if (!webViewRef.current) {
      reportError({
        source: 'rn-to-webview',
        message: 'WebView is not mounted — cannot send message',
        detail: { type },
      });
      return;
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(payload !== undefined ? payload : null);
    } catch (e) {
      reportError({
        source: 'rn-to-webview',
        message: 'Failed to serialize payload',
        detail: { type, error: e },
      });
      return;
    }

    const script = `window.Bridge && window.Bridge._dispatch(${JSON.stringify(type)}, ${serialized}); true;`;
    try {
      webViewRef.current.injectJavaScript(script);
    } catch (e) {
      reportError({
        source: 'rn-to-webview',
        message: 'injectJavaScript failed',
        detail: { type, error: e },
      });
    }
  }, [reportError]);

  const on = useCallback(<T = unknown>(
    type: string,
    handler: MessageHandler<T>,
  ): Unsubscribe => {
    if (!handlers.current[type]) handlers.current[type] = [];
    handlers.current[type].push(handler as MessageHandler);
    return () => off(type, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const off = useCallback(<T = unknown>(type: string, handler: MessageHandler<T>) => {
    if (!handlers.current[type]) return;
    handlers.current[type] = handlers.current[type].filter((h) => h !== handler);
  }, []);

  const dispatch = useCallback((type: string, payload: unknown) => {
    const typed = (handlers.current[type] ?? []).slice();
    const wild  = (handlers.current['*']   ?? []).slice();
    [...typed, ...wild].forEach((h) => {
      try {
        h(payload, type);
      } catch (e) {
        reportError({
          source: 'webview-to-rn',
          message: 'Message handler threw an error',
          detail: { type, error: e },
        });
      }
    });
  }, [reportError]);

  const handleRawMessage = useCallback((data: string): BridgeMessage | null => {
    try {
      return JSON.parse(data) as BridgeMessage;
    } catch (e) {
      reportError({
        source: 'webview-to-rn',
        message: 'Failed to parse message from WebView',
        detail: { raw: data, error: e },
      });
      return null;
    }
  }, [reportError]);

  return { webViewRef, sendMessage, on, off, dispatch, handleRawMessage };
}

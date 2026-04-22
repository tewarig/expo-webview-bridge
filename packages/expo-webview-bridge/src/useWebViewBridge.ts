import { useRef, useCallback } from 'react';
import type { WebView } from 'react-native-webview';
import type { MessageHandler, Unsubscribe, BridgeMessage } from './types';

export function useWebViewBridge() {
  const webViewRef = useRef<WebView>(null);
  const handlers = useRef<Record<string, MessageHandler[]>>({});

  const sendMessage = useCallback(<T = unknown>(type: string, payload?: T) => {
    const script = `
      window.Bridge && window.Bridge._dispatch(
        ${JSON.stringify(type)},
        ${JSON.stringify(payload !== undefined ? payload : null)}
      );
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

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
        console.error('[WebViewBridge] handler error', e);
      }
    });
  }, []);

  const handleRawMessage = useCallback((data: string): BridgeMessage | null => {
    try {
      return JSON.parse(data) as BridgeMessage;
    } catch {
      return null;
    }
  }, []);

  return { webViewRef, sendMessage, on, off, dispatch, handleRawMessage };
}

import { useRef, useCallback } from 'react';
import type { WebView } from 'react-native-webview';
import type { BridgeError, BridgeMessage, MessageHandler, RequestOptions, Unsubscribe } from './types';

let _requestCounter = 0;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function useWebViewBridge(
  onErrorRef: React.RefObject<((error: BridgeError) => void) | undefined>,
) {
  const webViewRef = useRef<WebView>(null);
  const handlers = useRef<Record<string, MessageHandler[]>>({});
  const messageQueue = useRef<Array<() => void>>([]);
  const isBridgeReady = useRef(false);
  const pendingRequests = useRef<Record<string, PendingRequest>>({});

  const reportError = useCallback((error: BridgeError) => {
    onErrorRef.current?.(error);
  }, [onErrorRef]);

  const _doSend = useCallback(<T>(type: string, payload?: T, requestId?: string) => {
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

    const reqArg = requestId ? `, ${JSON.stringify(requestId)}` : '';
    const script = `window.Bridge && window.Bridge._dispatch(${JSON.stringify(type)}, ${serialized}${reqArg}); true;`;
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

  const sendMessage = useCallback(<T = unknown>(type: string, payload?: T) => {
    if (!isBridgeReady.current) {
      messageQueue.current.push(() => _doSend(type, payload));
      return;
    }
    _doSend(type, payload);
  }, [_doSend]);

  const sendRequest = useCallback(<Req = unknown, Res = unknown>(
    type: string,
    payload?: Req,
    options?: RequestOptions,
  ): Promise<Res> => {
    return new Promise<Res>((resolve, reject) => {
      const requestId = `${Date.now()}-${++_requestCounter}`;
      const timeoutMs = options?.timeout ?? 10000;

      const timer = setTimeout(() => {
        delete pendingRequests.current[requestId];
        reject(new Error(`[Bridge] Request "${type}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      pendingRequests.current[requestId] = {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      };

      if (!isBridgeReady.current) {
        messageQueue.current.push(() => _doSend(type, payload, requestId));
        return;
      }
      _doSend(type, payload, requestId);
    });
  }, [_doSend]);

  /** Called by WebViewBridge when __bridge_ready__ fires to drain the send queue. */
  const flushQueue = useCallback(() => {
    isBridgeReady.current = true;
    const queued = messageQueue.current.splice(0);
    queued.forEach((fn) => fn());
  }, []);

  /** Called by WebViewBridge when a __bridge_reply__ arrives. */
  const resolveRequest = useCallback((requestId: string, replyPayload: unknown) => {
    const pending = pendingRequests.current[requestId];
    if (!pending) return;
    clearTimeout(pending.timer);
    delete pendingRequests.current[requestId];
    pending.resolve(replyPayload);
  }, []);

  const on = useCallback(<T = unknown>(
    type: string,
    handler: MessageHandler<T>,
  ): Unsubscribe => {
    if (!handlers.current[type]) handlers.current[type] = [];
    handlers.current[type].push(handler as MessageHandler);
    return () => {
      if (!handlers.current[type]) return;
      handlers.current[type] = handlers.current[type].filter((h) => h !== handler);
    };
  }, []);

  const off = useCallback(<T = unknown>(type: string, handler: MessageHandler<T>) => {
    if (!handlers.current[type]) return;
    handlers.current[type] = handlers.current[type].filter((h) => h !== (handler as MessageHandler));
  }, []);

  const once = useCallback(<T = unknown>(
    type: string,
    handler: MessageHandler<T>,
  ): Unsubscribe => {
    const wrapper: MessageHandler<T> = (payload, t) => {
      off(type, wrapper as unknown as MessageHandler<T>);
      handler(payload, t);
    };
    return on(type, wrapper);
  }, [on, off]);

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

  return {
    webViewRef,
    sendMessage,
    sendRequest,
    on,
    once,
    off,
    dispatch,
    handleRawMessage,
    flushQueue,
    resolveRequest,
  };
}

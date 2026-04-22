import React, { forwardRef, useImperativeHandle, useCallback, useRef, useMemo } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { BRIDGE_SCRIPT } from './bridgeScript';
import { buildStorageScript } from './storageScript';
import { useWebViewBridge } from './useWebViewBridge';
import type { BridgeError, WebViewBridgeProps, WebViewBridgeRef } from './types';

const READY_TYPE = '__bridge_ready__';
const CLOSE_TYPE = '__bridge_close__';
const ERROR_TYPE = '__bridge_error__';
const REPLY_TYPE = '__bridge_reply__';

export const WebViewBridge = forwardRef<WebViewBridgeRef, WebViewBridgeProps>(
  function WebViewBridge(
    {
      onMessage,
      onReady,
      onClose,
      onBridgeError,
      initialParams,
      webStorage,
      injectedJavaScriptBeforeContentLoaded,
      ...props
    },
    ref,
  ) {
    // Store callbacks in refs so handleMessage never goes stale and never needs
    // to be recreated when the parent re-renders with new inline functions.
    const onBridgeErrorRef = useRef(onBridgeError);
    onBridgeErrorRef.current = onBridgeError;
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const {
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
    } = useWebViewBridge(onBridgeErrorRef);

    useImperativeHandle(ref, () => ({ sendMessage, sendRequest, on, once, off }), [
      sendMessage,
      sendRequest,
      on,
      once,
      off,
    ]);

    const preloadScript = useMemo(() => {
      const paramsScript = initialParams
        ? `window.__bridgeInitialParams = ${JSON.stringify(initialParams)};`
        : '';
      return [paramsScript, BRIDGE_SCRIPT, injectedJavaScriptBeforeContentLoaded]
        .filter(Boolean)
        .join('\n');
    }, [initialParams, injectedJavaScriptBeforeContentLoaded]);

    const postloadScript = useMemo(
      () => (webStorage ? buildStorageScript(webStorage) : undefined),
      [webStorage],
    );

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        const msg = handleRawMessage(event.nativeEvent.data);
        if (!msg) return;

        if (msg.type === READY_TYPE) {
          flushQueue();
          onReadyRef.current?.();
          return;
        }

        if (msg.type === CLOSE_TYPE) {
          onCloseRef.current?.();
          return;
        }

        if (msg.type === ERROR_TYPE) {
          onBridgeErrorRef.current?.(msg.payload as BridgeError);
          return;
        }

        if (msg.type === REPLY_TYPE) {
          const { requestId, payload } = msg.payload as { requestId: string; payload: unknown };
          resolveRequest(requestId, payload);
          return;
        }

        dispatch(msg.type, msg.payload);
        onMessageRef.current?.(msg.type, msg.payload);
      },
      [handleRawMessage, dispatch, flushQueue, resolveRequest],
    );

    return (
      <WebView
        ref={webViewRef}
        {...props}
        injectedJavaScriptBeforeContentLoaded={preloadScript}
        injectedJavaScript={postloadScript}
        onMessage={handleMessage}
      />
    );
  },
);

import React, { forwardRef, useImperativeHandle, useCallback } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { BRIDGE_SCRIPT } from './bridgeScript';
import { useWebViewBridge } from './useWebViewBridge';
import type { WebViewBridgeProps, WebViewBridgeRef } from './types';

const READY_TYPE = '__bridge_ready__';
const CLOSE_TYPE = '__bridge_close__';

export const WebViewBridge = forwardRef<WebViewBridgeRef, WebViewBridgeProps>(
  function WebViewBridge(
    { onMessage, onReady, onClose, initialParams, injectedJavaScriptBeforeContentLoaded, ...props },
    ref,
  ) {
    const { webViewRef, sendMessage, on, off, dispatch, handleRawMessage } =
      useWebViewBridge();

    useImperativeHandle(ref, () => ({ sendMessage, on, off }), [
      sendMessage,
      on,
      off,
    ]);

    // Inject initialParams before the bridge script so Bridge.params is available immediately
    const paramsScript = initialParams
      ? `window.__bridgeInitialParams = ${JSON.stringify(initialParams)};`
      : '';

    const combinedScript = [
      paramsScript,
      BRIDGE_SCRIPT,
      injectedJavaScriptBeforeContentLoaded,
    ]
      .filter(Boolean)
      .join('\n');

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        const msg = handleRawMessage(event.nativeEvent.data);
        if (!msg) return;

        if (msg.type === READY_TYPE) {
          onReady?.();
          return;
        }

        if (msg.type === CLOSE_TYPE) {
          onClose?.();
          return;
        }

        // fire hook-level subscriptions
        dispatch(msg.type, msg.payload);

        // fire prop-level callback
        onMessage?.(msg.type, msg.payload);
      },
      [handleRawMessage, dispatch, onMessage, onReady, onClose],
    );

    return (
      <WebView
        ref={webViewRef}
        {...props}
        injectedJavaScriptBeforeContentLoaded={combinedScript}
        onMessage={handleMessage}
      />
    );
  },
);

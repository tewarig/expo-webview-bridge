import React, { forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { BRIDGE_SCRIPT } from './bridgeScript';
import { buildStorageScript } from './storageScript';
import { useWebViewBridge } from './useWebViewBridge';
import type { BridgeError, WebViewBridgeProps, WebViewBridgeRef } from './types';

const READY_TYPE  = '__bridge_ready__';
const CLOSE_TYPE  = '__bridge_close__';
const ERROR_TYPE  = '__bridge_error__';

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
    // Use a ref so callbacks inside the hook never go stale without re-creating
    // the hook's memoised functions.
    const onBridgeErrorRef = useRef(onBridgeError);
    onBridgeErrorRef.current = onBridgeError;

    const { webViewRef, sendMessage, on, off, dispatch, handleRawMessage } =
      useWebViewBridge(onBridgeErrorRef);

    useImperativeHandle(ref, () => ({ sendMessage, on, off }), [
      sendMessage,
      on,
      off,
    ]);

    // ── Pre-load script ──────────────────────────────────────────────────────
    // Only initialParams + bridge run here so the bridge is always guaranteed
    // to initialise before the page's own scripts execute.
    const paramsScript = initialParams
      ? `window.__bridgeInitialParams = ${JSON.stringify(initialParams)};`
      : '';

    const preloadScript = [
      paramsScript,
      BRIDGE_SCRIPT,
      injectedJavaScriptBeforeContentLoaded,
    ]
      .filter(Boolean)
      .join('\n');

    // ── Post-load script ─────────────────────────────────────────────────────
    // webStorage runs after the page loads via injectedJavaScript, which is
    // more reliable for localStorage / sessionStorage / cookies because the
    // page has a proper browsing context by then.
    const postloadScript = webStorage ? buildStorageScript(webStorage) : undefined;

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

        if (msg.type === ERROR_TYPE) {
          onBridgeErrorRef.current?.(msg.payload as BridgeError);
          return;
        }

        dispatch(msg.type, msg.payload);
        onMessage?.(msg.type, msg.payload);
      },
      [handleRawMessage, dispatch, onMessage, onReady, onClose, onBridgeErrorRef],
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

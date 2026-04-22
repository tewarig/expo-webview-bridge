import React, { forwardRef, useImperativeHandle, useCallback } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { BRIDGE_SCRIPT } from './bridgeScript';
import { buildStorageScript, appendQueryParams } from './storageScript';
import { useWebViewBridge } from './useWebViewBridge';
import type { WebViewBridgeProps, WebViewBridgeRef } from './types';

const READY_TYPE = '__bridge_ready__';
const CLOSE_TYPE = '__bridge_close__';

export const WebViewBridge = forwardRef<WebViewBridgeRef, WebViewBridgeProps>(
  function WebViewBridge(
    {
      onMessage,
      onReady,
      onClose,
      initialParams,
      sourceParams,
      webStorage,
      injectedJavaScriptBeforeContentLoaded,
      source,
      ...props
    },
    ref,
  ) {
    const { webViewRef, sendMessage, on, off, dispatch, handleRawMessage } =
      useWebViewBridge();

    useImperativeHandle(ref, () => ({ sendMessage, on, off }), [
      sendMessage,
      on,
      off,
    ]);

    // Append sourceParams to the URI when source is a { uri } object
    const resolvedSource: WebViewProps['source'] =
      sourceParams &&
      source &&
      typeof source === 'object' &&
      'uri' in source &&
      source.uri
        ? { ...source, uri: appendQueryParams(source.uri, sourceParams) }
        : source;

    // Build the full injection script in order:
    // 1. webStorage (cookies / localStorage / sessionStorage)
    // 2. initialParams  → window.__bridgeInitialParams (read by Bridge.params)
    // 3. bridge script  → sets up window.Bridge
    // 4. caller's extra script
    const storageScript = webStorage ? buildStorageScript(webStorage) : '';
    const paramsScript  = initialParams
      ? `window.__bridgeInitialParams = ${JSON.stringify(initialParams)};`
      : '';

    const combinedScript = [
      storageScript,
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
        source={resolvedSource}
        injectedJavaScriptBeforeContentLoaded={combinedScript}
        onMessage={handleMessage}
      />
    );
  },
);

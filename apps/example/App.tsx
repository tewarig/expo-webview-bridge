/**
 * Example: bidirectional messaging between React Native and a local HTML page.
 *
 * RN → WebView: tap "Send to Web" button
 * WebView → RN:  web page calls Bridge.send() on button click
 */
import React, { useRef, useCallback, useState } from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
import { WebViewBridge, WebViewBridgeRef, BridgeError } from '@tewarig/expo-webview-bridge';

const HTML = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:20px">
  <h2>WebView side</h2>

  <p><strong>Bridge.params (available immediately):</strong></p>
  <pre id="params" style="background:#f4f4f4;padding:8px;border-radius:4px"></pre>

  <button onclick="Bridge.send('greeting', { text: 'Hello from the web!' })">
    Send to React Native
  </button>
  <button onclick="Bridge.close()" style="margin-left:8px;color:red">
    Close WebView
  </button>
  <button onclick="readStorage()" style="margin-left:8px">
    Read storage
  </button>

  <p id="msg">Waiting for RN message…</p>
  <pre id="storage" style="background:#f4f4f4;padding:8px;border-radius:4px"></pre>

  <script>
    // Bridge.params is available synchronously — injected before page load
    document.getElementById('params').textContent =
      JSON.stringify(Bridge.params, null, 2);

    // webStorage is applied post-load — read it on demand
    function readStorage() {
      document.getElementById('storage').textContent = JSON.stringify({
        cookie:    document.cookie,
        authToken: localStorage.getItem('authToken'),
        lastRoute: sessionStorage.getItem('lastRoute'),
      }, null, 2);
    }

    Bridge.on('ping', function(payload) {
      document.getElementById('msg').textContent =
        'RN says: ' + JSON.stringify(payload);
    });
  </script>
</body>
</html>
`;

const INITIAL_PARAMS = {
  user: 'Gaurav',
  theme: 'dark',
  apiBase: 'https://api.example.com',
};

const WEB_STORAGE = {
  cookies: [
    { name: 'session', value: 'xyz-session-token', path: '/', maxAge: 3600 },
    { name: 'locale',  value: 'en-IN',             path: '/' },
  ],
  localStorage: {
    authToken: 'Bearer eyJhbGciOiJIUzI1NiJ9',
  },
  sessionStorage: {
    lastRoute: '/dashboard',
  },
};

export default function App() {
  const bridgeRef = useRef<WebViewBridgeRef>(null);
  const [webViewVisible, setWebViewVisible] = useState(true);

  const sendPing = useCallback(() => {
    bridgeRef.current?.sendMessage('ping', { timestamp: Date.now() });
  }, []);

  const handleMessage = useCallback((type: string, payload: unknown) => {
    console.log('[RN] received:', type, payload);
  }, []);

  const handleReady = useCallback(() => {
    console.log('[RN] bridge ready');
  }, []);

  const handleClose = useCallback(() => {
    console.log('[RN] WebView requested close');
    setWebViewVisible(false);
  }, []);

  const handleError = useCallback((error: BridgeError) => {
    console.error('[RN] Bridge error:', error.source, error.message, error.detail);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>React Native side</Text>
      <View style={styles.row}>
        <Button title="Send ping" onPress={sendPing} />
        {!webViewVisible && (
          <Button title="Reopen WebView" onPress={() => setWebViewVisible(true)} />
        )}
      </View>

      {webViewVisible && (
        <WebViewBridge
          ref={bridgeRef}
          style={styles.webview}
          source={{ html: HTML }}
          initialParams={INITIAL_PARAMS}
          webStorage={WEB_STORAGE}
          onMessage={handleMessage}
          onReady={handleReady}
          onClose={handleClose}
          onBridgeError={handleError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  label:     { textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  row:       { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
  webview:   { flex: 1 },
});

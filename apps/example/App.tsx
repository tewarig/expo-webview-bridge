/**
 * Example: bidirectional messaging between React Native and a local HTML page.
 *
 * RN → WebView: tap "Send to Web" button
 * WebView → RN:  web page calls Bridge.send() on button click
 */
import React, { useRef, useCallback } from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
import { WebViewBridge, WebViewBridgeRef } from 'expo-webview-bridge';

const HTML = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:20px">
  <h2>WebView side</h2>
  <button onclick="Bridge.send('greeting', { text: 'Hello from the web!' })">
    Send to React Native
  </button>
  <p id="msg">Waiting for RN message…</p>
  <script>
    Bridge.on('ping', function(payload) {
      document.getElementById('msg').textContent =
        'RN says: ' + JSON.stringify(payload);
    });
  </script>
</body>
</html>
`;

export default function App() {
  const bridgeRef = useRef<WebViewBridgeRef>(null);

  const sendPing = useCallback(() => {
    bridgeRef.current?.sendMessage('ping', { timestamp: Date.now() });
  }, []);

  const handleMessage = useCallback((type: string, payload: unknown) => {
    console.log('[RN] received:', type, payload);
  }, []);

  const handleReady = useCallback(() => {
    console.log('[RN] bridge ready');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>React Native side</Text>
      <Button title="Send ping to WebView" onPress={sendPing} />
      <WebViewBridge
        ref={bridgeRef}
        style={styles.webview}
        source={{ html: HTML }}
        onMessage={handleMessage}
        onReady={handleReady}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  label:     { textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  webview:   { flex: 1, marginTop: 12 },
});

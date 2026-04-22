/**
 * Injected into the WebView before content loads.
 * Exposes window.Bridge on the web side with:
 *   Bridge.send(type, payload)  — send a message to React Native
 *   Bridge.on(type, handler)    — subscribe to messages from React Native (returns unsubscribe fn)
 *   Bridge.off(type, handler)   — unsubscribe a handler
 *   Bridge.on('*', handler)     — wildcard: receive all message types
 */
export const BRIDGE_SCRIPT = `
(function () {
  if (window.__rnBridgeInitialized) return;
  window.__rnBridgeInitialized = true;

  var _handlers = {};

  function _addHandler(type, fn) {
    if (!_handlers[type]) _handlers[type] = [];
    _handlers[type].push(fn);
  }

  function _removeHandler(type, fn) {
    if (!_handlers[type]) return;
    _handlers[type] = _handlers[type].filter(function (h) { return h !== fn; });
  }

  function _dispatch(type, payload) {
    var typed = (_handlers[type] || []).slice();
    var wild  = (_handlers['*']   || []).slice();
    typed.concat(wild).forEach(function (h) {
      try { h(payload, type); } catch (e) { console.error('[Bridge] handler error', e); }
    });
  }

  window.Bridge = {
    /** Send a message to React Native */
    send: function (type, payload) {
      if (!window.ReactNativeWebView) {
        console.warn('[Bridge] ReactNativeWebView not available');
        return;
      }
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: type, payload: payload !== undefined ? payload : null })
      );
    },

    /** Listen for a message type from React Native. Returns an unsubscribe function. */
    on: function (type, handler) {
      _addHandler(type, handler);
      return function () { _removeHandler(type, handler); };
    },

    /** Remove a specific handler */
    off: function (type, handler) {
      _removeHandler(type, handler);
    },

    /** @internal — called by the RN side to push messages into the WebView */
    _dispatch: _dispatch,
  };

  // Notify React Native that the bridge is ready
  window.Bridge.send('__bridge_ready__', null);
})();
true; // required by injectedJavaScriptBeforeContentLoaded
`;

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppColors } from '@/constants/theme';

// Cloudflare Turnstile site key. When empty, captcha is disabled app-wide
// (Supabase-side enforcement must also be off) — lets dev builds work before
// keys exist and keeps Expo Go usable.
export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';
export const captchaEnabled = TURNSTILE_SITE_KEY.length > 0;

// Turnstile validates the page hostname against the widget's allowed list, so
// the WebView must claim a real domain we control. kevyn04.github.io already
// hosts the privacy policy — add it to the widget's hostnames in the
// Cloudflare dashboard.
const TURNSTILE_BASE_URL = 'https://kevyn04.github.io';

type Props = {
  visible: boolean;
  onToken: (token: string) => void;
  onCancel: () => void;
};

export function TurnstileModal({ visible, onToken, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstile" async defer></script>
<style>
  html,body{margin:0;height:100%;background:transparent;display:flex;align-items:center;justify-content:center}
</style>
</head><body><div id="cf"></div>
<script>
  function post(msg){ window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function onloadTurnstile(){
    turnstile.render('#cf', {
      sitekey: ${JSON.stringify(TURNSTILE_SITE_KEY)},
      theme: 'dark',
      callback: function(token){ post({ type: 'token', token: token }); },
      'error-callback': function(code){ post({ type: 'error', code: String(code) }); return true; },
      'expired-callback': function(){ post({ type: 'expired' }); }
    });
    post({ type: 'ready' });
  }
</script></body></html>`,
    []
  );

  // Loaded lazily: react-native-webview is a native module that only exists in
  // builds made after it was added. The modal never opens while the site key
  // is unset, so pre-webview dev builds keep working.
  const WebView = visible
    ? (require('react-native-webview') as typeof import('react-native-webview')).WebView
    : null;

  const handleMessage = (raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'ready') setLoading(false);
      else if (msg.type === 'token') onToken(msg.token);
      else if (msg.type === 'error') setError('Verification failed. Please try again.');
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Quick check</Text>
          <Text style={styles.subtitle}>Confirm you&apos;re human to continue.</Text>

          <View style={styles.webviewBox}>
            {visible && WebView && (
              <WebView
                originWhitelist={['*']}
                source={{ html, baseUrl: TURNSTILE_BASE_URL }}
                onMessage={(e) => handleMessage(e.nativeEvent.data)}
                style={styles.webview}
                containerStyle={{ backgroundColor: 'transparent' }}
                scrollEnabled={false}
              />
            )}
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={AppColors.red} />
              </View>
            )}
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 400, borderRadius: 16,
    backgroundColor: AppColors.bgMid, borderWidth: 1, borderColor: AppColors.border,
    padding: 20,
  },
  title: {
    fontSize: 18, fontFamily: 'Cinzel_700Bold', letterSpacing: 1,
    color: AppColors.text, marginBottom: 4,
  },
  subtitle: { fontSize: 13, color: AppColors.textSub, marginBottom: 16 },
  webviewBox: { height: 110, borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: AppColors.bgMid,
  },
  errorText: { color: AppColors.red, fontSize: 13, marginTop: 12 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  cancelText: { color: AppColors.textMuted, fontSize: 13, letterSpacing: 0.5 },
});

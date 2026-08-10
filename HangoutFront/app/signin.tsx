import React, { useState, useRef, useMemo } from "react";
import {
  View, Text, TextInput, StyleSheet, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { signIn, signInWithApple, signInWithGoogle } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import type { ThemeColors } from "@/constants/theme";
import { TurnstileModal, captchaEnabled } from "@/components/TurnstileModal";

export default function SignInScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState("");
  const [showCaptcha, setShowCaptcha] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const handleSignIn = () => {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    if (captchaEnabled) {
      setShowCaptcha(true);
    } else {
      doSignIn();
    }
  };

  const doSignIn = async (captchaToken?: string) => {
    setShowCaptcha(false);
    setSubmitting(true);
    try {
      const data = await signIn(username.trim(), password, captchaToken);
      await login(data.username);
      router.dismissAll();
    } catch (e: any) {
      setError(e.message || "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError("");
    setOauthLoading("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("No identity token");
      await signInWithApple(credential.identityToken);
      // auth-context onAuthStateChange handles the rest (sets user or needsUsername)
      router.dismissAll();
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        setError(e.message || "Apple sign-in failed.");
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setOauthLoading("google");
    try {
      const result = await signInWithGoogle();
      if (result === "success") {
        router.dismissAll();
      }
    } catch (e: any) {
      setError(e.message || "Google sign-in failed.");
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.gradient} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>Sign In</Text>

          {/* ── OAuth buttons ── */}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            style={styles.appleBtn}
            onPress={handleAppleSignIn}
          />

          <Pressable
            style={[styles.googleBtn, oauthLoading === "google" && { opacity: 0.6 }]}
            onPress={handleGoogleSignIn}
            disabled={!!oauthLoading}
          >
            {oauthLoading === "google"
              ? <ActivityIndicator color={colors.btnLightText} size="small" />
              : <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
            }
          </Pressable>

          {/* ── Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Username / password ── */}
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your username"
            placeholderTextColor={colors.textGhost}
            autoCapitalize="none"
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={username}
            onChangeText={(v) => { setUsername(v); setError(""); }}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, styles.passwordInput]}
              placeholder="Enter your password"
              placeholderTextColor={colors.textGhost}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(""); }}
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Text style={styles.eyeBtnText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.submitBtn, (submitting || !!oauthLoading) && styles.disabled]}
            onPress={handleSignIn}
            disabled={submitting || !!oauthLoading}
          >
            {submitting
              ? <ActivityIndicator color={colors.btnLightText} />
              : <Text style={styles.submitBtnText}>Sign In</Text>
            }
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <TurnstileModal
        visible={showCaptcha}
        onToken={(token) => doSignIn(token)}
        onCancel={() => setShowCaptcha(false)}
      />
    </View>
  );
}

function buildStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, backgroundColor: colors.bgDeep, alignItems: "center", justifyContent: "center" },
    scroll: { padding: 24, paddingTop: 20, paddingBottom: 40 },
    heading: {
      fontSize: 28, fontFamily: "Cinzel_700Bold",
      color: colors.text, letterSpacing: 1, marginBottom: 24,
    },

    appleBtn: { width: "100%", height: 48, marginBottom: 12 },

    googleBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      height: 48, borderRadius: 14, backgroundColor: "#fff",
      gap: 10, marginBottom: 24,
    },
    googleG: { fontSize: 18, fontWeight: "700", color: "#4285F4" },
    googleBtnText: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },

    dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 13, color: colors.textMuted },

    label: {
      fontSize: 14, fontFamily: "Cinzel_700Bold",
      letterSpacing: 1, color: colors.textSub, marginBottom: 8,
    },
    input: {
      height: 48, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      paddingHorizontal: 16, fontSize: 16, color: colors.text, marginBottom: 20,
    },
    passwordRow: { position: "relative", marginBottom: 20 },
    passwordInput: { marginBottom: 0, paddingRight: 72 },
    eyeBtn: {
      position: "absolute", right: 0, top: 0,
      height: 48, paddingHorizontal: 16,
      alignItems: "center", justifyContent: "center",
    },
    eyeBtnText: { fontSize: 12, fontFamily: "Cinzel_700Bold", letterSpacing: 0.5, color: colors.textMuted },
    errorText: { color: colors.red, fontSize: 13, marginBottom: 16, lineHeight: 18 },
    submitBtn: {
      height: 48, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.btnLight, marginTop: 10,
    },
    submitBtnText: { fontSize: 14, letterSpacing: 1.5, color: colors.btnLightText, fontFamily: "Cinzel_700Bold" },
    disabled: { opacity: 0.6 },
  });
}

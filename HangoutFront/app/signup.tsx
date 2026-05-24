import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useRouter } from "expo-router";
import { signUp } from "@/services/api";
import { AppColors } from "@/constants/theme";

export default function SignUpScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<TextInput>(null);

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  const handleSignUp = async () => {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(username.trim(), password);
      Alert.alert("Account Created", "You can now sign in.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e.message || "Sign up failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={AppColors.gradient} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>Sign Up</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Choose a username"
            placeholderTextColor={AppColors.textGhost}
            autoCapitalize="none"
            autoComplete="username-new"
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
              placeholder="Choose a password"
              placeholderTextColor={AppColors.textGhost}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(""); }}
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              accessibilityRole="button"
            >
              <Text style={styles.eyeBtnText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.pressed,
              submitting && styles.disabled,
            ]}
            onPress={handleSignUp}
            disabled={submitting}
            accessibilityLabel="Create your account"
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={AppColors.btnLightText} />
            ) : (
              <Text style={styles.submitBtnText}>Sign Up</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: AppColors.bgDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { padding: 24, paddingTop: 20, paddingBottom: 40 },
  heading: {
    fontSize: 28,
    fontFamily: "Cinzel_700Bold",
    color: AppColors.text,
    letterSpacing: 1,
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 1,
    color: AppColors.textSub,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.card,
    paddingHorizontal: 16,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 20,
  },
  passwordRow: { position: "relative", marginBottom: 20 },
  passwordInput: { marginBottom: 0, paddingRight: 72 },
  eyeBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    height: 48,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeBtnText: {
    fontSize: 12,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 0.5,
    color: AppColors.textMuted,
  },
  errorText: {
    color: AppColors.red,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.btnLight,
    marginTop: 10,
  },
  submitBtnText: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: AppColors.btnLightText,
    fontFamily: "Cinzel_700Bold",
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  disabled: { opacity: 0.6 },
});

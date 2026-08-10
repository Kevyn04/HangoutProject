import React, { useState, useMemo } from "react";
import {
  View, Text, TextInput, StyleSheet, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import type { ThemeColors } from "@/constants/theme";

export default function ChooseUsernameScreen() {
  const { createProfile } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  if (!fontsLoaded) return null;

  const handleSubmit = async () => {
    const trimmed = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!trimmed || trimmed.length < 3) {
      setError("Username must be at least 3 characters (letters, numbers, underscores).");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await createProfile(trimmed);
      // auth-context sets user + needsUsername=false → _layout redirects away
    } catch (e: any) {
      setError(e.message || "Could not set username. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={colors.gradient} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll}>

          <Text style={s.heading}>One last thing</Text>
          <Text style={s.sub}>Choose a username to use in The Hangout.</Text>

          <Text style={s.label}>Username</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. coolkid99"
            placeholderTextColor={colors.textGhost}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            value={username}
            onChangeText={(v) => { setUsername(v); setError(""); }}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />
          <Text style={s.hint}>Letters, numbers, underscores only. Min 3 characters.</Text>

          {!!error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={[s.btn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={colors.btnLightText} />
              : <Text style={s.btnText}>Continue</Text>
            }
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function buildStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 24, paddingTop: 60, paddingBottom: 40 },
    heading: {
      fontSize: 28, fontFamily: "Cinzel_700Bold",
      color: colors.text, letterSpacing: 1, marginBottom: 8,
    },
    sub: { fontSize: 15, color: colors.textSub, marginBottom: 32, lineHeight: 22 },
    label: {
      fontSize: 14, fontFamily: "Cinzel_700Bold",
      letterSpacing: 1, color: colors.textSub, marginBottom: 8,
    },
    input: {
      height: 48, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.card,
      paddingHorizontal: 16, fontSize: 16, color: colors.text,
    },
    hint: { fontSize: 12, color: colors.textMuted, marginTop: 6, marginBottom: 16 },
    error: { color: colors.red, fontSize: 13, marginBottom: 16 },
    btn: {
      height: 48, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.btnLight, marginTop: 8,
    },
    btnText: {
      fontSize: 14, letterSpacing: 1.5,
      color: colors.btnLightText, fontFamily: "Cinzel_700Bold",
    },
  });
}

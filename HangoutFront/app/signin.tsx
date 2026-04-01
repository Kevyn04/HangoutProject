import React, { useState } from "react";
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
import { signIn } from "@/services/api";
import { useAuth } from "@/services/auth-context";

export default function SignInScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  const handleSignIn = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter both username and password.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await signIn(username.trim(), password);
      await login(data.username);
      router.dismissAll();
    } catch (e: any) {
      Alert.alert("Sign In Failed", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#120303", "#3b0d0d", "#7a1f1f"]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>Sign In</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your username"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.pressed,
              submitting && styles.disabled,
            ]}
            onPress={handleSignIn}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#0b0b0f" />
            ) : (
              <Text style={styles.submitBtnText}>Sign In</Text>
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
    backgroundColor: "#0b0b0f",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { padding: 24, paddingTop: 20, paddingBottom: 40 },
  heading: {
    fontSize: 28,
    fontFamily: "Cinzel_700Bold",
    color: "#fff",
    letterSpacing: 1,
    marginBottom: 30,
  },
  label: {
    fontSize: 13,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#fff",
    marginBottom: 20,
  },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    marginTop: 10,
  },
  submitBtnText: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#0b0b0f",
    fontFamily: "Cinzel_700Bold",
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  disabled: { opacity: 0.6 },
});

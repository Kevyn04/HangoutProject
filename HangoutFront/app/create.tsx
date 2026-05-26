import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useRouter } from "expo-router";
import { createEvent } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import * as Location from "expo-location";
import { AppColors } from "@/constants/theme";

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const locationRef = useRef<TextInput>(null);
  const timeRef     = useRef<TextInput>(null);

  useEffect(() => {
    if (!user) { router.replace("/signin"); return; }
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coordsRef.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
    })();
  }, [user]);

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  const handleSubmit = async () => {
    setError("");
    if (!title.trim() || !location.trim() || !time.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      await createEvent({
        title: title.trim(),
        location: location.trim(),
        time: time.trim(),
        createdBy: user!,
        ...(coordsRef.current && {
          latitude: coordsRef.current.latitude,
          longitude: coordsRef.current.longitude,
        }),
      });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create event.");
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
          <Text style={styles.heading}>Create Hangout</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Friday Night Chill"
            placeholderTextColor={AppColors.textGhost}
            returnKeyType="next"
            onSubmitEditing={() => locationRef.current?.focus()}
            value={title}
            onChangeText={(v) => { setTitle(v); setError(""); }}
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            ref={locationRef}
            style={styles.input}
            placeholder="e.g. Bloomsburg"
            placeholderTextColor={AppColors.textGhost}
            returnKeyType="next"
            onSubmitEditing={() => timeRef.current?.focus()}
            value={location}
            onChangeText={(v) => { setLocation(v); setError(""); }}
          />

          <Text style={styles.label}>Time</Text>
          <TextInput
            ref={timeRef}
            style={styles.input}
            placeholder="e.g. 7:00 PM"
            placeholderTextColor={AppColors.textGhost}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            value={time}
            onChangeText={(v) => { setTime(v); setError(""); }}
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.pressed,
              submitting && styles.disabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityLabel="Create hangout"
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={AppColors.btnLightText} />
            ) : (
              <Text style={styles.submitBtnText}>Create</Text>
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

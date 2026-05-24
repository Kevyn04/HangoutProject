import React, { useState, useRef } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { updateEvent } from "@/services/api";
import { AppColors } from "@/constants/theme";

export default function EditEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    location: string;
    time: string;
    createdBy: string;
  }>();

  const [title, setTitle]       = useState(params.title ?? "");
  const [location, setLocation] = useState(params.location ?? "");
  const [time, setTime]         = useState(params.time ?? "");
  const [createdBy, setCreatedBy] = useState(params.createdBy ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const locationRef  = useRef<TextInput>(null);
  const timeRef      = useRef<TextInput>(null);
  const createdByRef = useRef<TextInput>(null);

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
    if (!title.trim() || !location.trim() || !time.trim() || !createdBy.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      await updateEvent(Number(params.id), {
        title: title.trim(),
        location: location.trim(),
        time: time.trim(),
        createdBy: createdBy.trim(),
      });
      router.dismissAll();
    } catch {
      setError("Failed to update hangout. Please try again.");
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
          <Text style={styles.heading}>Edit Hangout</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
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
            placeholderTextColor={AppColors.textGhost}
            returnKeyType="next"
            onSubmitEditing={() => createdByRef.current?.focus()}
            value={time}
            onChangeText={(v) => { setTime(v); setError(""); }}
          />

          <Text style={styles.label}>Your Name</Text>
          <TextInput
            ref={createdByRef}
            style={styles.input}
            placeholderTextColor={AppColors.textGhost}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            value={createdBy}
            onChangeText={(v) => { setCreatedBy(v); setError(""); }}
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
            accessibilityLabel="Save changes to this hangout"
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={AppColors.btnLightText} />
            ) : (
              <Text style={styles.submitBtnText}>Save</Text>
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

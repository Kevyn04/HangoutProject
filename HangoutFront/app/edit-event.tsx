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
import { useLocalSearchParams, useRouter } from "expo-router";
import { updateEvent } from "@/services/api";

export default function EditEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    location: string;
    time: string;
    createdBy: string;
  }>();

  const [title, setTitle] = useState(params.title ?? "");
  const [location, setLocation] = useState(params.location ?? "");
  const [time, setTime] = useState(params.time ?? "");
  const [createdBy, setCreatedBy] = useState(params.createdBy ?? "");
  const [submitting, setSubmitting] = useState(false);

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim() || !location.trim() || !time.trim() || !createdBy.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
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
      Alert.alert("Error", "Failed to update hangout.");
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
          <Text style={styles.heading}>Edit Hangout</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={location}
            onChangeText={setLocation}
          />

          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={time}
            onChangeText={setTime}
          />

          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={createdBy}
            onChangeText={setCreatedBy}
          />

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.pressed,
              submitting && styles.disabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#0b0b0f" />
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0b0b0f",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
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
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
});

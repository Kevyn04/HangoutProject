import React, { useState, useEffect, useRef } from "react";
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
import { createEvent } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import * as Location from "expo-location";

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("");
  const [createdBy, setCreatedBy] = useState(user ?? "");
  const [submitting, setSubmitting] = useState(false);
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coordsRef.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
    })();
  }, []);

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
      await createEvent({
        title: title.trim(),
        location: location.trim(),
        time: time.trim(),
        createdBy: createdBy.trim(),
        ...(coordsRef.current && {
          latitude: coordsRef.current.latitude,
          longitude: coordsRef.current.longitude,
        }),
      });
      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to create hangout. Is the backend running?");
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
          <Text style={styles.heading}>Create Hangout</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Friday Night Chill"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Bloomsburg"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={location}
            onChangeText={setLocation}
          />

          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 7:00 PM"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={time}
            onChangeText={setTime}
          />

          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kevyn"
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
              <Text style={styles.submitBtnText}>Create</Text>
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

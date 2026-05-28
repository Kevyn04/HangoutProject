import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useRouter } from "expo-router";
import { createEvent } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import * as Location from "expo-location";
import { AppColors } from "@/constants/theme";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import DateTimePicker from "@react-native-community/datetimepicker";

const BLOOMSBURG_REGION = {
  latitude: 41.0026, longitude: -76.4547,
  latitudeDelta: 0.02, longitudeDelta: 0.02,
};

function formatEventDate(d: Date): string {
  return d.toLocaleString([], {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const EVENT_TYPES = ["Hangout", "Munchies", "Secret Location", "Sports", "Games"];

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState<string>("Hangout");
  const [eventDate, setEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    return d;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [androidStep, setAndroidStep] = useState<"date" | "time">("date");

  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const locationRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!user) { router.replace("/signin"); return; }
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPinCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, [user]);

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  if (!fontsLoaded) {
    return <View style={s.loading}><ActivityIndicator size="large" color="white" /></View>;
  }

  const onDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
      if (selected) {
        const merged = new Date(eventDate);
        if (androidStep === "date") {
          merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
          setEventDate(merged);
          setAndroidStep("time");
          setTimeout(() => setShowDatePicker(true), 100);
        } else {
          merged.setHours(selected.getHours(), selected.getMinutes());
          setEventDate(merged);
          setAndroidStep("date");
        }
      }
    } else if (selected) {
      setEventDate(selected);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!title.trim() || !location.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      await createEvent({
        title: title.trim(),
        location: location.trim(),
        time: formatEventDate(eventDate),
        createdBy: user!,
        type: eventType,
        ...(pinCoords && { latitude: pinCoords.latitude, longitude: pinCoords.longitude }),
      });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create event.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={AppColors.gradient} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.heading}>Create Event</Text>

          <Text style={s.label}>Title</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Friday Night Chill"
            placeholderTextColor={AppColors.textGhost}
            returnKeyType="next"
            onSubmitEditing={() => locationRef.current?.focus()}
            value={title}
            onChangeText={(v) => { setTitle(v); setError(""); }}
          />

          <Text style={s.label}>Location</Text>
          <TextInput
            ref={locationRef}
            style={s.input}
            placeholder="e.g. Bloomsburg"
            placeholderTextColor={AppColors.textGhost}
            returnKeyType="done"
            value={location}
            onChangeText={(v) => { setLocation(v); setError(""); }}
          />

          <Text style={s.label}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {EVENT_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setEventType(t)}
                style={[s.typeChip, eventType === t && s.typeChipActive]}
              >
                <Text style={[s.typeChipText, eventType === t && s.typeChipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={s.label}>Date & Time</Text>
          <Pressable
            style={[s.input, s.inputPressable]}
            onPress={() => { setAndroidStep("date"); setShowDatePicker(true); }}
          >
            <Text style={{ color: AppColors.text, fontSize: 16 }}>{formatEventDate(eventDate)}</Text>
          </Pressable>

          {Platform.OS === "android" && showDatePicker && (
            <DateTimePicker value={eventDate} mode={androidStep} onChange={onDateChange} />
          )}

          <Text style={s.label}>Pin on Map</Text>
          <Pressable style={s.mapPreview} onPress={() => setShowMapPicker(true)}>
            {pinCoords ? (
              <MapView
                style={StyleSheet.absoluteFill}
                provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                region={{ ...pinCoords, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                scrollEnabled={false} zoomEnabled={false} pointerEvents="none"
              >
                <Marker coordinate={pinCoords} pinColor="#dc2626" />
              </MapView>
            ) : (
              <View style={s.mapEmpty}>
                <Text style={s.mapEmptyText}>Waiting for GPS…</Text>
              </View>
            )}
            <View style={s.mapOverlay}>
              <Text style={s.mapOverlayText}>Tap to adjust pin</Text>
            </View>
          </Pressable>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <Pressable
            style={[s.submitBtn, submitting && s.disabled]}
            onPress={handleSubmit} disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={AppColors.btnLightText} />
              : <Text style={s.submitBtnText}>Create</Text>
            }
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* iOS date picker modal */}
      {Platform.OS === "ios" && (
        <Modal visible={showDatePicker} transparent animationType="slide">
          <Pressable style={s.pickerBackdrop} onPress={() => setShowDatePicker(false)} />
          <View style={s.pickerSheet}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Date & Time</Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Text style={s.pickerDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={eventDate} mode="datetime" display="spinner"
              onChange={onDateChange} textColor="#fff"
              style={{ height: 200 }}
            />
          </View>
        </Modal>
      )}

      {/* Map pin picker modal */}
      <Modal visible={showMapPicker} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
            initialRegion={
              pinCoords
                ? { ...pinCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }
                : BLOOMSBURG_REGION
            }
            onPress={(e) => setPinCoords(e.nativeEvent.coordinate)}
          >
            {pinCoords && <Marker coordinate={pinCoords} pinColor="#dc2626" />}
          </MapView>
          <View style={s.mapModalHeader}>
            <Text style={s.mapModalTitle}>Tap the map to place pin</Text>
            <Pressable style={s.mapModalDone} onPress={() => setShowMapPicker(false)}>
              <Text style={s.mapModalDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, backgroundColor: AppColors.bgDeep, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 24, paddingTop: 20, paddingBottom: 40 },
  heading: { fontSize: 28, fontFamily: "Cinzel_700Bold", color: AppColors.text, letterSpacing: 1, marginBottom: 30 },
  label: { fontSize: 14, fontFamily: "Cinzel_700Bold", letterSpacing: 1, color: AppColors.textSub, marginBottom: 8 },
  input: {
    height: 48, borderRadius: 14, borderWidth: 1,
    borderColor: AppColors.border, backgroundColor: AppColors.card,
    paddingHorizontal: 16, fontSize: 16, color: AppColors.text, marginBottom: 20,
  },
  inputPressable: { justifyContent: "center" },
  errorText: { color: AppColors.red, fontSize: 13, marginBottom: 16, lineHeight: 18 },
  submitBtn: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: AppColors.btnLight, marginTop: 10 },
  submitBtnText: { fontSize: 14, letterSpacing: 1.5, color: AppColors.btnLightText, fontFamily: "Cinzel_700Bold" },
  disabled: { opacity: 0.6 },

  mapPreview: { height: 130, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: AppColors.border },
  mapEmpty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: AppColors.card },
  mapEmptyText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  mapOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", paddingVertical: 5, alignItems: "center",
  },
  mapOverlayText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },

  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  pickerSheet: { backgroundColor: "#1a0808", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  pickerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pickerDone: { color: "#dc2626", fontSize: 16, fontWeight: "700" },

  mapModalHeader: {
    position: "absolute", top: 56, left: 16, right: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(18,3,3,0.88)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  mapModalTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  mapModalDone: { backgroundColor: "#dc2626", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  mapModalDoneText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  typeChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: AppColors.border,
    backgroundColor: AppColors.card,
  },
  typeChipActive: { backgroundColor: AppColors.red, borderColor: AppColors.red },
  typeChipText: { color: AppColors.textSub, fontSize: 14, fontWeight: "600" },
  typeChipTextActive: { color: "#fff" },
});

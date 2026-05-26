import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useLocalSearchParams, useRouter } from "expo-router";
import { updateEvent } from "@/services/api";
import { AppColors } from "@/constants/theme";
import DateTimePicker from "@react-native-community/datetimepicker";

function formatEventDate(d: Date): string {
  return d.toLocaleString([], {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function EditEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; title: string; location: string; time: string; createdBy: string }>();

  const [title, setTitle]       = useState(params.title ?? "");
  const [location, setLocation] = useState(params.location ?? "");
  const [eventDate, setEventDate] = useState(() => {
    const parsed = new Date(params.time ?? "");
    if (isNaN(parsed.getTime())) {
      const d = new Date();
      d.setHours(19, 0, 0, 0);
      return d;
    }
    return parsed;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [androidStep, setAndroidStep] = useState<"date" | "time">("date");

  const locationRef = React.useRef<TextInput>(null);

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
      await updateEvent(Number(params.id), {
        title: title.trim(),
        location: location.trim(),
        time: formatEventDate(eventDate),
        createdBy: params.createdBy ?? "",
      });
      router.dismissAll();
    } catch {
      setError("Failed to update event. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={AppColors.gradient} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.heading}>Edit Event</Text>

          <Text style={s.label}>Title</Text>
          <TextInput
            style={s.input}
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
            placeholderTextColor={AppColors.textGhost}
            returnKeyType="done"
            value={location}
            onChangeText={(v) => { setLocation(v); setError(""); }}
          />

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

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <Pressable
            style={[s.submitBtn, submitting && s.disabled]}
            onPress={handleSubmit} disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={AppColors.btnLightText} />
              : <Text style={s.submitBtnText}>Save</Text>
            }
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

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
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  pickerSheet: { backgroundColor: "#1a0808", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  pickerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pickerDone: { color: "#dc2626", fontSize: 16, fontWeight: "700" },
});

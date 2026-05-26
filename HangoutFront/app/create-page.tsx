import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/services/auth-context";
import { createPage } from "@/services/api";

const CATEGORIES = ["Nightlife", "Community", "Art", "Music", "Sports", "Food", "Culture"];
const AVATAR_COLORS = ["#7c3aed", "#dc2626", "#0ea5e9", "#16a34a", "#ea580c", "#db2777"];

const CATEGORY_COLORS: Record<string, string> = {
  Nightlife: "#7c3aed", Community: "#0ea5e9", Art: "#ea580c",
  Music: "#dc2626", Sports: "#16a34a", Food: "#ca8a04", Culture: "#db2777",
};

export default function CreatePageScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Nightlife");
  const [avatarColor, setAvatarColor] = useState("#7c3aed");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert("Name required"); return; }
    if (!user) { router.push("/signin"); return; }
    setSubmitting(true);
    try {
      await createPage({ name: name.trim(), description, category, createdBy: user, avatarColor });
      router.back();
    } catch {
      Alert.alert("Error", "Could not create page. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

      {/* Live preview */}
      <View style={s.preview}>
        <View style={[s.previewAvatar, { backgroundColor: avatarColor }]}>
          <Text style={s.previewAvatarText}>{initial}</Text>
        </View>
        <Text style={s.previewName}>{name.trim() || "Page Name"}</Text>
        <View style={[s.catBadge, { backgroundColor: `${CATEGORY_COLORS[category] ?? "#7c3aed"}22` }]}>
          <Text style={[s.catBadgeText, { color: CATEGORY_COLORS[category] ?? "#c4b5fd" }]}>{category}</Text>
        </View>
      </View>

      {/* Form */}
      <Text style={s.label}>Page Name *</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 2degreesnyc"
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={name}
        onChangeText={setName}
        maxLength={60}
        autoFocus
      />

      <Text style={s.label}>Description</Text>
      <TextInput
        style={[s.input, s.textArea]}
        placeholder="What is this page about?"
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
      />

      <Text style={s.label}>Category</Text>
      <View style={s.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          const color = CATEGORY_COLORS[cat] ?? "#7c3aed";
          return (
            <Pressable
              key={cat}
              style={[s.catChip, active && { backgroundColor: `${color}22`, borderColor: color }]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[s.catChipText, active && { color }]}>{cat}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>Avatar Color</Text>
      <View style={s.colorRow}>
        {AVATAR_COLORS.map((c) => (
          <Pressable
            key={c}
            style={[s.colorDot, { backgroundColor: c }, avatarColor === c && s.colorDotActive]}
            onPress={() => setAvatarColor(c)}
          />
        ))}
      </View>

      <Pressable
        style={[s.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#0b0b0f" />
          : <Text style={s.submitBtnText}>Create Page</Text>
        }
      </Pressable>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#120303" },
  scroll: { padding: 20, paddingBottom: 48 },

  preview: { alignItems: "center", paddingVertical: 24, gap: 8, marginBottom: 8 },
  previewAvatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  previewAvatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  previewName: { color: "#fff", fontSize: 20, fontWeight: "700" },
  catBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  catBadgeText: { fontSize: 12, fontWeight: "700" },

  label: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  catChipText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },

  colorRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff" },

  submitBtn: {
    marginTop: 32, height: 50, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  submitBtnText: { color: "#0b0b0f", fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },
});

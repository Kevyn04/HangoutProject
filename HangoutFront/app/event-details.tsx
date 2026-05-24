import React from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteEvent } from "@/services/api";

export default function EventDetailsScreen() {
  const router = useRouter();
  const { id, title, location, time, createdBy } = useLocalSearchParams<{
    id: string;
    title: string;
    location: string;
    time: string;
    createdBy: string;
  }>();

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  if (!fontsLoaded) return null;

  const handleDelete = () => {
    Alert.alert("Delete Hangout", `Are you sure you want to delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(Number(id));
            router.back();
          } catch {
            Alert.alert("Error", "Failed to delete hangout.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#120303", "#3b0d0d", "#7a1f1f"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Location</Text>
            <Text style={styles.value}>{location}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Time</Text>
            <Text style={styles.value}>{time}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Created By</Text>
            <Text style={styles.value}>{createdBy}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
            onPress={() =>
              router.push({
                pathname: "/edit-event",
                params: { id, title, location, time, createdBy },
              })
            }
            accessibilityLabel="Edit this hangout"
            accessibilityRole="button"
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            onPress={handleDelete}
            accessibilityLabel="Delete this hangout"
            accessibilityRole="button"
          >
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 24,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  label: {
    fontSize: 13,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.5)",
  },
  value: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  editBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  editBtnText: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#0b0b0f",
    fontFamily: "Cinzel_700Bold",
  },
  deleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.6)",
    backgroundColor: "rgba(220,38,38,0.15)",
  },
  deleteBtnText: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#dc2626",
    fontFamily: "Cinzel_700Bold",
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/services/auth-context";
import { deleteEvent, getEventAttendance, joinEvent, leaveEvent } from "@/services/api";

export default function EventDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id, title, location, time, createdBy } = useLocalSearchParams<{
    id: string; title: string; location: string; time: string; createdBy: string;
  }>();

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [isAttending, setIsAttending] = useState(false);
  const [attendLoading, setAttendLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    getEventAttendance(Number(id), user ?? undefined)
      .then((data) => {
        setAttendeeCount(data.attendeeCount);
        setIsAttending(data.isAttending);
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [id, user]);

  const handleAttend = async () => {
    if (!user) { router.push("/signin"); return; }
    setAttendLoading(true);
    try {
      const result = isAttending
        ? await leaveEvent(Number(id), user)
        : await joinEvent(Number(id), user);
      setAttendeeCount(result.attendeeCount);
      setIsAttending(result.isAttending);
    } catch {
      Alert.alert("Error", "Could not update attendance.");
    } finally { setAttendLoading(false); }
  };

  const handleDelete = () => {
    Alert.alert("Delete Event", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(Number(id));
            router.back();
          } catch {
            Alert.alert("Error", "Failed to delete event.");
          }
        },
      },
    ]);
  };

  if (!fontsLoaded) return null;

  const isCreator = user === createdBy;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#120303", "#3b0d0d", "#7a1f1f"]} style={StyleSheet.absoluteFill} />

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
            <Text style={styles.label}>Host</Text>
            <Text style={styles.value}>{createdBy}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Going</Text>
            {dataLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.attendeeCount}>{attendeeCount} {attendeeCount === 1 ? "person" : "people"}</Text>
            }
          </View>
        </View>

        {/* Join / Leave — only for non-creators */}
        {!isCreator && (
          <Pressable
            style={({ pressed }) => [
              styles.attendBtn,
              isAttending && styles.attendBtnLeave,
              pressed && styles.pressed,
            ]}
            onPress={handleAttend}
            disabled={attendLoading || dataLoading}
          >
            {attendLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.attendBtnText}>
                  {isAttending ? "Leave Event" : "Join Event"}
                </Text>
            }
          </Pressable>
        )}

        {/* Edit / Delete — only for creator */}
        {isCreator && (
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: "/edit-event", params: { id, title, location, time, createdBy } })}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
              onPress={handleDelete}
            >
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, paddingTop: 20 },
  title: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 24 },

  card: {
    borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)", padding: 20,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  label: { fontSize: 13, fontFamily: "Cinzel_700Bold", letterSpacing: 1, color: "rgba(255,255,255,0.5)" },
  value: { fontSize: 16, color: "rgba(255,255,255,0.9)", flexShrink: 1, textAlign: "right", marginLeft: 16 },
  attendeeCount: { fontSize: 16, color: "#fff", fontWeight: "700" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },

  attendBtn: {
    marginTop: 20, height: 52, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#dc2626",
  },
  attendBtnLeave: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  attendBtnText: { fontSize: 15, fontFamily: "Cinzel_700Bold", letterSpacing: 1, color: "#fff" },

  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  editBtn: {
    flex: 1, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  editBtnText: { fontSize: 14, letterSpacing: 1.5, color: "#0b0b0f", fontFamily: "Cinzel_700Bold" },
  deleteBtn: {
    flex: 1, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(220,38,38,0.6)",
    backgroundColor: "rgba(220,38,38,0.15)",
  },
  deleteBtnText: { fontSize: 14, letterSpacing: 1.5, color: "#dc2626", fontFamily: "Cinzel_700Bold" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, Modal, FlatList } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/services/auth-context";
import { useToast } from "@/context/ToastContext";
import { cancelEventReminder, deleteEvent, getEventAttendees, getEventById, hasEventReminder, joinEvent, leaveEvent, setEventReminder } from "@/services/api";

export default function EventDetailsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { id, title, location, time, createdBy, type } = useLocalSearchParams<{
    id: string; title: string; location: string; time: string; createdBy: string; type?: string;
  }>();

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [isAttending, setIsAttending] = useState(false);
  const [attendLoading, setAttendLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [showAttendees, setShowAttendees] = useState(false);
  const [reminded, setReminded] = useState(false);
  const [remindLoading, setRemindLoading] = useState(false);
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [concluded, setConcluded] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const nid = Number(id);
    setDataLoading(true);
    setDataError(false);
    Promise.all([
      getEventAttendees(nid),
      getEventById(nid),
      hasEventReminder(nid, user).catch(() => false),
    ])
      .then(([list, eventData, hasReminder]) => {
        setAttendees(list);
        setAttendeeCount(list.length);
        setIsAttending(list.includes(user));
        setReminded(hasReminder);
        setEventDate(eventData.eventDate ?? null);
        setCoverUrl(eventData.coverUrl ?? null);
        if (eventData.eventDate) {
          setConcluded(new Date(eventData.eventDate) < new Date());
        }
      })
      .catch(() => setDataError(true))
      .finally(() => setDataLoading(false));
  }, [id, user]);

  const handleRemind = async () => {
    if (!user || remindLoading) return;
    const nid = Number(id);

    if (reminded) {
      setRemindLoading(true);
      try {
        await cancelEventReminder(nid, user);
        setReminded(false);
        showToast("Reminder cancelled", "success");
      } catch {
        Alert.alert("Error", "Couldn't cancel the reminder. Try again.");
      } finally { setRemindLoading(false); }
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Notifications Disabled", "Enable notifications in Settings to get reminders.");
      return;
    }

    // Legacy events without event_date can't be scheduled server-side —
    // fall back to a local notification (only fires while the app is alive)
    if (!eventDate) {
      const eventTime = new Date(time ?? "");
      const fireDate = isNaN(eventTime.getTime())
        ? new Date(Date.now() + 60 * 60 * 1000)
        : new Date(eventTime.getTime() - 60 * 60 * 1000);

      if (fireDate <= new Date()) {
        Alert.alert("Can't Set Reminder", "This event is in the past or too soon.");
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Hangout starting soon: ${title}`,
          body: `${location} · ${time}`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
      });
      setReminded(true);
      Alert.alert("Reminder Set", `You'll be reminded 1 hour before: ${title}`);
      return;
    }

    const remindAt = new Date(new Date(eventDate).getTime() - 60 * 60 * 1000);
    if (remindAt <= new Date()) {
      Alert.alert("Can't Set Reminder", "This event is in the past or too soon.");
      return;
    }

    setRemindLoading(true);
    try {
      await setEventReminder(nid, user, remindAt.toISOString());
      setReminded(true);
      Alert.alert("Reminder Set", `You'll be reminded 1 hour before: ${title}`);
    } catch {
      Alert.alert("Error", "Couldn't set the reminder. Try again.");
    } finally { setRemindLoading(false); }
  };

  const handleAttend = async () => {
    if (!user) { router.push("/signin"); return; }
    const nid = Number(id);
    setAttendLoading(true);
    try {
      if (isAttending) {
        await leaveEvent(nid, user);
        setIsAttending(false);
        setAttendeeCount((c) => Math.max(0, c - 1));
        setAttendees((prev) => prev.filter((u) => u !== user));
      } else {
        await joinEvent(nid, user);
        setIsAttending(true);
        setAttendeeCount((c) => c + 1);
        setAttendees((prev) => [...prev, user]);
        showToast(`Joined ${title}!`, "success");
      }
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
            await deleteEvent(Number(id), user ?? "");
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
      <LinearGradient colors={["#0f0305", "#1a0505", "#2d0808"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.content}>
        {!!coverUrl && (
          <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" transition={150} />
        )}
        <Text style={styles.title}>{title}</Text>
        {concluded && (
          <View style={styles.concludedBanner}>
            <Text style={styles.concludedBannerText}>This event has ended</Text>
          </View>
        )}
        {!!type && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{type}</Text>
          </View>
        )}

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
          <Pressable style={styles.row} onPress={() => !dataLoading && !dataError && setShowAttendees(true)}>
            <Text style={styles.label}>Going</Text>
            {dataLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : dataError
              ? <Text style={styles.dataErrorText}>Couldn't load</Text>
              : <Text style={[styles.attendeeCount, { textDecorationLine: "underline" }]}>
                  {attendeeCount} {attendeeCount === 1 ? "person" : "people"}
                </Text>
            }
          </Pressable>
        </View>

        {/* Join / Leave — only for non-creators and active events */}
        {!isCreator && !concluded && (
          <Pressable
            style={({ pressed }) => [
              styles.attendBtn,
              isAttending && styles.attendBtnLeave,
              pressed && styles.pressed,
            ]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleAttend(); }}
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

        {/* Remind Me — only for active events */}
        {!isCreator && !concluded && (
          <Pressable
            style={({ pressed }) => [styles.remindBtn, reminded && styles.remindBtnDone, pressed && styles.pressed]}
            onPress={handleRemind}
            disabled={remindLoading}
          >
            <Text style={styles.remindBtnText}>{reminded ? "Reminder Set ✓ (Tap to Cancel)" : "Remind Me 1 Hr Before"}</Text>
          </Pressable>
        )}

        {/* Event Chat — visible to attendees and creator */}
        {(isAttending || isCreator) && !dataLoading && (
          <Pressable
            style={({ pressed }) => [styles.chatBtn, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/event-chat", params: { eventId: id, title } })}
          >
            <Text style={styles.chatBtnText}>{concluded ? "View Event Chat" : "Open Event Chat"}</Text>
          </Pressable>
        )}

        {/* Edit / Delete — only for creator */}
        {isCreator && (
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: "/edit-event", params: { id, title, location, time, createdBy, coverUrl: coverUrl ?? "" } })}
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

      {/* Attendee list modal */}
      <Modal visible={showAttendees} transparent animationType="slide" onRequestClose={() => setShowAttendees(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAttendees(false)} />
        <View style={styles.attendeeSheet}>
          <View style={styles.attendeeHandle} />
          <Text style={styles.attendeeTitle}>
            {attendeeCount} {attendeeCount === 1 ? "Person" : "People"} Going
          </Text>
          {attendees.length === 0 ? (
            <Text style={styles.attendeeEmpty}>No one yet. Be the first!</Text>
          ) : (
            <FlatList
              data={attendees}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <View style={styles.attendeeRow}>
                  <View style={styles.attendeeAvatar}>
                    <Text style={styles.attendeeInitial}>{item.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.attendeeName}>{item}</Text>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, paddingTop: 20 },
  cover: { height: 170, borderRadius: 16, marginBottom: 18 },
  title: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 24 },

  card: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)", borderTopColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)", padding: 20,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  label: { fontSize: 13, fontFamily: "Cinzel_700Bold", letterSpacing: 1, color: "rgba(255,255,255,0.5)" },
  value: { fontSize: 16, color: "rgba(255,255,255,0.9)", flexShrink: 1, textAlign: "right", marginLeft: 16 },
  attendeeCount: { fontSize: 16, color: "#fff", fontWeight: "700" },
  dataErrorText: { fontSize: 13, color: "rgba(220,38,38,0.8)", fontStyle: "italic" },
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

  concludedBanner: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10, paddingHorizontal: 16, marginBottom: 16,
    alignItems: "center",
  },
  concludedBannerText: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600", letterSpacing: 0.3 },

  typeBadge: {
    alignSelf: "flex-start", backgroundColor: "rgba(220,38,38,0.15)",
    borderWidth: 1, borderColor: "rgba(220,38,38,0.35)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 16,
  },
  typeBadgeText: { color: "#dc2626", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },

  chatBtn: {
    marginTop: 12, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.2)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.5)",
  },
  chatBtnText: { fontSize: 14, fontFamily: "Cinzel_700Bold", letterSpacing: 0.8, color: "#c4b5fd" },

  remindBtn: {
    marginTop: 12, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(251,191,36,0.5)",
    backgroundColor: "rgba(251,191,36,0.1)",
  },
  remindBtnDone: { borderColor: "rgba(34,197,94,0.5)", backgroundColor: "rgba(34,197,94,0.1)" },
  remindBtnText: { fontSize: 14, fontFamily: "Cinzel_700Bold", letterSpacing: 0.8, color: "#fbbf24" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  attendeeSheet: {
    backgroundColor: "#1a0808", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 20, paddingBottom: 40, maxHeight: "60%",
  },
  attendeeHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", alignSelf: "center", marginBottom: 16 },
  attendeeTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 16 },
  attendeeEmpty: { color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", paddingVertical: 20 },
  attendeeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  attendeeAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center" },
  attendeeInitial: { color: "#fff", fontWeight: "700", fontSize: 15 },
  attendeeName: { color: "#fff", fontSize: 15, fontWeight: "600" },
});

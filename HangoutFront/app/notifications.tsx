import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/services/auth-context";
import {
  getNotifications, markAllNotificationsRead, markNotificationRead,
  getMyInvites, respondToInvite, joinBubble, joinEvent,
} from "@/services/api";
import { ScreenBackground } from "@/components/ScreenBackground";
import { SkeletonBox } from "@/components/SkeletonBox";
import { EmptyState } from "@/components/EmptyState";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  data: any;
  read: boolean;
  createdAt: string;
};

type Invite = {
  id: number;
  inviterUsername: string;
  bubbleId: number | null;
  eventId: number | null;
  bubbleName: string | null;
  eventTitle: string | null;
  status: string;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function typeIcon(type: string): { name: string; color: string; bg: string } {
  switch (type) {
    case "bubble_join": return { name: "people", color: "#c4b5fd", bg: "rgba(124,58,237,0.2)" };
    case "event_join":  return { name: "calendar", color: "#dc2626", bg: "rgba(220,38,38,0.15)" };
    case "invite":      return { name: "mail", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    case "message":     return { name: "chatbubble", color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    case "event_reminder": return { name: "alarm", color: "#fbbf24", bg: "rgba(251,191,36,0.15)" };
    default:            return { name: "notifications", color: "#fff", bg: "rgba(255,255,255,0.1)" };
  }
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router   = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invites, setInvites]             = useState<Invite[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [responding, setResponding]       = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const [notifs, inv] = await Promise.all([
        getNotifications(user),
        getMyInvites(user),
      ]);
      setNotifications(notifs);
      setInvites(inv);
    } catch {
      setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsRead(user);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const handleNotifPress = async (notif: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!notif.read) {
      markNotificationRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
    if (notif.data?.bubbleId) {
      router.push({ pathname: "/bubble-detail", params: { id: notif.data.bubbleId } });
    } else if (notif.data?.eventId) {
      router.push({ pathname: "/event-details", params: { id: notif.data.eventId } });
    }
  };

  const handleInviteRespond = async (invite: Invite, accept: boolean) => {
    if (!user) return;
    setResponding(invite.id);
    try {
      await respondToInvite(invite.id, accept ? "accepted" : "declined");
      if (accept) {
        if (invite.bubbleId) await joinBubble(invite.bubbleId, user);
        if (invite.eventId)  await joinEvent(invite.eventId, user);
      }
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (accept) {
        if (invite.bubbleId) {
          router.push({ pathname: "/bubble-detail", params: { id: invite.bubbleId } });
        } else if (invite.eventId) {
          router.push({ pathname: "/event-details", params: { id: invite.eventId } });
        }
      }
    } catch {
      Alert.alert("Error", "Couldn't respond to invite. Try again.");
    }
    setResponding(null);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!user) {
    return (
      <ScreenBackground style={s.container}>
        <View style={s.empty}>
          <Text style={s.emptyText}>Sign in to see notifications.</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable style={s.markAllBtn} onPress={handleMarkAllRead}>
            <Text style={s.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={{ padding: 20, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[s.notifCard, { gap: 10 }]}>
              <SkeletonBox width={42} height={42} borderRadius={21} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBox width="70%" height={13} borderRadius={6} />
                <SkeletonBox width="90%" height={11} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.15)" />
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, textAlign: "center" }}>Couldn't load notifications.</Text>
          <Pressable style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: "rgba(220,38,38,0.5)", backgroundColor: "rgba(220,38,38,0.1)" }} onPress={() => load()}>
            <Text style={{ color: "#dc2626", fontWeight: "700" }}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[
            ...invites.map((i) => ({ _type: "invite" as const, invite: i })),
            ...notifications.map((n) => ({ _type: "notif" as const, notif: n })),
          ]}
          keyExtractor={(item) =>
            item._type === "invite" ? `inv_${item.invite.id}` : `notif_${item.notif.id}`
          }
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#dc2626" colors={["#dc2626"]} />}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="All caught up"
              subtitle="You'll be notified when someone joins your bubble, RSVPs to your event, or sends you an invite."
            />
          }
          renderItem={({ item }) => {
            if (item._type === "invite") {
              const inv = item.invite;
              const name = inv.bubbleName ?? inv.eventTitle ?? "something";
              const icon = inv.bubbleId ? "people" : "calendar";
              const color = inv.bubbleId ? "#c4b5fd" : "#dc2626";
              const bg    = inv.bubbleId ? "rgba(124,58,237,0.2)" : "rgba(220,38,38,0.15)";
              return (
                <View style={[s.notifCard, s.inviteCard]}>
                  <View style={[s.iconCircle, { backgroundColor: bg }]}>
                    <Ionicons name={icon as any} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.notifTitle}>
                      <Text style={s.bold}>{inv.inviterUsername}</Text> invited you
                    </Text>
                    <Text style={s.notifBody} numberOfLines={2}>
                      Join "{name}"
                    </Text>
                    <Text style={s.notifTime}>{timeAgo(inv.createdAt)}</Text>
                    <View style={s.inviteActions}>
                      <Pressable
                        style={s.declineBtn}
                        onPress={() => handleInviteRespond(inv, false)}
                        disabled={responding === inv.id}
                      >
                        <Text style={s.declineBtnText}>Decline</Text>
                      </Pressable>
                      <Pressable
                        style={s.acceptBtn}
                        onPress={() => handleInviteRespond(inv, true)}
                        disabled={responding === inv.id}
                      >
                        {responding === inv.id
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={s.acceptBtnText}>Accept</Text>
                        }
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            }

            const notif = item.notif;
            const icon  = typeIcon(notif.type);
            return (
              <Pressable
                style={[s.notifCard, !notif.read && s.unread]}
                onPress={() => handleNotifPress(notif)}
              >
                <View style={[s.iconCircle, { backgroundColor: icon.bg }]}>
                  <Ionicons name={icon.name as any} size={20} color={icon.color} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.notifTitle}>{notif.title}</Text>
                  <Text style={s.notifBody} numberOfLines={2}>{notif.body}</Text>
                  <Text style={s.notifTime}>{timeAgo(notif.createdAt)}</Text>
                </View>
                {!notif.read && <View style={s.unreadDot} />}
              </Pressable>
            );
          }}
        />
      )}
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 56 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "700", flex: 1 },
  markAllBtn: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  markAllText: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" },

  list: { padding: 16, gap: 10 },

  notifCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  unread: { borderColor: "rgba(220,38,38,0.3)", backgroundColor: "rgba(220,38,38,0.05)" },
  inviteCard: { borderColor: "rgba(245,158,11,0.25)", backgroundColor: "rgba(245,158,11,0.05)" },

  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  notifTitle: { color: "#fff", fontSize: 14, fontWeight: "600", lineHeight: 20 },
  bold: { fontWeight: "800" },
  notifBody: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },
  notifTime: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#dc2626", marginTop: 6 },

  inviteActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  declineBtn: {
    flex: 1, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  declineBtnText: { color: "rgba(255,255,255,0.55)", fontWeight: "600", fontSize: 13 },
  acceptBtn: {
    flex: 1, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "#dc2626",
  },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12, marginTop: 60 },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptySubText: { color: "rgba(255,255,255,0.25)", fontSize: 13, textAlign: "center", lineHeight: 18 },
});

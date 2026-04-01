import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
  ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import {
  getBubbles, getBubbleMembers, updateMemberLocation,
  getBubbleChannels, switchChannel, getMessages, sendMessage,
} from "@/services/api";
import { useAuth } from "@/services/auth-context";

// ── Helpers ──────────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaText(km: number): string {
  if (km < 0.05) return "You're here";
  const walkMin = Math.round((km / 5) * 60);
  const driveMin = Math.max(1, Math.round((km / 40) * 60));
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return `${dist}  ·  ~${walkMin}m walk  ·  ~${driveMin}m drive`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ── Types ────────────────────────────────────────────────────────────
type BubbleMember = {
  id: number; bubbleId: number; username: string;
  latitude?: number; longitude?: number;
  shareLocation?: boolean; channelId?: number;
};

type ChatMsg = {
  id: number; bubbleId: number; channelId: number;
  username: string; message: string; createdAt: string;
};

type Bubble = {
  id: number; name: string; type?: string; meetTime?: string;
  description?: string; members: string[];
  maxMembers?: number; isSecret?: boolean; revealAt?: string;
};

// ── Screen ───────────────────────────────────────────────────────────
export default function BubbleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bubbleId = parseInt(id, 10);
  const { user } = useAuth();

  const [bubble, setBubble]         = useState<Bubble | null>(null);
  const [members, setMembers]       = useState<BubbleMember[]>([]);
  const [loading, setLoading]       = useState(true);

  // Location sharing
  const [sharing, setSharing]           = useState(false);
  const [myLocation, setMyLocation]     = useState<{ latitude: number; longitude: number } | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  // Tab
  const [tab, setTab]               = useState<"members" | "chat">("members");

  // Chat
  const [channelId, setChannelId]   = useState(1);
  const [channels, setChannels]     = useState<number[]>([]);
  const [messages, setMessages]     = useState<ChatMsg[]>([]);
  const [msgInput, setMsgInput]     = useState("");
  const [sending, setSending]       = useState(false);
  const msgListRef = useRef<FlatList>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Channel search modal
  const [chanSearch, setChanSearch] = useState(false);
  const [chanInput, setChanInput]   = useState("");

  // ── Data loading ────────────────────────────────────────────────
  const loadBubble = useCallback(async () => {
    try {
      const all = await getBubbles();
      const found = all.find((b: Bubble) => b.id === bubbleId);
      if (found) setBubble(found);
    } catch {}
  }, [bubbleId]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await getBubbleMembers(bubbleId);
      setMembers(data);
      const mine = data.find((m: BubbleMember) => m.username === user);
      if (mine) {
        setChannelId(mine.channelId ?? 1);
        setSharing(mine.shareLocation ?? false);
      }
    } catch {}
  }, [bubbleId, user]);

  const loadChannels = useCallback(async () => {
    try {
      const data = await getBubbleChannels(bubbleId);
      // Always include current channel even if empty
      const merged = Array.from(new Set([...data, channelId])).sort((a, b) => a - b);
      setChannels(merged);
    } catch {}
  }, [bubbleId, channelId]);

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(bubbleId, channelId);
      setMessages(data);
      setTimeout(() => msgListRef.current?.scrollToEnd({ animated: false }), 50);
    } catch {}
  }, [bubbleId, channelId]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadBubble(), loadMembers()]);
    setLoading(false);
  }, [loadBubble, loadMembers]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Poll messages while on chat tab
  useEffect(() => {
    if (tab !== "chat") { if (pollRef.current) clearInterval(pollRef.current); return; }
    loadMessages();
    loadChannels();
    pollRef.current = setInterval(loadMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, loadMessages, loadChannels]);

  // Reload messages when channel changes
  useEffect(() => { if (tab === "chat") { loadMessages(); loadChannels(); } }, [channelId]);

  // ── Location sharing ────────────────────────────────────────────
  const startSharing = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setMyLocation(coord);
    await updateMemberLocation(bubbleId, user ?? "Guest", true, coord.latitude, coord.longitude);

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 20000, distanceInterval: 20 },
      async (l) => {
        const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
        setMyLocation(c);
        await updateMemberLocation(bubbleId, user ?? "Guest", true, c.latitude, c.longitude);
      }
    );
    watcherRef.current = sub;
    setSharing(true);
    await loadMembers();
  };

  const stopSharing = async () => {
    watcherRef.current?.remove();
    watcherRef.current = null;
    setMyLocation(null);
    setSharing(false);
    await updateMemberLocation(bubbleId, user ?? "Guest", false);
    await loadMembers();
  };

  const toggleSharing = async () => {
    if (sharing) await stopSharing();
    else await startSharing();
  };

  useEffect(() => () => { watcherRef.current?.remove(); }, []);

  // ── Chat ────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = msgInput.trim();
    if (!text) return;
    setSending(true);
    setMsgInput("");
    try {
      await sendMessage(bubbleId, channelId, user ?? "Guest", text);
      await loadMessages();
    } catch {} finally { setSending(false); }
  };

  const handleSwitchChannel = async (newChan: number) => {
    await switchChannel(bubbleId, user ?? "Guest", newChan);
    setChannelId(newChan);
    setChanSearch(false);
    setChanInput("");
  };

  // ── Derived ─────────────────────────────────────────────────────
  const membersInChannel = members.filter((m) => (m.channelId ?? 1) === channelId);
  const myMember = members.find((m) => m.username === user);

  if (loading || !bubble) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#dc2626" size="large" />
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#120303" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerName}>{bubble.name}</Text>
        <View style={s.headerMeta}>
          {bubble.type && <View style={s.typeBadge}><Text style={s.typeBadgeText}>{bubble.type}</Text></View>}
          {bubble.meetTime && <Text style={s.headerTime}>🕐 {bubble.meetTime}</Text>}
          <Text style={s.memberCount}>{bubble.members.length} members</Text>
        </View>
        {bubble.description ? <Text style={s.headerDesc} numberOfLines={2}>{bubble.description}</Text> : null}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <Pressable style={[s.tab, tab === "members" && s.tabActive]} onPress={() => setTab("members")}>
          <Text style={[s.tabText, tab === "members" && s.tabTextActive]}>Members</Text>
        </Pressable>
        <Pressable style={[s.tab, tab === "chat" && s.tabActive]} onPress={() => setTab("chat")}>
          <Text style={[s.tabText, tab === "chat" && s.tabTextActive]}>Chat</Text>
        </Pressable>
      </View>

      {/* ── Members tab ────────────────────────────────────────── */}
      {tab === "members" && (
        <FlatList
          data={members}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            <Pressable
              style={[s.locationToggle, sharing && s.locationToggleOn]}
              onPress={toggleSharing}
            >
              <View>
                <Text style={s.locationToggleTitle}>
                  {sharing ? "📍 Sharing your location" : "📍 Location hidden"}
                </Text>
                <Text style={s.locationToggleSub}>
                  {sharing ? "Tap to stop sharing" : "Tap to share your location with members"}
                </Text>
              </View>
              <View style={[s.toggle, sharing && s.toggleOn]}>
                <View style={[s.toggleThumb, sharing && s.toggleThumbOn]} />
              </View>
            </Pressable>
          }
          renderItem={({ item: m }) => {
            const isMe = m.username === user;
            let distLine: string | null = null;
            if (!isMe && m.shareLocation && m.latitude != null && myLocation) {
              const km = haversineKm(myLocation.latitude, myLocation.longitude, m.latitude!, m.longitude!);
              distLine = etaText(km);
            }
            return (
              <View style={[s.memberCard, isMe && s.memberCardMe]}>
                <View style={s.memberAvatar}>
                  <Text style={s.memberAvatarText}>{m.username.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{m.username}{isMe ? " (you)" : ""}</Text>
                  {m.shareLocation
                    ? distLine
                      ? <Text style={s.memberEta}>{distLine}</Text>
                      : <Text style={s.memberSharing}>Sharing location</Text>
                    : <Text style={s.memberHidden}>Location hidden</Text>
                  }
                </View>
                <View style={[s.dot, m.shareLocation ? s.dotGreen : s.dotGrey]} />
              </View>
            );
          }}
        />
      )}

      {/* ── Chat tab ────────────────────────────────────────────── */}
      {tab === "chat" && (
        <View style={{ flex: 1 }}>
          {/* Channel bar */}
          <View style={s.channelBar}>
            <Text style={s.channelLabel}>
              # Channel {channelId}
              <Text style={s.channelMemberCount}> · {membersInChannel.length} member{membersInChannel.length !== 1 ? "s" : ""}</Text>
            </Text>
            <Pressable style={s.channelSearchBtn} onPress={() => setChanSearch(true)}>
              <Text style={s.channelSearchBtnText}>Search / Switch</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <FlatList
            ref={msgListRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={s.msgList}
            onContentSizeChange={() => msgListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={s.emptyChat}>No messages yet. Say hello! 👋</Text>
            }
            renderItem={({ item: msg }) => {
              const isMe = msg.username === user;
              return (
                <View style={[s.msgRow, isMe && s.msgRowMe]}>
                  {!isMe && (
                    <View style={s.msgAvatar}>
                      <Text style={s.msgAvatarText}>{msg.username.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={[s.msgBubble, isMe && s.msgBubbleMe]}>
                    {!isMe && <Text style={s.msgUsername}>{msg.username}</Text>}
                    <Text style={s.msgText}>{msg.message}</Text>
                    <Text style={s.msgTime}>{fmtTime(msg.createdAt)}</Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Input */}
          <View style={s.inputRow}>
            <TextInput
              style={s.msgInput}
              placeholder="Message..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={msgInput}
              onChangeText={setMsgInput}
              multiline
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              style={[s.sendBtn, (!msgInput.trim() || sending) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!msgInput.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.sendBtnText}>↑</Text>
              }
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Channel search modal ─────────────────────────────────── */}
      <Modal visible={chanSearch} transparent animationType="slide" onRequestClose={() => setChanSearch(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setChanSearch(false)} />
        <View style={s.chanModal}>
          <View style={s.chanModalHandle} />
          <Text style={s.chanModalTitle}>Find a Channel</Text>

          <View style={s.chanInputRow}>
            <Text style={s.chanHash}>#</Text>
            <TextInput
              style={s.chanNumberInput}
              placeholder="Channel number"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={chanInput}
              onChangeText={setChanInput}
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={() => {
                const n = parseInt(chanInput, 10);
                if (n > 0) handleSwitchChannel(n);
              }}
            />
            <Pressable
              style={[s.chanGoBtn, !chanInput && s.chanGoBtnDisabled]}
              disabled={!chanInput}
              onPress={() => { const n = parseInt(chanInput, 10); if (n > 0) handleSwitchChannel(n); }}
            >
              <Text style={s.chanGoBtnText}>Go</Text>
            </Pressable>
          </View>

          <Text style={s.chanSectionLabel}>Active channels</Text>
          <ScrollView>
            {channels.map((ch) => (
              <Pressable
                key={ch}
                style={[s.chanItem, ch === channelId && s.chanItemActive]}
                onPress={() => handleSwitchChannel(ch)}
              >
                <Text style={[s.chanItemText, ch === channelId && s.chanItemTextActive]}>
                  #{ch}
                  {ch === channelId ? "  ✓ current" : ""}
                </Text>
                <Text style={s.chanItemCount}>
                  {members.filter((m) => (m.channelId ?? 1) === ch).length} member{members.filter((m) => (m.channelId ?? 1) === ch).length !== 1 ? "s" : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#120303" },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  headerName: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typeBadge: { backgroundColor: "rgba(124,58,237,0.3)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { color: "#c4b5fd", fontSize: 11, fontWeight: "700" },
  headerTime: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  memberCount: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  headerDesc: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6, lineHeight: 18 },

  // Tabs
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderColor: "#dc2626" },
  tabText: { color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#fff" },

  // Members
  listContent: { padding: 16, gap: 10 },
  locationToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, marginBottom: 6,
  },
  locationToggleOn: { borderColor: "rgba(34,197,94,0.4)", backgroundColor: "rgba(34,197,94,0.07)" },
  locationToggleTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  locationToggleSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", padding: 2 },
  toggleOn: { backgroundColor: "#22c55e" },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  toggleThumbOn: { alignSelf: "flex-end" },

  memberCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  memberCardMe: { borderColor: "rgba(220,38,38,0.3)", backgroundColor: "rgba(220,38,38,0.06)" },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  memberAvatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  memberName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  memberEta: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 },
  memberSharing: { color: "#22c55e", fontSize: 11, marginTop: 2 },
  memberHidden: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: "#22c55e" },
  dotGrey: { backgroundColor: "rgba(255,255,255,0.2)" },

  // Chat — channel bar
  channelBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  channelLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  channelMemberCount: { color: "rgba(255,255,255,0.4)", fontWeight: "400", fontSize: 12 },
  channelSearchBtn: {
    borderWidth: 1, borderColor: "rgba(220,38,38,0.4)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  channelSearchBtnText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },

  // Chat — messages
  msgList: { padding: 12, gap: 8, paddingBottom: 4 },
  emptyChat: { color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 40, fontSize: 14 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowMe: { flexDirection: "row-reverse" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center", marginBottom: 2 },
  msgAvatarText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  msgBubble: {
    maxWidth: "75%", backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14, borderBottomLeftRadius: 4, padding: 10, gap: 2,
  },
  msgBubbleMe: { backgroundColor: "#dc2626", borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  msgUsername: { color: "#c4b5fd", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  msgText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  msgTime: { color: "rgba(255,255,255,0.4)", fontSize: 10, alignSelf: "flex-end" },

  // Chat — input
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1a0808",
  },
  msgInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, color: "#fff",
    fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#dc2626",
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 22 },

  // Channel search modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  chanModal: {
    backgroundColor: "#1a0808", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 20, paddingBottom: 36, maxHeight: "70%",
  },
  chanModalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", alignSelf: "center", marginBottom: 16 },
  chanModalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 16 },
  chanInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  chanHash: { color: "rgba(255,255,255,0.5)", fontSize: 22, fontWeight: "700" },
  chanNumberInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  chanGoBtn: { backgroundColor: "#dc2626", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  chanGoBtnDisabled: { opacity: 0.4 },
  chanGoBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  chanSectionLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  chanItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  chanItemActive: {},
  chanItemText: { color: "rgba(255,255,255,0.7)", fontSize: 16, fontWeight: "600" },
  chanItemTextActive: { color: "#dc2626" },
  chanItemCount: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
});

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable,
  ActivityIndicator, Keyboard, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { searchUsers, sendInvite } from "@/services/api";
import { ScreenBackground } from "@/components/ScreenBackground";
import { useAuth } from "@/services/auth-context";
import { useToast } from "@/context/ToastContext";
import { UserAvatar } from "@/components/UserAvatar";

type UserResult = { username: string; bio: string; avatarColor: string; profileEmoji: string; avatarUrl?: string | null };

export default function InviteUserScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { bubbleId, eventId, name } = useLocalSearchParams<{
    bubbleId?: string; eventId?: string; name?: string;
  }>();

  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<UserResult[]>([]);
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState<string | null>(null);
  const [invited, setInvited]     = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await searchUsers(q, user ?? undefined);
      // Exclude self
      setResults(res.filter((u) => u.username !== user));
    } catch {}
    setLoading(false);
  }, [user]);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 350);
  };

  const handleInvite = async (invitee: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(invitee);
    try {
      await sendInvite(
        user,
        invitee,
        bubbleId ? Number(bubbleId) : undefined,
        eventId  ? Number(eventId)  : undefined,
      );
      setInvited((prev) => new Set(prev).add(invitee));
      showToast(`Invite sent to ${invitee}!`);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Couldn't send invite. Try again.");
    }
    setSending(null);
  };

  const targetName = name ?? (bubbleId ? `Bubble #${bubbleId}` : `Event #${eventId}`);

  return (
    <ScreenBackground style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => { Keyboard.dismiss(); router.back(); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Invite Someone</Text>
          <Text style={s.headerSub} numberOfLines={1}>to {targetName}</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={s.searchBarWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={s.searchInput}
            placeholder="Search by username…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={handleChange}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setResults([]); }}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator color="#dc2626" style={{ marginTop: 30 }} />
      ) : results.length === 0 && query.length > 0 ? (
        <Text style={s.empty}>No users found for "{query}"</Text>
      ) : results.length === 0 ? (
        <View style={s.hint}>
          <Ionicons name="person-add-outline" size={40} color="rgba(255,255,255,0.1)" />
          <Text style={s.hintText}>Search for a friend by their username</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(u) => u.username}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const isInvited = invited.has(item.username);
            const isSending = sending === item.username;
            return (
              <View style={s.card}>
                <UserAvatar username={item.username} avatarColor={item.avatarColor} avatarUrl={item.avatarUrl} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName}>{item.username}</Text>
                  {item.bio ? <Text style={s.cardBio} numberOfLines={1}>{item.bio}</Text> : null}
                </View>
                <Pressable
                  style={[s.inviteBtn, isInvited && s.invitedBtn]}
                  onPress={() => !isInvited && handleInvite(item.username)}
                  disabled={isInvited || isSending}
                >
                  {isSending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[s.inviteBtnText, isInvited && s.invitedBtnText]}>
                      {isInvited ? "Invited ✓" : "Invite"}
                    </Text>
                  )}
                </Pressable>
              </View>
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
    paddingHorizontal: 16, paddingBottom: 14, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 1 },

  searchBarWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 15 },

  list: { padding: 16, gap: 10 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  avatarEmoji: { fontSize: 22 },
  avatarLetter: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cardName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardBio: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },

  inviteBtn: {
    backgroundColor: "#dc2626", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 72, alignItems: "center",
  },
  invitedBtn: { backgroundColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderColor: "rgba(34,197,94,0.4)" },
  inviteBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  invitedBtnText: { color: "#22c55e" },

  hint: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  hintText: { color: "rgba(255,255,255,0.25)", fontSize: 14, textAlign: "center" },

  empty: {
    color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center",
    marginTop: 40, fontStyle: "italic",
  },
});

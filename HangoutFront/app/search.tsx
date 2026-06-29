import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable,
  ActivityIndicator, Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { searchUsers, searchEvents, searchBubbles } from "@/services/api";
import { ScreenBackground } from "@/components/ScreenBackground";
import { useAuth } from "@/services/auth-context";
import { UserAvatar } from "@/components/UserAvatar";

type SearchTab = "users" | "events" | "bubbles";

type UserResult   = { username: string; bio: string; avatarColor: string; profileEmoji: string; avatarUrl?: string | null };
type EventResult  = { id: number; title: string; location: string; time: string; createdBy: string; type?: string };
type BubbleResult = { id: number; name: string; description?: string; type?: string; members: string[]; createdBy: string };

export default function SearchScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [query, setQuery]       = useState("");
  const [tab, setTab]           = useState<SearchTab>("users");
  const [loading, setLoading]   = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [users, setUsers]       = useState<UserResult[]>([]);
  const [events, setEvents]     = useState<EventResult[]>([]);
  const [bubbles, setBubbles]   = useState<BubbleResult[]>([]);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([]); setEvents([]); setBubbles([]); setSearched(false); setSearchError(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    setSearchError(false);
    try {
      const [u, e, b] = await Promise.all([
        searchUsers(q, user ?? undefined),
        searchEvents(q),
        searchBubbles(q),
      ]);
      setUsers(u); setEvents(e); setBubbles(b);
    } catch {
      setSearchError(true);
    }
    setLoading(false);
  }, [user]);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 350);
  };

  const handleClear = () => {
    setQuery("");
    setUsers([]); setEvents([]); setBubbles([]); setSearched(false); setSearchError(false);
  };

  const activeUsers   = users;
  const activeEvents  = events;
  const activeBubbles = bubbles;

  const tabCount = (t: SearchTab) => {
    if (t === "users")   return activeUsers.length;
    if (t === "events")  return activeEvents.length;
    return activeBubbles.length;
  };

  return (
    <ScreenBackground style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => { Keyboard.dismiss(); router.back(); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={s.searchInput}
            placeholder="Search users, events, bubbles…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={handleChange}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
          />
          {query.length > 0 && (
            <Pressable onPress={handleClear}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(["users", "events", "bubbles"] as SearchTab[]).map((t) => (
          <Pressable
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(t); }}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {searched && tabCount(t) > 0 && (
                <Text style={tab === t ? s.tabCountActive : s.tabCount}> {tabCount(t)}</Text>
              )}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
      ) : searchError ? (
        <View style={s.hint}>
          <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.1)" />
          <Text style={s.hintText}>Search failed. Check your connection and try again.</Text>
        </View>
      ) : !searched ? (
        <View style={s.hint}>
          <Ionicons name="search" size={40} color="rgba(255,255,255,0.1)" />
          <Text style={s.hintText}>Search for people, events, and bubbles</Text>
        </View>
      ) : tab === "users" ? (
        <FlatList
          data={activeUsers}
          keyExtractor={(u) => u.username}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No users found for "{query}"</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={s.card}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/user-profile", params: { username: item.username } });
              }}
            >
              <UserAvatar username={item.username} avatarColor={item.avatarColor} avatarUrl={item.avatarUrl} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.username}</Text>
                {item.bio ? (
                  <Text style={s.cardSub} numberOfLines={1}>{item.bio}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
            </Pressable>
          )}
        />
      ) : tab === "events" ? (
        <FlatList
          data={activeEvents}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No events found for "{query}"</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={s.card}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: "/event-details",
                  params: {
                    id: item.id, title: item.title,
                    location: item.location, time: item.time,
                    createdBy: item.createdBy, type: item.type ?? "",
                  },
                });
              }}
            >
              <View style={s.eventIcon}>
                <Ionicons name="calendar" size={20} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.35)" />
                  <Text style={s.cardSub} numberOfLines={1}>{item.location}</Text>
                </View>
              </View>
              {item.type && (
                <View style={s.typeBadge}><Text style={s.typeBadgeText}>{item.type}</Text></View>
              )}
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={activeBubbles}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No bubbles found for "{query}"</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={s.card}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/bubble-detail", params: { id: item.id } });
              }}
            >
              <View style={s.bubbleIcon}>
                <Text style={s.bubbleLetter}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={s.cardSub}>
                  {item.members.length} member{item.members.length !== 1 ? "s" : ""}
                  {item.type ? ` · ${item.type}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
            </Pressable>
          )}
        />
      )}
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 56 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  backBtn: { padding: 4 },
  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 15 },

  tabs: {
    flexDirection: "row", borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)", marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderColor: "#dc2626" },
  tabText: { color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  tabCount: { color: "rgba(255,255,255,0.35)" },
  tabCountActive: { color: "#dc2626" },

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

  eventIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(220,38,38,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(220,38,38,0.3)",
  },
  bubbleIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  bubbleLetter: { color: "#fff", fontSize: 18, fontWeight: "700" },

  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },

  typeBadge: { backgroundColor: "rgba(220,38,38,0.2)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { color: "#fca5a5", fontSize: 11, fontWeight: "700" },

  hint: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  hintText: { color: "rgba(255,255,255,0.25)", fontSize: 14, textAlign: "center" },

  empty: {
    color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center",
    marginTop: 40, fontStyle: "italic",
  },
});

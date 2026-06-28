import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, StatusBar, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getBubbles, getMyEvents } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import { SkeletonBox } from "@/components/SkeletonBox";
import { ErrorScreen } from "@/components/ErrorScreen";
import { EmptyState } from "@/components/EmptyState";
import { ScreenBackground } from "@/components/ScreenBackground";

type Bubble = {
  id: number; name: string; description?: string;
  createdBy: string; type?: string; meetTime?: string;
  maxMembers?: number; members: string[];
};

type Event = {
  id: number; title: string; location: string;
  time: string; createdBy: string;
};

export default function MyHangoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [myBubbles, setMyBubbles] = useState<Bubble[]>([]);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!user) { if (!silent) setLoading(false); return; }
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const [allBubbles, events] = await Promise.all([
        getBubbles(),
        getMyEvents(user),
      ]);
      setMyBubbles(allBubbles.filter((b: Bubble) => b.members.includes(user)));
      setMyEvents(events);
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

  if (loadError) {
    return <ErrorScreen message="Couldn't load your hangouts." onRetry={load} />;
  }

  const isEmpty = !loading && myBubbles.length === 0 && myEvents.length === 0;

  return (
    <ScreenBackground style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={s.header}>
        <Text style={s.headerTitle}>My Hangouts</Text>
      </View>
      <Text style={s.subtitle}>Bubbles and events you've joined</Text>

      {!user ? (
        <View style={s.center}>
          <Ionicons name="person-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={s.emptyText}>Sign in to see your hangouts</Text>
          <Pressable style={s.signInBtn} onPress={() => router.push("/signin")}>
            <Text style={s.signInBtnText}>Sign In</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#dc2626" colors={["#dc2626"]} />}
        >

          {/* ── Bubbles ── */}
          <Text style={s.sectionLabel}>Bubbles</Text>
          {loading ? (
            [0, 1].map((i) => (
              <View key={i} style={[s.card, { gap: 12 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <SkeletonBox width={44} height={44} borderRadius={22} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <SkeletonBox width="50%" height={15} borderRadius={6} />
                    <SkeletonBox width="30%" height={11} borderRadius={6} />
                  </View>
                </View>
              </View>
            ))
          ) : myBubbles.length === 0 ? (
            <EmptyState
              icon="people-circle-outline"
              title="No bubbles yet"
              subtitle="Join a bubble from the Map or Discover tab to see it here."
              action={{ label: "Browse Map", onPress: () => router.push("/(tabs)/map" as any) }}
            />
          ) : (
            myBubbles.map((bubble) => (
              <Pressable
                key={bubble.id}
                style={({ pressed }) => [s.card, pressed && s.cardPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/bubble-detail", params: { id: bubble.id } });
                }}
              >
                <View style={s.cardTop}>
                  <View style={s.bubbleIcon}>
                    <Text style={s.bubbleIconText}>{bubble.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.cardName}>{bubble.name}</Text>
                    <View style={s.cardMeta}>
                      {bubble.type ? (
                        <View style={s.typeBadge}>
                          <Text style={s.typeBadgeText}>{bubble.type}</Text>
                        </View>
                      ) : null}
                      <Text style={s.cardSub}>
                        {bubble.members.length}{bubble.maxMembers ? `/${bubble.maxMembers}` : ""} member{bubble.members.length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                </View>
                {bubble.meetTime ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.5)" />
                    <Text style={s.cardSub}>{bubble.meetTime}</Text>
                  </View>
                ) : null}
                {bubble.description ? (
                  <Text style={s.cardDescription}>{bubble.description}</Text>
                ) : null}
              </Pressable>
            ))
          )}

          {/* ── Events ── */}
          <Text style={[s.sectionLabel, { marginTop: 28 }]}>Events</Text>
          {loading ? (
            [0, 1].map((i) => (
              <View key={i} style={[s.card, { gap: 10 }]}>
                <SkeletonBox width="60%" height={15} borderRadius={6} />
                <SkeletonBox width="40%" height={11} borderRadius={6} />
              </View>
            ))
          ) : myEvents.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No events yet"
              subtitle="Find events on the Map and RSVP to see them here."
              action={{ label: "Browse Map", onPress: () => router.push("/(tabs)/map" as any) }}
            />
          ) : (
            myEvents.map((event) => (
              <Pressable
                key={event.id}
                style={({ pressed }) => [s.card, pressed && s.cardPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/event-details",
                    params: {
                      id: event.id, title: event.title,
                      location: event.location, time: event.time,
                      createdBy: event.createdBy,
                    },
                  });
                }}
              >
                <Text style={s.cardName}>{event.title}</Text>
                <View style={s.cardMeta}>
                  <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={s.cardSub}>{event.location}</Text>
                </View>
                <View style={s.cardMeta}>
                  <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={s.cardSub}>{event.time}</Text>
                </View>
              </Pressable>
            ))
          )}

        </ScrollView>
      )}
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 56 },
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 4,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  subtitle: { color: "rgba(255,255,255,0.45)", fontSize: 13, paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel: {
    color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "700",
    letterSpacing: 1.5, textTransform: "uppercase",
    paddingHorizontal: 20, marginBottom: 10,
  },
  list: { paddingBottom: 40 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 15 },
  signInBtn: {
    backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  signInBtnText: { color: "#0b0b0f", fontWeight: "700", fontSize: 14 },

  emptySection: { paddingHorizontal: 20, paddingVertical: 12 },
  emptySectionText: { color: "rgba(255,255,255,0.3)", fontSize: 13, fontStyle: "italic" },

  card: {
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.13)", borderTopColor: "rgba(255,255,255,0.2)",
    gap: 8,
  },
  cardPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  bubbleIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  bubbleIconText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cardInfo: { flex: 1 },
  cardName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  typeBadge: { backgroundColor: "rgba(124,58,237,0.3)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { color: "#c4b5fd", fontSize: 11, fontWeight: "600" },
  cardSub: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  cardDescription: { color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 18 },
});

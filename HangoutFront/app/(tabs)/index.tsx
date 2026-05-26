import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  StatusBar, FlatList, ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/services/auth-context";
import {
  getSuggestedUsers, getTrendingBubbles, getPopularEvents,
  toggleUserFollow,
} from "@/services/api";
import { SkeletonBox } from "@/components/SkeletonBox";
import { ScreenBackground } from "@/components/ScreenBackground";

type Suggestion = { username: string; mutualBubbles: number };
type Bubble     = { id: number; name: string; type?: string; members: string[]; description?: string };
type Event      = { id: number; title: string; location: string; time: string; createdBy: string; attendeeCount: number };

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={s.sectionRow}>
      <Ionicons name={icon as any} size={14} color="rgba(255,255,255,0.4)" />
      <Text style={s.sectionLabel}>{title}</Text>
    </View>
  );
}

// ── Person card (horizontal) ──────────────────────────────────────────────────
function PersonCard({
  item, onFollow, following,
}: {
  item: Suggestion;
  onFollow: (username: string) => void;
  following: Set<string>;
}) {
  const isFollowing = following.has(item.username);
  return (
    <View style={s.personCard}>
      <View style={s.personAvatar}>
        <Text style={s.personInitial}>{item.username.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={s.personName} numberOfLines={1}>{item.username}</Text>
      <Text style={s.personMutual}>
        {item.mutualBubbles} shared bubble{item.mutualBubbles !== 1 ? "s" : ""}
      </Text>
      <Pressable
        style={[s.followBtn, isFollowing && s.followBtnDone]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onFollow(item.username); }}
      >
        <Text style={[s.followBtnText, isFollowing && s.followBtnTextDone]}>
          {isFollowing ? "Following" : "Follow"}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [bubbles, setBubbles]         = useState<Bubble[]>([]);
  const [events, setEvents]           = useState<Event[]>([]);
  const [loading, setLoading]         = useState(true);
  const [following, setFollowing]     = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, e] = await Promise.all([getTrendingBubbles(), getPopularEvents()]);
      setBubbles(b);
      setEvents(e);

      if (user) {
        const s = await getSuggestedUsers(user);
        setSuggestions(s);
      }
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleFollow = async (username: string) => {
    if (!user) { router.push("/signin"); return; }
    setFollowing((prev) => {
      const next = new Set(prev);
      next.has(username) ? next.delete(username) : next.add(username);
      return next;
    });
    try {
      await toggleUserFollow(username, user);
    } catch {
      // revert
      setFollowing((prev) => {
        const next = new Set(prev);
        next.has(username) ? next.delete(username) : next.add(username);
        return next;
      });
    }
  };

  // ── Not signed in ────────────────────────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <ScreenBackground style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={s.guestContainer}>
          <Text style={s.guestTitle}>The Hangout</Text>
          <Text style={s.guestSub}>See what's happening around you</Text>
          <Pressable style={s.signInBtn} onPress={() => router.push("/signin")}>
            <Text style={s.signInBtnText}>Sign In</Text>
          </Pressable>
          <Pressable style={s.signUpBtn} onPress={() => router.push("/signup")}>
            <Text style={s.signUpBtnText}>Create Account</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenBackground style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={s.header}><Text style={s.headerTitle}>Discover</Text></View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.sectionRow}>
            <SkeletonBox width={140} height={13} borderRadius={6} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[s.personCard, { gap: 8 }]}>
                <SkeletonBox width={56} height={56} borderRadius={28} />
                <SkeletonBox width={70} height={12} borderRadius={6} />
                <SkeletonBox width={60} height={10} borderRadius={6} />
                <SkeletonBox width={72} height={28} borderRadius={10} />
              </View>
            ))}
          </ScrollView>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[s.card, { gap: 10, marginBottom: 10 }]}>
              <SkeletonBox width="55%" height={15} borderRadius={6} />
              <SkeletonBox width="35%" height={11} borderRadius={6} />
            </View>
          ))}
        </ScrollView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={s.header}>
        <Text style={s.headerTitle}>Discover</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── People You Might Know ── */}
        {user && (
          <>
            <SectionLabel title="PEOPLE YOU MIGHT KNOW" icon="people-outline" />
            {suggestions.length === 0 ? (
              <View style={s.emptySection}>
                <Text style={s.emptySectionText}>
                  Join bubbles to find people with shared interests.
                </Text>
              </View>
            ) : (
              <FlatList
                horizontal
                data={suggestions}
                keyExtractor={(item) => item.username}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.hScroll}
                renderItem={({ item }) => (
                  <PersonCard item={item} onFollow={handleFollow} following={following} />
                )}
              />
            )}
          </>
        )}

        {/* ── Trending Bubbles ── */}
        <SectionLabel title="TRENDING BUBBLES" icon="flame-outline" />
        {bubbles.length === 0 ? (
          <View style={s.emptySection}>
            <Text style={s.emptySectionText}>No bubbles yet — create the first one!</Text>
          </View>
        ) : (
          bubbles.map((b) => (
            <Pressable
              key={b.id}
              style={({ pressed }) => [s.card, pressed && s.cardPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/bubble-detail", params: { id: b.id } });
              }}
            >
              <View style={s.cardTop}>
                <View style={s.bubbleIcon}>
                  <Text style={s.bubbleIconText}>{b.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{b.name}</Text>
                  <View style={s.cardMeta}>
                    {b.type ? <View style={s.badge}><Text style={s.badgeText}>{b.type}</Text></View> : null}
                    <Text style={s.cardSub}>
                      {b.members.length} member{b.members.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
              </View>
              {b.description ? (
                <Text style={s.cardDesc} numberOfLines={1}>{b.description}</Text>
              ) : null}
            </Pressable>
          ))
        )}

        {/* ── Popular Events ── */}
        <SectionLabel title="POPULAR EVENTS" icon="calendar-outline" />
        {events.length === 0 ? (
          <View style={s.emptySection}>
            <Text style={s.emptySectionText}>No events yet — create the first one!</Text>
          </View>
        ) : (
          events.map((e) => (
            <Pressable
              key={e.id}
              style={({ pressed }) => [s.card, pressed && s.cardPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: "/event-details",
                  params: { id: e.id, title: e.title, location: e.location, time: e.time, createdBy: e.createdBy },
                });
              }}
            >
              <View style={s.cardTop}>
                <View style={s.eventIcon}>
                  <Ionicons name="calendar" size={18} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{e.title}</Text>
                  <View style={s.cardMeta}>
                    <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.35)" />
                    <Text style={s.cardSub}>{e.location}</Text>
                  </View>
                </View>
                <View style={s.attendeePill}>
                  <Ionicons name="people-outline" size={11} color="#dc2626" />
                  <Text style={s.attendeePillText}>{e.attendeeCount}</Text>
                </View>
              </View>
              <View style={s.cardMeta}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.35)" />
                <Text style={s.cardSub}>{e.time}</Text>
              </View>
            </Pressable>
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 56 },
  header: { paddingHorizontal: 20, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  scroll: { paddingBottom: 40 },

  // Section labels
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
  sectionLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },

  // Empty states
  emptySection: { paddingHorizontal: 20, paddingBottom: 4 },
  emptySectionText: { color: "rgba(255,255,255,0.3)", fontSize: 13, fontStyle: "italic" },

  // People horizontal scroll
  hScroll: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  personCard: {
    width: 110, alignItems: "center", gap: 6, padding: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.13)",
  },
  personAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  personInitial: { color: "#fff", fontSize: 22, fontWeight: "700" },
  personName: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  personMutual: { color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center" },
  followBtn: {
    backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 6, width: "100%", alignItems: "center",
  },
  followBtnDone: { backgroundColor: "rgba(124,58,237,0.25)", borderWidth: 1, borderColor: "rgba(124,58,237,0.5)" },
  followBtnText: { color: "#0b0b0f", fontWeight: "700", fontSize: 12 },
  followBtnTextDone: { color: "#c4b5fd" },

  // Cards
  card: {
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.13)", borderTopColor: "rgba(255,255,255,0.2)",
    gap: 6,
  },
  cardPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  bubbleIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  bubbleIconText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  eventIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(220,38,38,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(220,38,38,0.3)",
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  cardSub: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  cardDesc: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  badge: { backgroundColor: "rgba(124,58,237,0.3)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#c4b5fd", fontSize: 10, fontWeight: "700" },
  attendeePill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(220,38,38,0.12)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(220,38,38,0.25)",
  },
  attendeePillText: { color: "#dc2626", fontSize: 11, fontWeight: "700" },

  // Guest state
  guestContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 44 },
  guestTitle: { fontSize: 36, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  guestSub: { color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center" },
  signInBtn: {
    width: "100%", height: 48, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center",
  },
  signInBtnText: { color: "#0b0b0f", fontWeight: "700", fontSize: 14 },
  signUpBtn: {
    width: "100%", height: 48, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  signUpBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});

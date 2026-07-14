import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  StatusBar, FlatList, RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/services/auth-context";
import {
  ActivityItem, getFollowingFeed, getDiscoverFeed, getSuggestedFeed,
  getSuggestedUsers, toggleUserFollow, getUnreadNotificationCount, getUnreadInviteCount,
  getUnreadDMCount, getActiveStories, postStory, StoryGroup,
  updateMyCoarseLocation,
} from "@/services/api";
import { SkeletonBox } from "@/components/SkeletonBox";
import { EmptyState } from "@/components/EmptyState";
import { ScreenBackground } from "@/components/ScreenBackground";
import { StoryBar } from "@/components/StoryBar";
import { useToast } from "@/context/ToastContext";

type Suggestion = { username: string; mutualBubbles: number; distanceKm?: number };

// Uses location only if permission was already granted elsewhere (bubbles,
// event creation) — Discover never triggers its own permission prompt.
async function getQuietCoords(): Promise<{ latitude: number; longitude: number } | undefined> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return undefined;
    const loc =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return undefined;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function actionLabel(type: ActivityItem["type"]): string {
  if (type === "bubble_created") return "started a bubble";
  if (type === "event_created") return "created an event";
  return "is going to an event";
}

function SectionLabel({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={s.sectionRow}>
      <Ionicons name={icon as any} size={14} color="rgba(255,255,255,0.4)" />
      <Text style={s.sectionLabel}>{title}</Text>
    </View>
  );
}

function ActivityCard({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const isBubble = item.type === "bubble_created";
  return (
    <Pressable
      style={({ pressed }) => [s.actCard, pressed && s.cardPressed]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
    >
      <View style={s.actHeader}>
        <View style={s.actAvatar}>
          <Text style={s.actAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.actUsername}>@{item.username}</Text>
          <Text style={s.actAction}>{actionLabel(item.type)}</Text>
        </View>
        <Text style={s.actTime}>{timeAgo(item.createdAt)}</Text>
      </View>

      {isBubble && item.bubble && (
        <View style={s.actContent}>
          <View style={s.actBubbleIcon}>
            <Text style={s.actBubbleIconText}>{item.bubble.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.actContentTitle} numberOfLines={1}>{item.bubble.name}</Text>
            <View style={s.actMeta}>
              {item.bubble.type ? (
                <View style={s.badge}><Text style={s.badgeText}>{item.bubble.type}</Text></View>
              ) : null}
              <Text style={s.actContentSub}>
                {item.bubble.members.length} member{item.bubble.members.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
        </View>
      )}

      {!isBubble && item.event && (
        <View style={s.actContent}>
          <View style={s.actEventIcon}>
            <Ionicons name="calendar" size={16} color="#dc2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.actContentTitle} numberOfLines={1}>{item.event.title}</Text>
            <View style={s.actMeta}>
              <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.35)" />
              <Text style={s.actContentSub}>{item.event.location}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
        </View>
      )}
    </Pressable>
  );
}

function PersonCard({
  item, onFollow, following,
}: {
  item: Suggestion; onFollow: (username: string) => void; following: Set<string>;
}) {
  const isFollowing = following.has(item.username);
  return (
    <View style={s.personCard}>
      <View style={s.personAvatar}>
        <Text style={s.personInitial}>{item.username.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={s.personName} numberOfLines={1}>{item.username}</Text>
      <Text style={s.personMutual}>
        {item.mutualBubbles > 0
          ? `${item.mutualBubbles} shared bubble${item.mutualBubbles !== 1 ? "s" : ""}`
          : item.distanceKm != null
          ? item.distanceKm < 1 ? "nearby" : `~${Math.round(item.distanceKm)} km away`
          : "suggested"}
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

function FeedSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[s.actCard, { gap: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <SkeletonBox width={36} height={36} borderRadius={18} />
            <View style={{ gap: 6, flex: 1 }}>
              <SkeletonBox width={90} height={12} borderRadius={6} />
              <SkeletonBox width={130} height={10} borderRadius={6} />
            </View>
            <SkeletonBox width={28} height={10} borderRadius={6} />
          </View>
          <View style={[s.actContent, { opacity: 0.5 }]}>
            <SkeletonBox width={36} height={36} borderRadius={18} />
            <View style={{ gap: 6, flex: 1 }}>
              <SkeletonBox width="70%" height={13} borderRadius={6} />
              <SkeletonBox width="40%" height={10} borderRadius={6} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

export default function FeedScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [storyGroups, setStoryGroups]       = useState<StoryGroup[]>([]);
  const [seenStoryIds, setSeenStoryIds]     = useState<Set<number>>(new Set());
  const [postingStory, setPostingStory]     = useState(false);
  const [followingFeed, setFollowingFeed]   = useState<ActivityItem[]>([]);
  const [suggestedFeed, setSuggestedFeed]   = useState<ActivityItem[]>([]);
  const [discoverFeed, setDiscoverFeed]     = useState<ActivityItem[]>([]);
  const [suggestions, setSuggestions]       = useState<Suggestion[]>([]);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState(false);
  const [following, setFollowing]           = useState<Set<string>>(new Set());
  const [bellCount, setBellCount]           = useState(0);
  const [dmCount, setDmCount]               = useState(0);
  const [refreshing, setRefreshing]         = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const [discover] = await Promise.all([getDiscoverFeed(user ?? undefined)]);
      setDiscoverFeed(discover);
      if (user) {
        const coords = await getQuietCoords();
        if (coords) updateMyCoarseLocation(user, coords.latitude, coords.longitude);
        const [feed, suggested, sugg, notifCount, inviteCount, dmUnread, stories, seenRaw] = await Promise.all([
          getFollowingFeed(user),
          getSuggestedFeed(user),
          getSuggestedUsers(user, coords),
          getUnreadNotificationCount(user),
          getUnreadInviteCount(user),
          getUnreadDMCount(user),
          getActiveStories(user).catch(() => [] as StoryGroup[]),
          AsyncStorage.getItem("@hangout/seen_stories").catch(() => null),
        ]);
        setFollowingFeed(feed);
        setSuggestedFeed(suggested);
        setSuggestions(sugg);
        setBellCount(notifCount + inviteCount);
        setDmCount(dmUnread);
        setStoryGroups(stories);
        setSeenStoryIds(new Set(seenRaw ? (JSON.parse(seenRaw) as number[]) : []));
      }
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
      setFollowing((prev) => {
        const next = new Set(prev);
        next.has(username) ? next.delete(username) : next.add(username);
        return next;
      });
    }
  };

  const handleAddStory = async () => {
    if (!user || postingStory) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    setPostingStory(true);
    try {
      await postStory(user, result.assets[0].uri);
      showToast("Story posted!", "success");
      const groups = await getActiveStories(user);
      setStoryGroups(groups);
    } catch {
      showToast("Couldn't post story. Try again.");
    } finally {
      setPostingStory(false);
    }
  };

  const handleActivityPress = (item: ActivityItem) => {
    if (item.bubble) {
      router.push({ pathname: "/bubble-detail", params: { id: item.bubble.id } });
    } else if (item.event) {
      router.push({
        pathname: "/event-details",
        params: {
          id: item.event.id,
          title: item.event.title,
          location: item.event.location,
          time: item.event.time,
          createdBy: item.event.createdBy,
        },
      });
    }
  };

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

  return (
    <ScreenBackground style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={s.header}>
        <Text style={s.headerTitle}>Discover</Text>
        <View style={s.headerActions}>
          <Pressable
            style={s.headerIconBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/search" as any); }}
          >
            <Ionicons name="search" size={22} color="rgba(255,255,255,0.75)" />
          </Pressable>
          <Pressable
            style={s.headerIconBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/dms" as any); }}
          >
            <Ionicons name={dmCount > 0 ? "chatbubble" : "chatbubble-outline"} size={22} color={dmCount > 0 ? "#dc2626" : "rgba(255,255,255,0.75)"} />
            {dmCount > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>{dmCount > 9 ? "9+" : dmCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={s.headerIconBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/notifications" as any); }}
          >
            <Ionicons name={bellCount > 0 ? "notifications" : "notifications-outline"} size={22} color={bellCount > 0 ? "#dc2626" : "rgba(255,255,255,0.75)"} />
            {bellCount > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>{bellCount > 9 ? "9+" : bellCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#dc2626" colors={["#dc2626"]} />}
      >

        {/* ── Error banner ── */}
        {!loading && loadError && (
          <Pressable style={s.errorBanner} onPress={() => load()}>
            <Text style={s.errorBannerText}>Couldn't load feed. Tap to retry.</Text>
          </Pressable>
        )}

        {/* ── Stories ── */}
        {user && !loading && (
          <StoryBar
            groups={storyGroups}
            me={user}
            seenIds={seenStoryIds}
            posting={postingStory}
            onAddStory={handleAddStory}
            onOpen={(username) => router.push({ pathname: "/story-viewer" as any, params: { username } })}
          />
        )}

        {/* ── Following Feed ── */}
        {user && (
          <>
            <SectionLabel title="FOLLOWING" icon="people" />
            {loading ? (
              <FeedSkeleton />
            ) : followingFeed.length === 0 ? (
              <EmptyState
                icon="person-add-outline"
                title="No activity yet"
                subtitle="Follow people to see what they're up to here."
                action={{ label: "Find People", onPress: () => router.push("/search" as any) }}
              />
            ) : (
              followingFeed.map((item) => (
                <ActivityCard key={item.id} item={item} onPress={() => handleActivityPress(item)} />
              ))
            )}
          </>
        )}

        {/* ── People You May Know ── */}
        {user && (
          <>
            <SectionLabel title="PEOPLE YOU MAY KNOW" icon="person-add-outline" />
            {loading ? (
              <>
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
                <FeedSkeleton />
              </>
            ) : suggestions.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No suggestions yet"
                subtitle="Join bubbles to find people with shared interests."
              />
            ) : (
              <>
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
                {suggestedFeed.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    {suggestedFeed.map((item) => (
                      <ActivityCard key={item.id} item={item} onPress={() => handleActivityPress(item)} />
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ── Discover Feed ── */}
        <SectionLabel title="DISCOVER" icon="compass-outline" />
        {loading ? (
          <FeedSkeleton />
        ) : discoverFeed.length === 0 ? (
          <EmptyState
            icon="compass-outline"
            title="Nothing here yet"
            subtitle="Be the first to drop a bubble or create an event in your area."
            action={{ label: "Create Bubble", onPress: () => router.push("/create-bubble" as any) }}
          />
        ) : (
          discoverFeed.map((item) => (
            <ActivityCard key={item.id} item={item} onPress={() => handleActivityPress(item)} />
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 56 },
  header: { paddingHorizontal: 20, marginBottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerIconBtn: { padding: 8, position: "relative" },
  bellBadge: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: "#dc2626", borderRadius: 8,
    minWidth: 16, height: 16, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  scroll: { paddingBottom: 40 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
  sectionLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },

  emptySection: { paddingHorizontal: 20, paddingBottom: 4 },
  emptySectionText: { color: "rgba(255,255,255,0.3)", fontSize: 13, fontStyle: "italic" },

  actCard: {
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.13)", borderTopColor: "rgba(255,255,255,0.2)",
    gap: 12,
  },
  cardPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  actHeader: { flexDirection: "row", alignItems: "center" },
  actAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  actAvatarText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  actUsername: { color: "#fff", fontSize: 13, fontWeight: "700" },
  actAction: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 1 },
  actTime: { color: "rgba(255,255,255,0.3)", fontSize: 11 },

  actContent: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)",
  },
  actBubbleIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  actBubbleIconText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  actEventIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(220,38,38,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(220,38,38,0.3)",
  },
  actContentTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  actMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  actContentSub: { color: "rgba(255,255,255,0.4)", fontSize: 11 },

  badge: { backgroundColor: "rgba(124,58,237,0.3)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#c4b5fd", fontSize: 10, fontWeight: "700" },

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

  errorBanner: {
    marginHorizontal: 20, marginTop: 16, marginBottom: 4,
    backgroundColor: "rgba(220,38,38,0.12)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(220,38,38,0.3)",
    paddingVertical: 14, alignItems: "center",
  },
  errorBannerText: { color: "#dc2626", fontSize: 13, fontWeight: "600" },

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

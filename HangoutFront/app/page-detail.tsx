import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/services/auth-context";
import { getPage, getPageContent, toggleFollow } from "@/services/api";
import { ErrorScreen } from "@/components/ErrorScreen";
import { SkeletonBox } from "@/components/SkeletonBox";
import { useToast } from "@/context/ToastContext";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/ScreenBackground";

const CATEGORY_COLORS: Record<string, string> = {
  Nightlife: "#7c3aed", Community: "#0ea5e9", Art: "#ea580c",
  Music: "#dc2626", Sports: "#16a34a", Food: "#ca8a04", Culture: "#db2777",
};

type PageData = {
  id: number; name: string; description: string; category: string;
  createdBy: string; avatarColor: string; followerCount: number; following: boolean;
};

export default function PageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pageId = parseInt(id, 10);
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [page, setPage] = useState<PageData | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [bubbles, setBubbles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<"events" | "bubbles">("events");
  const [followLoading, setFollowLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, content] = await Promise.all([
        getPage(pageId, user ?? undefined),
        getPageContent(pageId),
      ]);
      setPage(p);
      setEvents(content.events || []);
      setBubbles(content.bubbles || []);
    } catch {
      setLoadError(true);
    }
    finally { setLoading(false); }
  }, [pageId, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleFollow = async () => {
    if (!user) { router.push("/signin"); return; }
    if (!page) return;
    setFollowLoading(true);
    try {
      const result = await toggleFollow(pageId, user);
      setPage((prev) => prev ? { ...prev, following: result.following, followerCount: result.followerCount } : prev);
    } catch {
      showToast("Couldn't update follow. Try again.");
    }
    finally { setFollowLoading(false); }
  };

  if (loadError) {
    return <ErrorScreen message="Couldn't load this page." onRetry={load} />;
  }

  if (loading || !page) {
    return (
      <View style={s.center}>
        <View style={{ gap: 16, padding: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <SkeletonBox width={64} height={64} borderRadius={32} />
            <View style={{ gap: 8 }}>
              <SkeletonBox width={160} height={18} borderRadius={6} />
              <SkeletonBox width={100} height={13} borderRadius={6} />
            </View>
          </View>
          <SkeletonBox width="100%" height={44} borderRadius={14} />
          <SkeletonBox width="100%" height={13} borderRadius={6} />
          <SkeletonBox width="70%" height={13} borderRadius={6} />
        </View>
      </View>
    );
  }

  const catColor = CATEGORY_COLORS[page.category] ?? "#7c3aed";

  return (
    <ScreenBackground style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.hero}>
          <View style={[s.avatar, { backgroundColor: page.avatarColor }]}>
            <Text style={s.avatarText}>{page.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{page.name}</Text>
          <View style={s.heroMeta}>
            {page.category ? (
              <View style={[s.catBadge, { backgroundColor: `${catColor}22` }]}>
                <Text style={[s.catBadgeText, { color: catColor }]}>{page.category}</Text>
              </View>
            ) : null}
            <Text style={s.followerCount}>
              {page.followerCount} follower{page.followerCount !== 1 ? "s" : ""}
            </Text>
          </View>
          <Text style={s.hostedBy}>Hosted by @{page.createdBy}</Text>

          {/* Follow button */}
          {user !== page.createdBy && (
            <Pressable
              style={[s.followBtn, page.following && s.followingBtn, followLoading && { opacity: 0.6 }]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              <Text style={[s.followBtnText, page.following && s.followingBtnText]}>
                {page.following ? "✓ Following" : "Follow"}
              </Text>
            </Pressable>
          )}

          {page.description ? <Text style={s.description}>{page.description}</Text> : null}
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <Pressable style={[s.tab, tab === "events" && s.tabActive]} onPress={() => setTab("events")}>
            <Text style={[s.tabText, tab === "events" && s.tabTextActive]}>
              Events ({events.length})
            </Text>
          </Pressable>
          <Pressable style={[s.tab, tab === "bubbles" && s.tabActive]} onPress={() => setTab("bubbles")}>
            <Text style={[s.tabText, tab === "bubbles" && s.tabTextActive]}>
              Bubbles ({bubbles.length})
            </Text>
          </Pressable>
        </View>

        {/* Events */}
        {tab === "events" && (
          <View style={s.contentList}>
            {events.length === 0 ? (
              <Text style={s.emptyText}>No events posted yet.</Text>
            ) : (
              events.map((e) => (
                <Pressable
                  key={e.id}
                  style={s.contentCard}
                  onPress={() => router.push({ pathname: "/event-details", params: { id: e.id } })}
                >
                  <View style={[s.contentDot, { backgroundColor: "#dc2626" }]}>
                    <Text style={s.contentDotText}>{(e.title ?? "E").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={s.contentInfo}>
                    <Text style={s.contentName}>{e.title}</Text>
                    <Text style={s.contentMeta}>{e.location}{e.time ? ` · ${e.time}` : ""}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Bubbles */}
        {tab === "bubbles" && (
          <View style={s.contentList}>
            {bubbles.length === 0 ? (
              <Text style={s.emptyText}>No active bubbles.</Text>
            ) : (
              bubbles.map((b) => (
                <Pressable
                  key={b.id}
                  style={s.contentCard}
                  onPress={() => router.push({ pathname: "/bubble-detail", params: { id: b.id } })}
                >
                  <View style={[s.contentDot, { backgroundColor: "#7c3aed" }]}>
                    <Text style={s.contentDotText}>{b.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={s.contentInfo}>
                    <Text style={s.contentName}>{b.name}</Text>
                    <Text style={s.contentMeta}>
                      {b.type ? `${b.type} · ` : ""}{b.members.length} member{b.members.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

      </ScrollView>
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 40 },

  hero: { alignItems: "center", padding: 24, gap: 10, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  avatarText: { color: "#fff", fontSize: 38, fontWeight: "700" },
  name: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center" },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  catBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  catBadgeText: { fontSize: 12, fontWeight: "700" },
  followerCount: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  hostedBy: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  description: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 4 },

  followBtn: {
    paddingHorizontal: 32, paddingVertical: 10, borderRadius: 24,
    borderWidth: 1.5, borderColor: "#dc2626", marginTop: 4,
  },
  followBtnText: { color: "#dc2626", fontSize: 15, fontWeight: "700" },
  followingBtn: { backgroundColor: "rgba(220,38,38,0.12)" },
  followingBtnText: { color: "rgba(220,38,38,0.8)" },

  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderColor: "#dc2626" },
  tabText: { color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#fff" },

  contentList: { padding: 20, gap: 12 },
  emptyText: { color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center", marginTop: 20 },
  contentCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  contentDot: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  contentDotText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  contentInfo: { flex: 1 },
  contentName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  contentMeta: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
});

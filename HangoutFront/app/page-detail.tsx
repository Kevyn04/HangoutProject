import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, StatusBar, RefreshControl, Modal, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import type { ThemeColors } from "@/constants/theme";
import {
  getPage, getPageContent, toggleFollow,
  getPagePosts, createPagePost, deletePagePost, PagePost,
  getPageModerators, addPageModerator, removePageModerator,
  getPageAnalytics, PageAnalytics,
} from "@/services/api";
import { ErrorScreen } from "@/components/ErrorScreen";
import { SkeletonBox } from "@/components/SkeletonBox";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/context/ToastContext";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ReportSheet, ReportTarget } from "@/components/ReportSheet";

const CATEGORY_COLORS: Record<string, string> = {
  Nightlife: "#7c3aed", Community: "#0ea5e9", Art: "#ea580c",
  Music: "#dc2626", Sports: "#16a34a", Food: "#ca8a04", Culture: "#db2777",
};

type PageData = {
  id: number; name: string; description: string; category: string;
  createdBy: string; avatarColor: string; followerCount: number; following: boolean;
};

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function PageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pageId = parseInt(id, 10);
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);
  const router = useRouter();
  const { showToast } = useToast();

  const [page, setPage] = useState<PageData | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [bubbles, setBubbles] = useState<any[]>([]);
  const [posts, setPosts] = useState<PagePost[]>([]);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [moderators, setModerators] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState<PageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<"posts" | "events" | "bubbles">("posts");
  const [followLoading, setFollowLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Composer
  const [postInput, setPostInput] = useState("");
  const [posting, setPosting] = useState(false);

  // Moderator modal
  const [showMods, setShowMods] = useState(false);
  const [modInput, setModInput] = useState("");
  const [modBusy, setModBusy] = useState(false);

  const isOwner = !!page && user === page.createdBy;
  const canPost = !!user && (isOwner || moderators.includes(user));

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const [p, content, pagePosts, mods] = await Promise.all([
        getPage(pageId, user ?? undefined),
        getPageContent(pageId),
        getPagePosts(pageId).catch(() => [] as PagePost[]),
        getPageModerators(pageId).catch(() => [] as string[]),
      ]);
      setPage(p);
      setEvents(content.events || []);
      setBubbles(content.bubbles || []);
      setPosts(pagePosts);
      setModerators(mods);
      if (user === p.createdBy) {
        getPageAnalytics(pageId).then(setAnalytics).catch(() => {});
      }
    } catch {
      setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [pageId, user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

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

  const handlePost = async () => {
    const content = postInput.trim();
    if (!content || !user || posting) return;
    setPosting(true);
    try {
      await createPagePost(pageId, user, content);
      setPostInput("");
      setPosts(await getPagePosts(pageId));
    } catch {
      showToast("Couldn't publish post. Try again.");
    } finally { setPosting(false); }
  };

  const handleDeletePost = (post: PagePost) => {
    Alert.alert("Delete Post", "Remove this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deletePagePost(post.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
          } catch {
            showToast("Couldn't delete post.");
          }
        },
      },
    ]);
  };

  const handleAddModerator = async () => {
    const name = modInput.trim();
    if (!name || !user || modBusy) return;
    if (name === user) { showToast("You already manage this page."); return; }
    setModBusy(true);
    try {
      await addPageModerator(pageId, name, user);
      setModInput("");
      setModerators(await getPageModerators(pageId));
      showToast(`@${name} is now a moderator`, "success");
    } catch {
      showToast("Couldn't add moderator. Check the username.");
    } finally { setModBusy(false); }
  };

  const handleRemoveModerator = async (name: string) => {
    setModBusy(true);
    try {
      await removePageModerator(pageId, name);
      setModerators((prev) => prev.filter((m) => m !== name));
    } catch {
      showToast("Couldn't remove moderator.");
    } finally { setModBusy(false); }
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
      <StatusBar
        barStyle={colors.statusBarStyle === "light" ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.red} colors={[colors.red]} />}
      >

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

          {/* Owner: analytics + moderator management */}
          {isOwner && (
            <>
              {analytics && (
                <View style={s.analyticsRow}>
                  <View style={s.analyticsCell}>
                    <Text style={s.analyticsNum}>{analytics.followerCount}</Text>
                    <Text style={s.analyticsLabel}>Followers</Text>
                  </View>
                  <View style={s.analyticsCell}>
                    <Text style={[s.analyticsNum, analytics.gained7d > 0 && { color: "#22c55e" }]}>
                      {analytics.gained7d > 0 ? `+${analytics.gained7d}` : analytics.gained7d}
                    </Text>
                    <Text style={s.analyticsLabel}>Last 7d</Text>
                  </View>
                  <View style={s.analyticsCell}>
                    <Text style={[s.analyticsNum, analytics.gained30d > 0 && { color: "#22c55e" }]}>
                      {analytics.gained30d > 0 ? `+${analytics.gained30d}` : analytics.gained30d}
                    </Text>
                    <Text style={s.analyticsLabel}>Last 30d</Text>
                  </View>
                  <View style={s.analyticsCell}>
                    <Text style={s.analyticsNum}>{analytics.postCount}</Text>
                    <Text style={s.analyticsLabel}>Posts</Text>
                  </View>
                </View>
              )}
              <Pressable style={s.modsBtn} onPress={() => setShowMods(true)}>
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.textSub} />
                <Text style={s.modsBtnText}>
                  Moderators ({moderators.length})
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <Pressable style={[s.tab, tab === "posts" && s.tabActive]} onPress={() => setTab("posts")}>
            <Text style={[s.tabText, tab === "posts" && s.tabTextActive]}>
              Posts ({posts.length})
            </Text>
          </Pressable>
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

        {/* Posts */}
        {tab === "posts" && (
          <View style={s.contentList}>
            {canPost && (
              <View style={s.composer}>
                <TextInput
                  style={s.composerInput}
                  placeholder="Share an update with your followers…"
                  placeholderTextColor={colors.textGhost}
                  value={postInput}
                  onChangeText={setPostInput}
                  multiline
                  maxLength={2000}
                />
                <Pressable
                  style={[s.composerBtn, (!postInput.trim() || posting) && { opacity: 0.4 }]}
                  onPress={handlePost}
                  disabled={!postInput.trim() || posting}
                >
                  {posting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.composerBtnText}>Post</Text>}
                </Pressable>
              </View>
            )}
            {posts.length === 0 ? (
              <EmptyState
                icon="megaphone-outline"
                title="No posts yet"
                subtitle={canPost ? "Post your first update for followers." : "This page hasn't posted any updates."}
              />
            ) : (
              posts.map((p) => {
                const canDelete = user === p.username || canPost;
                return (
                  <View key={p.id} style={s.postCard}>
                    <View style={s.postHeader}>
                      <Text style={s.postAuthor}>@{p.username}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={s.postTime}>{timeAgo(p.createdAt)}</Text>
                        {canDelete && (
                          <Pressable onPress={() => handleDeletePost(p)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                          </Pressable>
                        )}
                        {!!user && user !== p.username && (
                          <Pressable
                            onPress={() => setReportTarget({ kind: "page_post", contentId: p.id, author: p.username })}
                            hitSlop={8}
                            accessibilityLabel="Report post"
                          >
                            <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
                          </Pressable>
                        )}
                      </View>
                    </View>
                    <Text style={s.postContent}>{p.content}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Events */}
        {tab === "events" && (
          <View style={s.contentList}>
            {events.length === 0 ? (
              <EmptyState icon="calendar-outline" title="No events yet" subtitle="This page hasn't posted any events." />
            ) : (
              events.map((e) => (
                <Pressable
                  key={e.id}
                  style={s.contentCard}
                  onPress={() => router.push({ pathname: "/event-details", params: { id: e.id } })}
                >
                  <View style={[s.contentDot, { backgroundColor: colors.red }]}>
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
              <EmptyState icon="people-circle-outline" title="No active bubbles" subtitle="No bubbles are running under this page right now." />
            ) : (
              bubbles.map((b) => (
                <Pressable
                  key={b.id}
                  style={s.contentCard}
                  onPress={() => router.push({ pathname: "/bubble-detail", params: { id: b.id } })}
                >
                  <View style={[s.contentDot, { backgroundColor: colors.purple }]}>
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

      {/* Moderator management (owner only) */}
      <Modal visible={showMods} transparent animationType="slide" onRequestClose={() => setShowMods(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowMods(false)} />
        <View style={s.modSheet}>
          <View style={s.modHandle} />
          <Text style={s.modTitle}>Moderators</Text>
          <Text style={s.modSub}>Moderators can post updates and remove posts on this page.</Text>

          <View style={s.modInputRow}>
            <TextInput
              style={s.modInput}
              placeholder="Add by username"
              placeholderTextColor={colors.textGhost}
              autoCapitalize="none"
              value={modInput}
              onChangeText={setModInput}
              onSubmitEditing={handleAddModerator}
              returnKeyType="done"
            />
            <Pressable
              style={[s.modAddBtn, (!modInput.trim() || modBusy) && { opacity: 0.4 }]}
              onPress={handleAddModerator}
              disabled={!modInput.trim() || modBusy}
            >
              <Text style={s.modAddBtnText}>Add</Text>
            </Pressable>
          </View>

          {moderators.length === 0 ? (
            <Text style={s.modEmpty}>No moderators yet.</Text>
          ) : (
            moderators.map((m) => (
              <View key={m} style={s.modRow}>
                <Text style={s.modName}>@{m}</Text>
                <Pressable onPress={() => handleRemoveModerator(m)} disabled={modBusy} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.red} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </Modal>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </ScreenBackground>
  );
}

function buildStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { paddingBottom: 40 },

    hero: { alignItems: "center", padding: 24, gap: 10, borderBottomWidth: 1, borderColor: colors.borderFaint },
    avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    // White text on the page's own arbitrary avatarColor — stays fixed regardless
    // of app theme, same convention as UserAvatar elsewhere.
    avatarText: { color: "#fff", fontSize: 38, fontWeight: "700" },
    name: { color: colors.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
    heroMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
    catBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
    catBadgeText: { fontSize: 12, fontWeight: "700" },
    followerCount: { color: colors.textSub, fontSize: 14 },
    hostedBy: { color: colors.textMuted, fontSize: 13 },
    description: { color: colors.textSub, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 4 },

    followBtn: {
      paddingHorizontal: 32, paddingVertical: 10, borderRadius: 24,
      borderWidth: 1.5, borderColor: colors.red, marginTop: 4,
    },
    followBtnText: { color: colors.red, fontSize: 15, fontWeight: "700" },
    followingBtn: { backgroundColor: colors.redSubtle },
    followingBtnText: { color: colors.red },

    analyticsRow: {
      flexDirection: "row", width: "100%", marginTop: 8,
      backgroundColor: colors.cardFaint, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, paddingVertical: 12,
    },
    analyticsCell: { flex: 1, alignItems: "center", gap: 2 },
    analyticsNum: { color: colors.text, fontSize: 17, fontWeight: "800" },
    analyticsLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },

    modsBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      borderWidth: 1, borderColor: colors.borderLight,
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginTop: 2,
    },
    modsBtnText: { color: colors.textSub, fontSize: 13, fontWeight: "600" },

    tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: colors.borderFaint },
    tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
    tabActive: { borderBottomWidth: 2, borderColor: colors.red },
    tabText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    tabTextActive: { color: colors.text },

    contentList: { padding: 20, gap: 12 },
    contentCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.cardFaint, borderRadius: 12,
      padding: 14, borderWidth: 1, borderColor: colors.borderFaint,
    },
    contentDot: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    // White text on a fixed red/purple dot background — unaffected by theme.
    contentDotText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    contentInfo: { flex: 1 },
    contentName: { color: colors.text, fontSize: 14, fontWeight: "700" },
    contentMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

    // Posts
    composer: {
      backgroundColor: colors.cardFaint, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10,
    },
    composerInput: { color: colors.text, fontSize: 14, minHeight: 44, maxHeight: 120, textAlignVertical: "top" },
    composerBtn: {
      alignSelf: "flex-end", backgroundColor: colors.red, borderRadius: 18,
      paddingHorizontal: 20, paddingVertical: 8,
    },
    composerBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    postCard: {
      backgroundColor: colors.cardFaint, borderRadius: 14,
      borderWidth: 1, borderColor: colors.borderFaint, padding: 14, gap: 8,
    },
    postHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    postAuthor: { color: colors.purple, fontSize: 13, fontWeight: "700" },
    postTime: { color: colors.textGhost, fontSize: 11 },
    postContent: { color: colors.text, fontSize: 14, lineHeight: 20 },

    // Moderator modal
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    modSheet: {
      backgroundColor: colors.bgMid, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderTopWidth: 1, borderColor: colors.borderFaint,
      padding: 20, paddingBottom: 40, maxHeight: "70%",
    },
    modHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.textGhost, alignSelf: "center", marginBottom: 16 },
    modTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 4 },
    modSub: { color: colors.textMuted, fontSize: 12, marginBottom: 16 },
    modInputRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    modInput: {
      flex: 1, backgroundColor: colors.card, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 15,
    },
    modAddBtn: {
      backgroundColor: colors.red, borderRadius: 12,
      paddingHorizontal: 18, alignItems: "center", justifyContent: "center",
    },
    modAddBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    modEmpty: { color: colors.textMuted, fontSize: 13, fontStyle: "italic", textAlign: "center", paddingVertical: 10 },
    modRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.borderFaint,
    },
    modName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  });
}

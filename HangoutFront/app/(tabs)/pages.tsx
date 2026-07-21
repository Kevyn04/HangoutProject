import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import { getPages, toggleFollow } from "@/services/api";
import { SkeletonBox } from "@/components/SkeletonBox";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/context/ToastContext";
import { ScreenBackground } from "@/components/ScreenBackground";

const CATEGORIES = ["All", "Nightlife", "Community", "Art", "Music", "Sports", "Food", "Culture"];

const CATEGORY_COLORS: Record<string, string> = {
  Nightlife: "#7c3aed",
  Community: "#0ea5e9",
  Art:       "#ea580c",
  Music:     "#dc2626",
  Sports:    "#16a34a",
  Food:      "#ca8a04",
  Culture:   "#db2777",
};

type PageItem = {
  id: number; name: string; description: string; category: string;
  createdBy: string; avatarColor: string; followerCount: number; following: boolean;
};

export default function PagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);
  const { showToast } = useToast();

  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const data = await getPages(user ?? undefined);
      setPages(data);
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

  const handleFollow = async (pageId: number) => {
    if (!user) { router.push("/signin"); return; }
    try {
      const result = await toggleFollow(pageId, user);
      setPages((prev) => prev.map((p) =>
        p.id === pageId
          ? { ...p, following: result.following, followerCount: result.followerCount }
          : p
      ));
    } catch {
      showToast("Couldn't update follow. Try again.");
    }
  };

  const myPage = user ? pages.find((p) => p.createdBy === user) : undefined;

  const filtered = pages.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <ScreenBackground style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Pages</Text>
        {user && (
          myPage
            ? <Pressable style={s.myPageBtn} onPress={() => router.push({ pathname: "/page-detail", params: { id: myPage.id } })}>
                <Text style={s.myPageBtnText}>My Page</Text>
              </Pressable>
            : <Pressable style={s.createBtn} onPress={() => router.push("/create-page")}>
                <Text style={s.createBtnText}>+ Create</Text>
              </Pressable>
        )}
      </View>
      <Text style={s.subtitle}>Discover communities & event hosts</Text>

      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder="Search pages..."
          placeholderTextColor={colors.textGhost}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsContent}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[s.chip, activeCategory === cat && s.chipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[s.chipText, activeCategory === cat && s.chipTextActive]}>{cat}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Pages list */}
      {loadError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>Couldn't load pages.</Text>
          <Pressable style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.redBorder, backgroundColor: colors.redSubtle }} onPress={() => load()}>
            <Text style={{ color: colors.red, fontWeight: "700" }}>Try Again</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.red} colors={[colors.red]} />}>
          {[0,1,2,3].map((i) => (
            <View key={i} style={s.card}>
              <View style={s.cardTop}>
                <SkeletonBox width={50} height={50} borderRadius={25} />
                <View style={{ flex: 1, gap: 9 }}>
                  <SkeletonBox width="55%" height={15} borderRadius={6} />
                  <SkeletonBox width="38%" height={11} borderRadius={6} />
                </View>
                <SkeletonBox width={72} height={30} borderRadius={20} />
              </View>
              <SkeletonBox width="75%" height={11} borderRadius={6} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.red} colors={[colors.red]} />}>
          {filtered.length === 0 ? (
            <EmptyState
              icon="megaphone-outline"
              title={search ? "No results" : "No communities yet"}
              subtitle={
                search
                  ? `Nothing matched "${search}". Try a different term.`
                  : "Pages are hubs for communities and event hosts. Create one to get started."
              }
              action={!search && user ? { label: "Create a Page", onPress: () => router.push("/create-page") } : undefined}
            />
          ) : (
            filtered.map((page) => (
              <Pressable
                key={page.id}
                style={({ pressed }) => [s.card, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/page-detail", params: { id: page.id } });
                }}
              >
                {/* Avatar + info */}
                <View style={s.cardTop}>
                  <View style={[s.avatar, { backgroundColor: page.avatarColor }]}>
                    <Text style={s.avatarText}>{page.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.cardName}>{page.name}</Text>
                    <View style={s.cardMeta}>
                      {page.category ? (
                        <View style={[s.catBadge, { backgroundColor: `${CATEGORY_COLORS[page.category] ?? "#7c3aed"}22` }]}>
                          <Text style={[s.catBadgeText, { color: CATEGORY_COLORS[page.category] ?? "#c4b5fd" }]}>
                            {page.category}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={s.followers}>
                        {page.followerCount} follower{page.followerCount !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>

                  {/* Follow button */}
                  <Pressable
                    style={[s.followBtn, page.following && s.followingBtn]}
                    onPress={(e) => { e.stopPropagation?.(); handleFollow(page.id); }}
                  >
                    <Text style={[s.followBtnText, page.following && s.followingBtnText]}>
                      {page.following ? "Following" : "Follow"}
                    </Text>
                  </Pressable>
                </View>

                {page.description ? (
                  <Text style={s.cardDesc} numberOfLines={2}>{page.description}</Text>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </ScreenBackground>
  );

}

function buildStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, paddingTop: 56 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 4 },
    headerTitle: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: 0.5 },
    createBtn: { backgroundColor: colors.red, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    myPageBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.red },
    myPageBtnText: { color: colors.red, fontWeight: "700", fontSize: 14 },
    subtitle: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 20, marginBottom: 14 },

    searchRow: { paddingHorizontal: 20, marginBottom: 12 },
    searchInput: {
      backgroundColor: colors.card, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 14,
      borderWidth: 1, borderColor: colors.borderFaint,
    },

    chips: { flexGrow: 0, marginBottom: 12 },
    chipsContent: { paddingHorizontal: 20, gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.borderFaint,
    },
    chipActive: { backgroundColor: colors.red, borderColor: colors.red },
    chipText: { color: colors.textSub, fontSize: 13, fontWeight: "600" },
    chipTextActive: { color: "#fff" },

    list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
    empty: { alignItems: "center", marginTop: 60, gap: 8 },
    emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: "600" },
    emptySub: { color: colors.textGhost, fontSize: 13 },

    card: {
      backgroundColor: colors.card, borderRadius: 16,
      padding: 16, borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border, borderTopColor: colors.borderLight,
      gap: 10,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
    cardInfo: { flex: 1 },
    cardName: { color: colors.text, fontSize: 16, fontWeight: "700" },
    cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    catBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    catBadgeText: { fontSize: 11, fontWeight: "700" },
    followers: { color: colors.textMuted, fontSize: 12 },
    cardDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },

    followBtn: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: colors.red,
    },
    followBtnText: { color: colors.red, fontSize: 13, fontWeight: "700" },
    followingBtn: { backgroundColor: colors.redSubtle },
    followingBtnText: { color: "rgba(220,38,38,0.8)" },
  });
}

import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getDMConversations, DmConversation } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import type { ThemeColors } from "@/constants/theme";
import { ScreenBackground } from "@/components/ScreenBackground";
import { UserAvatar } from "@/components/UserAvatar";

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch { return ""; }
}

export default function DmsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);

  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const data = await getDMConversations(user);
      setConversations(data);
    } catch {}
    if (!silent) setLoading(false);
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openChat = (partner: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/dm-chat", params: { partner } });
  };

  return (
    <ScreenBackground style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Messages</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.red} style={{ marginTop: 40 }} />
      ) : conversations.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.borderLight} />
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptyHint}>Go to someone's profile and tap Message to start a chat.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.partner}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.red} />}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => openChat(item.partner)}>
              <UserAvatar username={item.partner} size={50} />
              <View style={s.rowBody}>
                <View style={s.rowTop}>
                  <Text style={s.rowName}>{item.partner}</Text>
                  <Text style={s.rowTime}>{fmtTime(item.lastMessageAt)}</Text>
                </View>
                <View style={s.rowBottom}>
                  <Text style={[s.rowPreview, item.unreadCount > 0 && s.rowPreviewUnread]} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </ScreenBackground>
  );
}

function buildStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, paddingTop: 56 },

    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingBottom: 14, gap: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },

    list: { paddingVertical: 8 },

    row: {
      flexDirection: "row", alignItems: "center", gap: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderColor: colors.borderFaint,
    },
    rowBody: { flex: 1 },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    rowName: { color: colors.text, fontSize: 15, fontWeight: "700" },
    rowTime: { color: colors.textGhost, fontSize: 12 },
    rowBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowPreview: { flex: 1, color: colors.textMuted, fontSize: 13 },
    rowPreviewUnread: { color: colors.text, fontWeight: "600" },

    badge: {
      backgroundColor: colors.red, borderRadius: 10,
      minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    },
    badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
    emptyTitle: { color: colors.textSub, fontSize: 16, fontWeight: "700" },
    emptyHint: { color: colors.textGhost, fontSize: 13, textAlign: "center", lineHeight: 20 },
  });
}

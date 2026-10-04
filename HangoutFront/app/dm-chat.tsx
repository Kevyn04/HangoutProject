import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { setActiveDmPartner } from "@/hooks/use-push-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import type { ThemeColors } from "@/constants/theme";
import { useToast } from "@/context/ToastContext";
import { getDMMessages, sendDM, markDMsRead, canDM, getIsBlocked, DmMessage } from "@/services/api";
import { supabase } from "@/services/supabase";
import { ScreenBackground } from "@/components/ScreenBackground";
import { UserAvatar } from "@/components/UserAvatar";
import { ReportSheet, ReportTarget } from "@/components/ReportSheet";

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export default function DmChatScreen() {
  const { partner } = useLocalSearchParams<{ partner: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);
  const { showToast } = useToast();
  const router = useRouter();

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // null = still checking; "blocked" = I blocked them; "unavailable" = they blocked me
  const [blockState, setBlockState] = useState<null | "ok" | "blocked" | "unavailable">(null);
  const listRef = useRef<FlatList>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const scrollToBottom = (animated = true) =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 50);

  const load = useCallback(async () => {
    if (!user || !partner) return;
    try {
      const data = await getDMMessages(user, partner);
      setMessages(data);
      scrollToBottom(false);
      await markDMsRead(user, partner);
    } catch {
      showToast("Couldn't load messages.");
    } finally {
      setLoading(false);
    }
  }, [user, partner]);

  // Suppress push banners for this conversation while it's on screen.
  useFocusEffect(useCallback(() => {
    setActiveDmPartner(partner ?? null);
    return () => setActiveDmPartner(null);
  }, [partner]));

  useEffect(() => {
    if (!user || !partner) return;
    Promise.all([getIsBlocked(user, partner), canDM(partner)])
      .then(([iBlocked, allowed]) => setBlockState(iBlocked ? "blocked" : allowed ? "ok" : "unavailable"))
      .catch(() => setBlockState("ok"));
  }, [user, partner]);

  useEffect(() => {
    load();

    if (!user) return;
    const ch = supabase
      .channel(`dm-${[user, partner].sort().join("-")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_username=eq.${user}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.sender_username !== partner) return;
          const msg: DmMessage = {
            id: row.id,
            senderUsername: row.sender_username,
            recipientUsername: row.recipient_username,
            content: row.content,
            read: row.read,
            createdAt: row.created_at,
          };
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          scrollToBottom(true);
          markDMsRead(user, partner);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, partner, load]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user || !partner) return;
    setInput("");
    setSending(true);
    try {
      const msg = await sendDM(user, partner, text);
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      scrollToBottom(true);
    } catch {
      showToast("Couldn't send message.");
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenBackground style={{ flex: 1, paddingTop: 56 }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          style={s.headerUser}
          onPress={() => router.push({ pathname: "/user-profile", params: { username: partner } })}
        >
          <UserAvatar username={partner ?? ""} size={34} />
          <Text style={s.headerName}>{partner}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={56}
      >
        {loading ? (
          <ActivityIndicator color={colors.red} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={s.list}
            ListEmptyComponent={
              <Text style={s.emptyText}>No messages yet. Say hi!</Text>
            }
            renderItem={({ item }) => {
              const isMe = item.senderUsername === user;
              return (
                <Pressable
                  style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}
                  onLongPress={isMe ? undefined : () => setReportTarget({ kind: "dm_message", contentId: item.id, author: item.senderUsername })}
                  delayLongPress={400}
                >
                  <Text style={[s.msgText, isMe && s.msgTextMe]}>{item.content}</Text>
                  <Text style={[s.time, isMe && s.timeMe]}>{fmtTime(item.createdAt)}</Text>
                </Pressable>
              );
            }}
          />
        )}

        {blockState === "blocked" || blockState === "unavailable" ? (
          <View style={s.blockedRow}>
            <Ionicons name="ban-outline" size={16} color={colors.textMuted} />
            <Text style={s.blockedText}>
              {blockState === "blocked"
                ? "You blocked this user. Unblock them from their profile to message."
                : "You can't message this user."}
            </Text>
          </View>
        ) : (
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor={colors.textGhost}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            maxLength={1000}
          />
          <Pressable
            style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </Pressable>
        </View>
        )}
      </KeyboardAvoidingView>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </ScreenBackground>
  );
}

function buildStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingBottom: 12, gap: 12,
      borderBottomWidth: 1, borderColor: colors.borderFaint,
    },
    backBtn: { padding: 4 },
    headerUser: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    headerName: { color: colors.text, fontSize: 16, fontWeight: "700" },

    list: { padding: 16, gap: 6, paddingBottom: 8 },
    emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 40 },

    bubble: { maxWidth: "78%", borderRadius: 18, padding: 10, paddingHorizontal: 14, marginVertical: 2 },
    bubbleMe: { alignSelf: "flex-end", backgroundColor: colors.red },
    bubbleOther: {
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.borderFaint,
    },
    // Themed text for the default "other" bubble (themed card bg);
    // msgTextMe/timeMe below override for the solid-red "me" bubble.
    msgText: { color: colors.text, fontSize: 15, lineHeight: 20 },
    msgTextMe: { color: "#fff" },
    time: { color: colors.textMuted, fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
    timeMe: { color: "rgba(255,255,255,0.7)" },

    inputRow: {
      flexDirection: "row", alignItems: "flex-end", gap: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      borderTopWidth: 1, borderColor: colors.borderFaint,
      backgroundColor: colors.bgMid,
    },
    input: {
      flex: 1, minHeight: 40, maxHeight: 100, borderRadius: 20,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 15,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.red, alignItems: "center", justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.4 },
    blockedRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      paddingHorizontal: 20, paddingVertical: 18,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    blockedText: { color: colors.textMuted, fontSize: 13, textAlign: "center", flexShrink: 1 },
  });
}

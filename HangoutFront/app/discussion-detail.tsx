import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import type { ThemeColors } from "@/constants/theme";
import { useToast } from "@/context/ToastContext";
import { getDiscussionReplies, addDiscussionReply } from "@/services/api";
import { ScreenBackground } from "@/components/ScreenBackground";

type Reply = { id: number; username: string; content: string; createdAt: string };

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function DiscussionDetailScreen() {
  const { discussionId, title, body, createdBy } = useLocalSearchParams<{
    discussionId: string; title: string; body?: string; createdBy: string;
  }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);
  const { showToast } = useToast();
  const did = Number(discussionId);

  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    getDiscussionReplies(did)
      .then((data) => { setReplies(data); setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50); })
      .catch(() => showToast("Couldn't load replies."))
      .finally(() => setLoading(false));
  }, [did]);

  const handleReply = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput("");
    setSending(true);
    try {
      await addDiscussionReply(did, user, text);
      const updated = await getDiscussionReplies(did);
      setReplies(updated);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      showToast("Couldn't post reply.");
      setInput(text);
    } finally { setSending(false); }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={replies}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <View style={s.postCard}>
              <Text style={s.postTitle}>{title}</Text>
              {!!body && <Text style={s.postBody}>{body}</Text>}
              <Text style={s.postMeta}>by {createdBy}</Text>
              <View style={s.divider} />
              <Text style={s.repliesLabel}>{replies.length} {replies.length === 1 ? "Reply" : "Replies"}</Text>
            </View>
          }
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.text} style={{ marginTop: 20 }} /> : <Text style={s.empty}>No replies yet. Be first!</Text>}
          renderItem={({ item }) => (
            <View style={s.replyCard}>
              <View style={s.replyHeader}>
                <Text style={s.replyUser}>{item.username}</Text>
                <Text style={s.replyTime}>{fmtTime(item.createdAt)}</Text>
              </View>
              <Text style={s.replyContent}>{item.content}</Text>
            </View>
          )}
        />

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Write a reply…"
            placeholderTextColor={colors.textGhost}
            multiline
          />
          <Pressable style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]} onPress={handleReply} disabled={!input.trim() || sending}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendBtnText}>Reply</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function buildStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { padding: 16, gap: 10, paddingBottom: 8 },
    empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 20 },

    postCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 8,
    },
    postTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
    postBody: { color: colors.textSub, fontSize: 15, lineHeight: 22, marginBottom: 10 },
    postMeta: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
    divider: { height: 1, backgroundColor: colors.borderFaint, marginVertical: 12 },
    repliesLabel: { color: colors.textSub, fontSize: 13, fontWeight: "700" },

    replyCard: {
      backgroundColor: colors.cardFaint, borderRadius: 12,
      borderWidth: 1, borderColor: colors.borderFaint, padding: 12,
    },
    replyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    replyUser: { color: colors.red, fontSize: 13, fontWeight: "700" },
    replyTime: { color: colors.textGhost, fontSize: 11 },
    replyContent: { color: colors.text, fontSize: 14, lineHeight: 20 },

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
      height: 40, paddingHorizontal: 16, borderRadius: 20,
      backgroundColor: colors.red, alignItems: "center", justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
}

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/services/auth-context";
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
          ListEmptyComponent={loading ? <ActivityIndicator color="#fff" style={{ marginTop: 20 }} /> : <Text style={s.empty}>No replies yet. Be first!</Text>}
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
            placeholderTextColor="rgba(255,255,255,0.3)"
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

const s = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 8 },
  empty: { color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", marginTop: 20 },

  postCard: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 16, marginBottom: 8,
  },
  postTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  postBody: { color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 22, marginBottom: 10 },
  postMeta: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontStyle: "italic" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 12 },
  repliesLabel: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "700" },

  replyCard: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 12,
  },
  replyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  replyUser: { color: "#dc2626", fontSize: 13, fontWeight: "700" },
  replyTime: { color: "rgba(255,255,255,0.3)", fontSize: 11 },
  replyContent: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },

  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 15,
  },
  sendBtn: {
    height: 40, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

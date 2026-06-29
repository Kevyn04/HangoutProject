import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/services/auth-context";
import { useToast } from "@/context/ToastContext";
import { getDMMessages, sendDM, markDMsRead, DmMessage } from "@/services/api";
import { supabase } from "@/services/supabase";
import { ScreenBackground } from "@/components/ScreenBackground";
import { UserAvatar } from "@/components/UserAvatar";

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export default function DmChatScreen() {
  const { partner } = useLocalSearchParams<{ partner: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

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
          <Ionicons name="arrow-back" size={22} color="#fff" />
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
          <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
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
                <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
                  <Text style={s.msgText}>{item.content}</Text>
                  <Text style={s.time}>{fmtTime(item.createdAt)}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor="rgba(255,255,255,0.3)"
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
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
    borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  backBtn: { padding: 4 },
  headerUser: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerName: { color: "#fff", fontSize: 16, fontWeight: "700" },

  list: { padding: 16, gap: 6, paddingBottom: 8 },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", marginTop: 40 },

  bubble: { maxWidth: "78%", borderRadius: 18, padding: 10, paddingHorizontal: 14, marginVertical: 2 },
  bubbleMe: { alignSelf: "flex-end", backgroundColor: "#dc2626" },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  msgText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  time: { color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 4, alignSelf: "flex-end" },

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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});

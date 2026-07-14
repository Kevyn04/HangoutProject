import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/services/auth-context";
import { useToast } from "@/context/ToastContext";
import { getEventMessages, sendEventMessage, uploadChatImage } from "@/services/api";
import { supabase } from "@/services/supabase";
import { ScreenBackground } from "@/components/ScreenBackground";

type Msg = { id: number; username: string; message: string; imageUrl?: string | null; createdAt: string };

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export default function EventChatScreen() {
  const { eventId, title } = useLocalSearchParams<{ eventId: string; title: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const eid = Number(eventId);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const data = await getEventMessages(eid);
      setMessages(data);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    } catch {
      showToast("Couldn't load messages.");
    }
  }, [eid]);

  useEffect(() => {
    load();

    const ch = supabase
      .channel(`event-chat-${eid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eid}` },
        (payload) => {
          const row = payload.new as any;
          const msg: Msg = { id: row.id, username: row.username, message: row.message, imageUrl: row.image_url ?? null, createdAt: row.created_at };
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [eid, load]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput("");
    setSending(true);
    try {
      await sendEventMessage(eid, user, text);
    } catch {
      showToast("Couldn't send message.");
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async () => {
    if (!user || sending) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    setSending(true);
    try {
      const url = await uploadChatImage(result.assets[0].uri);
      await sendEventMessage(eid, user, "", url);
    } catch {
      showToast("Couldn't send photo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No messages yet. Say hi!</Text>}
          renderItem={({ item }) => {
            const isMe = item.username === user;
            return (
              <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
                {!isMe && <Text style={s.sender}>{item.username}</Text>}
                {!!item.imageUrl && (
                  <Image source={{ uri: item.imageUrl }} style={s.msgImage} contentFit="cover" transition={150} />
                )}
                {!!item.message && <Text style={s.msgText}>{item.message}</Text>}
                <Text style={s.time}>{fmtTime(item.createdAt)}</Text>
              </View>
            );
          }}
        />

        <View style={s.inputRow}>
          <Pressable style={s.attachBtn} onPress={handleSendImage} disabled={sending}>
            <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]} onPress={handleSend} disabled={!input.trim() || sending}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendBtnText}>Send</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, gap: 8, paddingBottom: 8 },
  empty: { color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", marginTop: 40 },

  bubble: {
    maxWidth: "78%", borderRadius: 16, padding: 10, paddingHorizontal: 14, marginVertical: 2,
  },
  bubbleMe: { alignSelf: "flex-end", backgroundColor: "#7c3aed" },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sender: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", marginBottom: 3 },
  msgText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  msgImage: { width: 200, height: 200, borderRadius: 10, marginVertical: 2 },
  attachBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  time: { color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 4, alignSelf: "flex-end" },

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
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

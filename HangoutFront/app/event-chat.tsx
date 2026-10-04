import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import type { ThemeColors } from "@/constants/theme";
import { useToast } from "@/context/ToastContext";
import { getEventMessages, sendEventMessage, uploadChatImage } from "@/services/api";
import { supabase } from "@/services/supabase";
import { ScreenBackground } from "@/components/ScreenBackground";
import { useBlockedUsers } from "@/hooks/use-blocked-users";
import { ReportSheet, ReportTarget } from "@/components/ReportSheet";

type Msg = { id: number; username: string; message: string; imageUrl?: string | null; createdAt: string };

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export default function EventChatScreen() {
  const { eventId, title } = useLocalSearchParams<{ eventId: string; title: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);
  const { showToast } = useToast();
  const eid = Number(eventId);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const blocked = useBlockedUsers(user);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.username === user || !blocked.has(m.username)),
    [messages, blocked, user],
  );

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
          data={visibleMessages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No messages yet. Say hi!</Text>}
          renderItem={({ item }) => {
            const isMe = item.username === user;
            return (
              <Pressable
                style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}
                onLongPress={isMe ? undefined : () => setReportTarget({ kind: "event_message", contentId: item.id, author: item.username })}
                delayLongPress={400}
              >
                {!isMe && <Text style={s.sender}>{item.username}</Text>}
                {!!item.imageUrl && (
                  <Image source={{ uri: item.imageUrl }} style={s.msgImage} contentFit="cover" transition={150} />
                )}
                {!!item.message && <Text style={[s.msgText, !isMe && s.msgTextOther]}>{item.message}</Text>}
                <Text style={[s.time, !isMe && s.timeOther]}>{fmtTime(item.createdAt)}</Text>
              </Pressable>
            );
          }}
        />

        <View style={s.inputRow}>
          <Pressable style={s.attachBtn} onPress={handleSendImage} disabled={sending}>
            <Ionicons name="image-outline" size={22} color={colors.textSub} />
          </Pressable>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor={colors.textGhost}
            multiline
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]} onPress={handleSend} disabled={!input.trim() || sending}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendBtnText}>Send</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </ScreenBackground>
  );
}

function buildStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { padding: 16, gap: 8, paddingBottom: 8 },
    empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 40 },

    bubble: {
      maxWidth: "78%", borderRadius: 16, padding: 10, paddingHorizontal: 14, marginVertical: 2,
    },
    bubbleMe: { alignSelf: "flex-end", backgroundColor: colors.purple },
    bubbleOther: { alignSelf: "flex-start", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderFaint },
    sender: { color: colors.textSub, fontSize: 11, fontWeight: "700", marginBottom: 3 },
    // White text for the default (solid-purple "me" bubble); msgTextOther/timeOther
    // below override it for the themed "other" bubble.
    msgText: { color: "#fff", fontSize: 15, lineHeight: 20 },
    msgTextOther: { color: colors.text },
    msgImage: { width: 200, height: 200, borderRadius: 10, marginVertical: 2 },
    attachBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    time: { color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
    timeOther: { color: colors.textGhost },

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
      backgroundColor: colors.purple, alignItems: "center", justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
}

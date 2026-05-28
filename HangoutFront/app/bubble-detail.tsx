import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
  ScrollView, Alert, Animated, Easing, Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import {
  getBubbles, getBubbleMembers, updateMemberLocation,
  getBubbleChannels, switchChannel, getMessages, sendMessage,
  deleteBubble, leaveBubble, notifyTyping, getTypingUsers,
} from "@/services/api";
import { SkeletonBox } from "@/components/SkeletonBox";
import { ErrorScreen } from "@/components/ErrorScreen";
import { useAuth } from "@/services/auth-context";
import { useToast } from "@/context/ToastContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/ScreenBackground";
import { supabase } from "@/services/supabase";

// ── Emoji helpers ─────────────────────────────────────────────────────
const FACE_EMOJIS = [
  "😀","😄","😁","😆","😅","😂","🙂","😉","😊","😇",
  "🥰","😍","🤩","😎","🤓","😏","😋","🤗","🤭","😬",
  "🙄","🥸","🤠","🤑","🥹","😜","😝","🤪","🫡","😸",
];

function emojiForUser(username: string): string {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (((h << 5) - h) + username.charCodeAt(i)) | 0;
  }
  return FACE_EMOJIS[Math.abs(h) % FACE_EMOJIS.length];
}

// ── TypingDots ────────────────────────────────────────────────────────
function TypingDots() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.delay(Math.max(0, 780 - delay)),
        ])
      );
    const a1 = anim(d1, 0);
    const a2 = anim(d2, 180);
    const a3 = anim(d3, 360);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [d1, d2, d3]);

  const dotStyle = (v: Animated.Value) => ({
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.9)",
    marginHorizontal: 2,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
  });

  return (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", height: 16 }}>
      <Animated.View style={dotStyle(d1)} />
      <Animated.View style={dotStyle(d2)} />
      <Animated.View style={dotStyle(d3)} />
    </View>
  );
}

// ── MemberEmoji ───────────────────────────────────────────────────────
function MemberEmoji({
  username, emoji, isNew, isTyping, hasNewMsg, isCurrentUser, isHost,
}: {
  username: string;
  emoji?: string;
  isNew: boolean;
  isTyping: boolean;
  hasNewMsg: boolean;
  isCurrentUser: boolean;
  isHost: boolean;
}) {
  const scale  = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const floatX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isNew) {
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Gentle floating bubble effect for the current user
  useEffect(() => {
    if (!isCurrentUser) return;
    const ay = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -8, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0,  duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const ax = Animated.loop(
      Animated.sequence([
        Animated.timing(floatX, { toValue: 4,  duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatX, { toValue: -4, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    ay.start();
    ax.start();
    return () => { ay.stop(); ax.stop(); };
  }, [isCurrentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayEmoji = emoji || emojiForUser(username);

  return (
    <Animated.View
      style={[
        vs.slot,
        { transform: [{ scale }, { translateY: floatY }, { translateX: floatX }] },
      ]}
    >
      <View style={vs.indicatorRow}>
        {isTyping ? (
          <TypingDots />
        ) : hasNewMsg ? (
          <Text style={vs.bulb}>💡</Text>
        ) : (
          <View style={{ height: 16 }} />
        )}
      </View>

      <View style={vs.emojiCircleWrapper}>
        <View style={[vs.emojiCircle, isCurrentUser && vs.emojiCircleMe]}>
          <Text style={vs.emoji}>{displayEmoji}</Text>
        </View>
        {isHost && (
          <View style={vs.hostBadge}>
            <Text style={vs.hostBadgeText}>HOST</Text>
          </View>
        )}
      </View>

      <Text style={[vs.emojiName, isCurrentUser && vs.emojiNameMe]} numberOfLines={1}>
        {username}
      </Text>
    </Animated.View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaText(km: number): string {
  if (km < 0.05) return "You're here";
  const walkMin = Math.round((km / 5) * 60);
  const driveMin = Math.max(1, Math.round((km / 40) * 60));
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return `${dist}  ·  ~${walkMin}m walk  ·  ~${driveMin}m drive`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ── Types ────────────────────────────────────────────────────────────
type BubbleMember = {
  id: number; bubbleId: number; username: string;
  latitude?: number; longitude?: number;
  shareLocation?: boolean; channelId?: number;
  profileEmoji?: string;
};

type ChatMsg = {
  id: number; bubbleId: number; channelId: number;
  username: string; message: string; createdAt: string;
};

type Bubble = {
  id: number; name: string; type?: string; meetTime?: string;
  description?: string; members: string[]; createdBy?: string;
  maxMembers?: number; isSecret?: boolean; revealAt?: string;
};

// ── Screen ───────────────────────────────────────────────────────────
export default function BubbleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bubbleId = parseInt(id, 10);
  const { user } = useAuth();
  const router = useRouter();

  const { showToast } = useToast();

  const [bubble, setBubble]   = useState<Bubble | null>(null);
  const [members, setMembers] = useState<BubbleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Location sharing
  const [sharing, setSharing]       = useState(false);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  // Tab
  const [tab, setTab] = useState<"members" | "chat">("members");

  // Chat
  const [channelId, setChannelId] = useState(1);
  const [channels, setChannels]   = useState<number[]>([]);
  const [messages, setMessages]   = useState<ChatMsg[]>([]);
  const [msgInput, setMsgInput]   = useState("");
  const [sending, setSending]     = useState(false);
  const msgListRef = useRef<FlatList>(null);

  // Channel modal
  const [chanSearch, setChanSearch] = useState(false);
  const [chanInput, setChanInput]   = useState("");

  // Visual container
  const [typingUsers, setTypingUsers]       = useState<string[]>([]);
  const [newMsgSenders, setNewMsgSenders]   = useState<Set<string>>(new Set());
  const lastSeenMsgIdRef   = useRef(-1);
  const seenVisualRef      = useRef<Set<string>>(new Set());
  const firstMemberLoadRef = useRef(false);
  const lastTypingNotifRef = useRef(0);

  // ── Data loading ────────────────────────────────────────────────
  const loadBubble = useCallback(async (): Promise<boolean> => {
    try {
      const all = await getBubbles();
      const found = all.find((b: Bubble) => b.id === bubbleId);
      if (found) {
        setBubble(found);
        return true;
      } else {
        Alert.alert("Hangout Ended", "The host has ended this hangout.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return true;
      }
    } catch {
      return false;
    }
  }, [bubbleId, router]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await getBubbleMembers(bubbleId);
      // Populate seenVisualRef on first load so initial members don't animate
      if (!firstMemberLoadRef.current) {
        firstMemberLoadRef.current = true;
        data.forEach((m: BubbleMember) => seenVisualRef.current.add(m.username));
      }
      setMembers(data);
      const mine = data.find((m: BubbleMember) => m.username === user);
      if (mine) {
        setChannelId(mine.channelId ?? 1);
        setSharing(mine.shareLocation ?? false);
      }
    } catch {}
  }, [bubbleId, user]);

  const loadChannels = useCallback(async () => {
    try {
      const data = await getBubbleChannels(bubbleId);
      const merged = Array.from(new Set([...data, channelId])).sort((a, b) => a - b);
      setChannels(merged);
    } catch {}
  }, [bubbleId, channelId]);

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(bubbleId, channelId);

      if (data.length > 0) {
        const maxId = Math.max(...data.map((m) => m.id));
        // First load — set baseline so existing messages don't trigger lightbulbs
        lastSeenMsgIdRef.current = maxId;
      }

      setMessages(data);
      setTimeout(() => msgListRef.current?.scrollToEnd({ animated: false }), 50);
    } catch {}
  }, [bubbleId, channelId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [ok] = await Promise.all([loadBubble(), loadMembers()]);
    if (!ok) setLoadError(true);
    setLoading(false);
  }, [loadBubble, loadMembers]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Poll bubble existence
  useEffect(() => {
    const p = setInterval(loadBubble, 5000);
    return () => clearInterval(p);
  }, [loadBubble]);

  // Poll members so new joiners pop into the visual container
  useEffect(() => {
    const p = setInterval(loadMembers, 8000);
    return () => clearInterval(p);
  }, [loadMembers]);

  // Poll typing users continuously regardless of active tab
  useEffect(() => {
    const p = setInterval(() => {
      getTypingUsers(bubbleId).then(setTypingUsers).catch(() => {});
    }, 2500);
    return () => clearInterval(p);
  }, [bubbleId]);

  // Realtime chat subscription
  useEffect(() => {
    if (tab !== "chat") return;

    loadMessages();
    loadChannels();

    const ch = supabase
      .channel(`chat-${bubbleId}-${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `bubble_id=eq.${bubbleId}` },
        (payload) => {
          const row = payload.new as any;
          if (row.channel_id !== channelId) return;

          const msg: ChatMsg = {
            id: row.id, bubbleId: row.bubble_id, channelId: row.channel_id,
            username: row.username, message: row.message, createdAt: row.created_at,
          };

          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);

          if (row.username !== user) {
            setNewMsgSenders((prev) => { const next = new Set(prev); next.add(row.username); return next; });
          }

          setTimeout(() => msgListRef.current?.scrollToEnd({ animated: true }), 50);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [tab, bubbleId, channelId, user, loadMessages, loadChannels]);

  // Reset msg tracking when channel changes
  useEffect(() => {
    lastSeenMsgIdRef.current = -1;
  }, [channelId]);

  // ── Location sharing ────────────────────────────────────────────
  const startSharing = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setMyLocation(coord);
    await updateMemberLocation(bubbleId, user ?? "Guest", true, coord.latitude, coord.longitude);

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 20000, distanceInterval: 20 },
      async (l) => {
        const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
        setMyLocation(c);
        await updateMemberLocation(bubbleId, user ?? "Guest", true, c.latitude, c.longitude);
      }
    );
    watcherRef.current = sub;
    setSharing(true);
    await loadMembers();
  };

  const stopSharing = async () => {
    watcherRef.current?.remove();
    watcherRef.current = null;
    setMyLocation(null);
    setSharing(false);
    await updateMemberLocation(bubbleId, user ?? "Guest", false);
    await loadMembers();
  };

  useEffect(() => () => { watcherRef.current?.remove(); }, []);

  // ── Chat ────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = msgInput.trim();
    if (!text) return;
    setSending(true);
    setMsgInput("");
    try {
      await sendMessage(bubbleId, channelId, user ?? "Guest", text);
    } catch {
      showToast("Failed to send message. Try again.");
    } finally { setSending(false); }
  };

  const handleMsgInputChange = (text: string) => {
    setMsgInput(text);
    if (text && user) {
      const now = Date.now();
      if (now - lastTypingNotifRef.current > 2000) {
        lastTypingNotifRef.current = now;
        notifyTyping(bubbleId, user).catch(() => {});
      }
    }
  };

  const handleSwitchChannel = async (newChan: number) => {
    await switchChannel(bubbleId, user ?? "Guest", newChan);
    setChannelId(newChan);
    setChanSearch(false);
    setChanInput("");
  };

  const switchTab = (newTab: "members" | "chat") => {
    if (newTab === "chat") setNewMsgSenders(new Set());
    setTab(newTab);
  };

  // ── Invite ──────────────────────────────────────────────────────
  const handleInvite = async () => {
    try {
      await Share.share({
        message: `Join my bubble "${bubble?.name}" on The Hangout!\nthehangout://bubble-detail?id=${bubbleId}`,
        title: `Join ${bubble?.name}`,
      });
    } catch {}
  };

  // ── End / Leave hangout ─────────────────────────────────────────
  const handleEndHangout = () => {
    Alert.alert(
      "End Hangout",
      `End "${bubble?.name}"? This will remove the bubble for all members.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Hangout", style: "destructive",
          onPress: async () => {
            try {
              await deleteBubble(bubbleId, user ?? "");
              router.back();
            } catch {
              Alert.alert("Error", "Could not end the hangout. Try again.");
            }
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert("Leave Hangout", `Leave "${bubble?.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave", style: "destructive",
        onPress: async () => {
          try {
            await leaveBubble(bubbleId, user ?? "");
            router.back();
          } catch {
            Alert.alert("Error", "Could not leave the hangout. Try again.");
          }
        },
      },
    ]);
  };

  // ── Visual container helpers ────────────────────────────────────
  const isNewMember = useCallback((username: string): boolean => {
    if (!firstMemberLoadRef.current || seenVisualRef.current.has(username)) return false;
    seenVisualRef.current.add(username);
    return true;
  }, []);

  // ── Derived ─────────────────────────────────────────────────────
  const membersInChannel = members.filter((m) => (m.channelId ?? 1) === channelId);
  const isHost = bubble?.createdBy === user;

  if (!loading && loadError) {
    return <ErrorScreen message="Couldn't load this hangout." onRetry={load} />;
  }

  if (loading || !bubble) {
    return (
      <ScreenBackground style={{ flex: 1 }}>
        {/* Skeleton header */}
        <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, gap: 6 }}>
          <SkeletonBox width={180} height={22} borderRadius={8} />
          <SkeletonBox width={100} height={13} borderRadius={6} />
        </View>
        {/* Skeleton tabs */}
        <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 12 }}>
          <SkeletonBox width={80} height={32} borderRadius={20} />
          <SkeletonBox width={60} height={32} borderRadius={20} />
        </View>
        {/* Skeleton location toggle */}
        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SkeletonBox width="100%" height={60} borderRadius={14} />
        </View>
        {/* Skeleton member cards */}
        {[0,1,2,3,4].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
            <SkeletonBox width={44} height={44} borderRadius={22} />
            <View style={{ flex: 1, gap: 7 }}>
              <SkeletonBox width="45%" height={14} borderRadius={6} />
              <SkeletonBox width="32%" height={11} borderRadius={6} />
            </View>
            <SkeletonBox width={10} height={10} borderRadius={5} />
          </View>
        ))}
      </ScreenBackground>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <ScreenBackground style={{ flex: 1 }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerName}>{bubble.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable style={s.inviteBtn} onPress={handleInvite}>
              <Ionicons name="share-outline" size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
            {isHost ? (
              <Pressable style={s.endBtn} onPress={handleEndHangout}>
                <Text style={s.endBtnText}>End</Text>
              </Pressable>
            ) : (
              <Pressable style={s.leaveBtn} onPress={handleLeave}>
                <Text style={s.leaveBtnText}>Leave</Text>
              </Pressable>
            )}
          </View>
        </View>
        <View style={s.headerMeta}>
          {bubble.type && <View style={s.typeBadge}><Text style={s.typeBadgeText}>{bubble.type}</Text></View>}
          {bubble.meetTime && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={s.headerTime}>{bubble.meetTime}</Text>
            </View>
          )}
          <Text style={s.memberCount}>{bubble.members.length} members</Text>
        </View>
        {bubble.description ? <Text style={s.headerDesc} numberOfLines={2}>{bubble.description}</Text> : null}
      </View>

      {/* ── Bubble Visual Container ──────────────────────────────── */}
      <View style={vs.container}>
        {members.length === 0 ? (
          <Text style={vs.emptyText}>Waiting for members…</Text>
        ) : (
          <View style={vs.grid}>
            {members.map((m) => (
              <MemberEmoji
                key={m.username}
                username={m.username}
                emoji={m.profileEmoji || undefined}
                isNew={isNewMember(m.username)}
                isTyping={typingUsers.includes(m.username) && m.username !== user}
                hasNewMsg={newMsgSenders.has(m.username)}
                isCurrentUser={m.username === user}
                isHost={m.username === bubble?.createdBy}
              />
            ))}
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <Pressable style={[s.tab, tab === "members" && s.tabActive]} onPress={() => switchTab("members")}>
          <Text style={[s.tabText, tab === "members" && s.tabTextActive]}>Members</Text>
        </Pressable>
        <Pressable style={[s.tab, tab === "chat" && s.tabActive]} onPress={() => switchTab("chat")}>
          <Text style={[s.tabText, tab === "chat" && s.tabTextActive]}>
            {"Chat"}
            {newMsgSenders.size > 0 && (
              <Text style={s.tabBadge}>{` (${newMsgSenders.size})`}</Text>
            )}
          </Text>
        </Pressable>
      </View>

      {/* ── Members tab ────────────────────────────────────────── */}
      {tab === "members" && (
        <FlatList
          data={members}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            <Pressable
              style={[s.locationToggle, sharing && s.locationToggleOn]}
              onPress={() => { if (sharing) stopSharing(); else startSharing(); }}
            >
              <View>
                <Text style={s.locationToggleTitle}>
                  {sharing ? "📍 Sharing your location" : "📍 Location hidden"}
                </Text>
                <Text style={s.locationToggleSub}>
                  {sharing ? "Tap to stop sharing" : "Tap to share your location with members"}
                </Text>
              </View>
              <View style={[s.toggle, sharing && s.toggleOn]}>
                <View style={[s.toggleThumb, sharing && s.toggleThumbOn]} />
              </View>
            </Pressable>
          }
          renderItem={({ item: m }) => {
            const isMe = m.username === user;
            let distLine: string | null = null;
            if (!isMe && m.shareLocation && m.latitude != null && myLocation) {
              const km = haversineKm(myLocation.latitude, myLocation.longitude, m.latitude!, m.longitude!);
              distLine = etaText(km);
            }
            return (
              <Pressable
                style={[s.memberCard, isMe && s.memberCardMe]}
                onPress={() => !isMe && router.push({ pathname: "/user-profile", params: { username: m.username } })}
              >
                <View style={s.memberAvatar}>
                  <Text style={s.memberAvatarText}>{m.profileEmoji || emojiForUser(m.username)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{m.username}{isMe ? " (you)" : ""}</Text>
                  {m.shareLocation
                    ? distLine
                      ? <Text style={s.memberEta}>{distLine}</Text>
                      : <Text style={s.memberSharing}>Sharing location</Text>
                    : <Text style={s.memberHidden}>Location hidden</Text>
                  }
                </View>
                <View style={[s.dot, m.shareLocation ? s.dotGreen : s.dotGrey]} />
              </Pressable>
            );
          }}
        />
      )}

      {/* ── Chat tab ────────────────────────────────────────────── */}
      {tab === "chat" && (
        <View style={{ flex: 1 }}>
          {/* Channel bar */}
          <View style={s.channelBar}>
            <Text style={s.channelLabel}>
              # Channel {channelId}
              <Text style={s.channelMemberCount}> · {membersInChannel.length} member{membersInChannel.length !== 1 ? "s" : ""}</Text>
            </Text>
            <Pressable style={s.channelSearchBtn} onPress={() => setChanSearch(true)}>
              <Text style={s.channelSearchBtnText}>Search / Switch</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <FlatList
            ref={msgListRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={s.msgList}
            onContentSizeChange={() => msgListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={s.emptyChat}>No messages yet. Say hello! 👋</Text>
            }
            renderItem={({ item: msg }) => {
              const isMe = msg.username === user;
              return (
                <View style={[s.msgRow, isMe && s.msgRowMe]}>
                  {!isMe && (
                    <View style={s.msgAvatar}>
                      <Text style={s.msgAvatarEmoji}>
                        {members.find((m) => m.username === msg.username)?.profileEmoji || emojiForUser(msg.username)}
                      </Text>
                    </View>
                  )}
                  <View style={[s.msgBubble, isMe && s.msgBubbleMe]}>
                    {!isMe && <Text style={s.msgUsername}>{msg.username}</Text>}
                    <Text style={s.msgText}>{msg.message}</Text>
                    <Text style={s.msgTime}>{fmtTime(msg.createdAt)}</Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Input */}
          <View style={s.inputRow}>
            <TextInput
              style={s.msgInput}
              placeholder="Message..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={msgInput}
              onChangeText={handleMsgInputChange}
              multiline
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              style={[s.sendBtn, (!msgInput.trim() || sending) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!msgInput.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.sendBtnText}>↑</Text>
              }
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Channel search modal ─────────────────────────────────── */}
      <Modal visible={chanSearch} transparent animationType="slide" onRequestClose={() => setChanSearch(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setChanSearch(false)} />
        <View style={s.chanModal}>
          <View style={s.chanModalHandle} />
          <Text style={s.chanModalTitle}>Find a Channel</Text>

          <View style={s.chanInputRow}>
            <Text style={s.chanHash}>#</Text>
            <TextInput
              style={s.chanNumberInput}
              placeholder="Channel number"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={chanInput}
              onChangeText={setChanInput}
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={() => {
                const n = parseInt(chanInput, 10);
                if (n > 0) handleSwitchChannel(n);
              }}
            />
            <Pressable
              style={[s.chanGoBtn, !chanInput && s.chanGoBtnDisabled]}
              disabled={!chanInput}
              onPress={() => { const n = parseInt(chanInput, 10); if (n > 0) handleSwitchChannel(n); }}
            >
              <Text style={s.chanGoBtnText}>Go</Text>
            </Pressable>
          </View>

          <Text style={s.chanSectionLabel}>Active channels</Text>
          <ScrollView>
            {channels.map((ch) => (
              <Pressable
                key={ch}
                style={[s.chanItem, ch === channelId && s.chanItemActive]}
                onPress={() => handleSwitchChannel(ch)}
              >
                <Text style={[s.chanItemText, ch === channelId && s.chanItemTextActive]}>
                  #{ch}{ch === channelId ? "  ✓ current" : ""}
                </Text>
                <Text style={s.chanItemCount}>
                  {members.filter((m) => (m.channelId ?? 1) === ch).length} member{members.filter((m) => (m.channelId ?? 1) === ch).length !== 1 ? "s" : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

// ── Visual Container Styles ───────────────────────────────────────────
const vs = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 12,
    minHeight: 96,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  slot: {
    width: 72,
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 8,
  },
  indicatorRow: {
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emojiCircleWrapper: {
    alignItems: "center",
  },
  emojiCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  emojiCircleMe: {
    borderWidth: 2,
    borderColor: "rgba(220,38,38,0.8)",
    backgroundColor: "rgba(220,38,38,0.08)",
  },
  emoji: { fontSize: 28 },
  emojiName: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10, marginTop: 8,
    textAlign: "center", width: 68,
  },
  emojiNameMe: { color: "rgba(255,255,255,0.85)", fontWeight: "700" },
  bulb: { fontSize: 13, lineHeight: 16 },
  emptyText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 13, textAlign: "center", padding: 24,
  },
  hostBadge: {
    marginTop: 3,
    backgroundColor: "#dc2626",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hostBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});

// ── Main Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  headerName: { color: "#fff", fontSize: 22, fontWeight: "800", flex: 1 },
  inviteBtn: {
    backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)", borderRadius: 8,
    padding: 7,
  },
  endBtn: {
    backgroundColor: "rgba(220,38,38,0.15)", borderWidth: 1,
    borderColor: "rgba(220,38,38,0.5)", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  endBtnText: { color: "#dc2626", fontSize: 13, fontWeight: "700" },
  leaveBtn: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  leaveBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "700" },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typeBadge: { backgroundColor: "rgba(124,58,237,0.3)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { color: "#c4b5fd", fontSize: 11, fontWeight: "700" },
  headerTime: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  memberCount: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  headerDesc: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6, lineHeight: 18 },

  // Tabs
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderColor: "#dc2626" },
  tabText: { color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  tabBadge: { color: "#dc2626", fontWeight: "700" },

  // Members
  listContent: { padding: 16, gap: 10 },
  locationToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, marginBottom: 6,
  },
  locationToggleOn: { borderColor: "rgba(34,197,94,0.4)", backgroundColor: "rgba(34,197,94,0.07)" },
  locationToggleTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  locationToggleSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", padding: 2 },
  toggleOn: { backgroundColor: "#22c55e" },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  toggleThumbOn: { alignSelf: "flex-end" },

  memberCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  memberCardMe: { borderColor: "rgba(220,38,38,0.3)", backgroundColor: "rgba(220,38,38,0.06)" },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  memberAvatarText: { fontSize: 20 },
  memberName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  memberEta: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 },
  memberSharing: { color: "#22c55e", fontSize: 11, marginTop: 2 },
  memberHidden: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: "#22c55e" },
  dotGrey: { backgroundColor: "rgba(255,255,255,0.2)" },

  // Chat — channel bar
  channelBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  channelLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  channelMemberCount: { color: "rgba(255,255,255,0.4)", fontWeight: "400", fontSize: 12 },
  channelSearchBtn: {
    borderWidth: 1, borderColor: "rgba(220,38,38,0.4)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  channelSearchBtnText: { color: "#dc2626", fontSize: 12, fontWeight: "600" },

  // Chat — messages
  msgList: { padding: 12, gap: 8, paddingBottom: 4 },
  emptyChat: { color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 40, fontSize: 14 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowMe: { flexDirection: "row-reverse" },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center",
    marginBottom: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  msgAvatarEmoji: { fontSize: 16 },
  msgBubble: {
    maxWidth: "75%", backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14, borderBottomLeftRadius: 4, padding: 10, gap: 2,
  },
  msgBubbleMe: { backgroundColor: "#dc2626", borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  msgUsername: { color: "#c4b5fd", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  msgText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  msgTime: { color: "rgba(255,255,255,0.4)", fontSize: 10, alignSelf: "flex-end" },

  // Chat — input
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1a0808",
  },
  msgInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, color: "#fff",
    fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#dc2626",
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 22 },

  // Channel search modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  chanModal: {
    backgroundColor: "#1a0808", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 20, paddingBottom: 36, maxHeight: "70%",
  },
  chanModalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", alignSelf: "center", marginBottom: 16 },
  chanModalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 16 },
  chanInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  chanHash: { color: "rgba(255,255,255,0.5)", fontSize: 22, fontWeight: "700" },
  chanNumberInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  chanGoBtn: { backgroundColor: "#dc2626", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  chanGoBtnDisabled: { opacity: 0.4 },
  chanGoBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  chanSectionLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  chanItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  chanItemActive: {},
  chanItemText: { color: "rgba(255,255,255,0.7)", fontSize: 16, fontWeight: "600" },
  chanItemTextActive: { color: "#dc2626" },
  chanItemCount: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
});

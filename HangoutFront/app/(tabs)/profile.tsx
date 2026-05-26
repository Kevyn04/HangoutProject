import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, StatusBar, Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/services/auth-context";
import { getProfile, updateProfile, getUserBubbles, getUserRatings } from "@/services/api";
import { ColorWheelPicker } from "@/components/ColorWheelPicker";

const PRESET_COLORS = ["#7c3aed", "#dc2626", "#0ea5e9", "#16a34a", "#ea580c", "#db2777"];

const FACE_EMOJIS = [
  "😀","😄","😁","😆","😅","😂","🙂","😉","😊","😇",
  "🥰","😍","🤩","😎","🤓","😏","😋","🤗","🤭","😬",
  "🙄","🥸","🤠","🤑","🥹","😜","😝","🤪","🫡","😸",
];

function Stars({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ fontSize: 14, color: i <= Math.round(value) ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>★</Text>
      ))}
    </View>
  );
}

type Profile = {
  username: string; bio: string; avatarColor: string; profileEmoji: string;
  followerCount: number; followingCount: number;
  avgRating: number; ratingCount: number;
};
type BubbleItem = { id: number; name: string; type?: string; members: string[] };
type ReasonItem = { reason: string; count: number };

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarColor, setAvatarColor] = useState<string>("#7c3aed");
  const [profileEmoji, setProfileEmoji] = useState<string>("");
  const [createdBubbles, setCreatedBubbles] = useState<BubbleItem[]>([]);
  const [joinedBubbles, setJoinedBubbles] = useState<BubbleItem[]>([]);
  const [reasons, setReasons] = useState<ReasonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [p, b, r] = await Promise.all([
        getProfile(user, user),
        getUserBubbles(user),
        getUserRatings(user),
      ]);
      setProfile(p);
      setAvatarColor(p.avatarColor || "#7c3aed");
      setProfileEmoji(p.profileEmoji || "");
      setBioInput(p.bio || "");
      setCreatedBubbles(b.created || []);
      setJoinedBubbles(b.joined || []);
      setReasons(r.reasons || []);
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const updated = await updateProfile(user, { bio: bioInput, avatarColor, profileEmoji });
      setProfile((prev) => prev ? { ...prev, ...updated } : updated);
      setEditing(false);
    } catch {
      Alert.alert("Error", "Failed to save profile.");
    } finally { setSaving(false); }
  };

  const handleEmojiPick = (emoji: string) => {
    if (!user) return;
    setProfileEmoji(emoji);
    updateProfile(user, { profileEmoji: emoji }).catch(() => {
      Alert.alert("Error", "Could not save emoji.");
    });
  };

  const handleColorPick = (color: string) => {
    if (!user) return;
    setAvatarColor(color);
    setProfile((prev) => prev ? { ...prev, avatarColor: color } : prev);
    updateProfile(user, { avatarColor: color }).catch(() => {
      Alert.alert("Error", "Could not save color.");
    });
  };

  if (!user) {
    return (
      <View style={s.centered}>
        <Text style={s.guestText}>Sign in to view your profile.</Text>
        <Pressable style={s.signInBtn} onPress={() => router.push("/signin")}>
          <Text style={s.signInBtnText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const initial = user.charAt(0).toUpperCase();

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#120303" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <View style={s.avatarSection}>

          {/* Profile + Bubble Pop side by side */}
          <View style={s.avatarsRow}>
            <View style={s.avatarCol}>
              <View style={[s.avatar, { backgroundColor: avatarColor }]}>
                <Text style={s.avatarText}>{initial}</Text>
              </View>
              <Text style={s.avatarColLabel}>Profile</Text>
            </View>

            <View style={s.avatarCol}>
              <View style={s.bubblePopCircle}>
                {profileEmoji
                  ? <Text style={s.bubblePopEmoji}>{profileEmoji}</Text>
                  : <Text style={s.bubblePopPlaceholder}>+</Text>
                }
              </View>
              <Text style={s.bubblePopLabel}>Bubble Pop</Text>
            </View>
          </View>

          <Text style={s.username}>{user}</Text>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{createdBubbles.length}</Text>
              <Text style={s.statLabel}>My Bubbles</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>{joinedBubbles.length}</Text>
              <Text style={s.statLabel}>Bubbles I'm In</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={s.statValue}>
                  {profile?.ratingCount ? profile.avgRating.toFixed(1) : "—"}
                </Text>
                {(profile?.ratingCount ?? 0) > 0 && <Text style={{ color: "#fbbf24", fontSize: 14 }}>★</Text>}
              </View>
              <Text style={s.statLabel}>
                {profile?.ratingCount ? `${profile.ratingCount} rating${profile.ratingCount !== 1 ? "s" : ""}` : "No ratings"}
              </Text>
            </View>
          </View>

          {/* Color picker */}
          <View style={s.colorRow}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                style={[s.colorDot, { backgroundColor: c }, avatarColor === c && s.colorDotActive]}
                onPress={() => handleColorPick(c)}
              />
            ))}
            <Pressable style={s.customColorBtn} onPress={() => setColorPickerOpen(true)}>
              <Text style={s.customColorText}>⊕</Text>
            </Pressable>
          </View>

          <ColorWheelPicker
            visible={colorPickerOpen}
            initialColor={avatarColor}
            onClose={() => setColorPickerOpen(false)}
            onSelect={handleColorPick}
          />

          {/* Bubble Pop picker */}
          <Text style={s.emojiPickerLabel}>Bubble Pop</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.emojiRow}
          >
            {/* "None" option — clears emoji back to letter initial */}
            <Pressable
              style={[s.emojiBtn, !profileEmoji && s.emojiBtnActive]}
              onPress={() => handleEmojiPick("")}
            >
              <Text style={s.emojiInitial}>{initial}</Text>
            </Pressable>
            {FACE_EMOJIS.map((e) => (
              <Pressable
                key={e}
                style={[s.emojiBtn, profileEmoji === e && s.emojiBtnActive]}
                onPress={() => handleEmojiPick(e)}
              >
                <Text style={s.emojiOption}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Bio */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Bio</Text>
            {!editing ? (
              <Pressable onPress={() => setEditing(true)}><Text style={s.editLink}>Edit</Text></Pressable>
            ) : (
              <View style={s.editActions}>
                <Pressable onPress={() => { setEditing(false); setBioInput(profile?.bio ?? ""); }}>
                  <Text style={s.cancelLink}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}>
                  <Text style={s.saveLink}>{saving ? "Saving…" : "Save"}</Text>
                </Pressable>
              </View>
            )}
          </View>
          {editing ? (
            <TextInput
              style={s.bioInput}
              value={bioInput}
              onChangeText={setBioInput}
              placeholder="Write something about yourself…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline maxLength={300} autoFocus
            />
          ) : (
            <Text style={s.bioText}>{profile?.bio || "No bio yet. Tap Edit to add one."}</Text>
          )}
        </View>

        {/* Ratings breakdown */}
        {reasons.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>What people say</Text>
              <Stars value={profile?.avgRating ?? 0} />
            </View>
            <View style={s.reasonsWrap}>
              {reasons.map((r) => (
                <View key={r.reason} style={s.reasonTag}>
                  <Text style={s.reasonText}>{r.reason}</Text>
                  <Text style={s.reasonCount}>{r.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Created bubbles */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Created ({createdBubbles.length})</Text>
          {createdBubbles.length === 0 ? (
            <Text style={s.emptyText}>No bubbles created yet.</Text>
          ) : createdBubbles.map((b) => (
            <Pressable
              key={b.id} style={s.bubbleRow}
              onPress={() => router.push({ pathname: "/bubble-detail", params: { id: b.id } })}
            >
              <View style={[s.bubbleRowDot, { backgroundColor: avatarColor }]}>
                <Text style={s.bubbleRowDotText}>{b.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={s.bubbleRowInfo}>
                <Text style={s.bubbleRowName}>{b.name}</Text>
                <Text style={s.bubbleRowMeta}>{b.type ? `${b.type} · ` : ""}{b.members.length} member{b.members.length !== 1 ? "s" : ""}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Joined bubbles */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Joined ({joinedBubbles.length})</Text>
          {joinedBubbles.length === 0 ? (
            <Text style={s.emptyText}>No bubbles joined yet.</Text>
          ) : joinedBubbles.map((b) => (
            <Pressable
              key={b.id} style={s.bubbleRow}
              onPress={() => router.push({ pathname: "/bubble-detail", params: { id: b.id } })}
            >
              <View style={[s.bubbleRowDot, { backgroundColor: "#7c3aed" }]}>
                <Text style={s.bubbleRowDotText}>{b.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={s.bubbleRowInfo}>
                <Text style={s.bubbleRowName}>{b.name}</Text>
                <Text style={s.bubbleRowMeta}>{b.type ? `${b.type} · ` : ""}{b.members.length} member{b.members.length !== 1 ? "s" : ""}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable style={({ pressed }) => [s.signOutBtn, pressed && { opacity: 0.7 }]} onPress={() => logout()}>
          <Text style={s.signOutText}>Sign Out</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#120303", paddingTop: 56 },
  centered: { flex: 1, backgroundColor: "#120303", alignItems: "center", justifyContent: "center", gap: 16 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  avatarSection: { alignItems: "center", paddingVertical: 24, gap: 10 },
  avatarsRow: { flexDirection: "row", alignItems: "flex-start", gap: 20 },
  avatarCol: { alignItems: "center", gap: 6 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "700" },
  avatarColLabel: { color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 0.5 },

  bubblePopCircle: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5, borderColor: "rgba(220,38,38,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  bubblePopEmoji: { fontSize: 32 },
  bubblePopPlaceholder: { color: "rgba(255,255,255,0.3)", fontSize: 24, lineHeight: 28 },
  bubblePopLabel: { color: "#dc2626", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  emojiPickerLabel: {
    color: "rgba(255,255,255,0.4)", fontSize: 11,
    letterSpacing: 1, textTransform: "uppercase",
    alignSelf: "flex-start", marginLeft: 4,
  },
  emojiRow: { flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingVertical: 4 },
  emojiBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5, borderColor: "transparent",
  },
  emojiBtnActive: { borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.12)" },
  emojiOption: { fontSize: 22 },
  emojiInitial: { color: "#fff", fontSize: 16, fontWeight: "700" },
  username: { color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: 0.5 },

  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 14, paddingHorizontal: 20, gap: 0, width: "100%",
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.1)" },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "700" },
  statLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11 },

  colorRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff" },
  customColorBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  customColorText: { color: "rgba(255,255,255,0.7)", fontSize: 18, lineHeight: 22 },

  section: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)", gap: 10,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  editLink: { color: "#dc2626", fontSize: 13, fontWeight: "600" },
  editActions: { flexDirection: "row", gap: 14 },
  cancelLink: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "600" },
  saveLink: { color: "#dc2626", fontSize: 13, fontWeight: "700" },

  bioText: { color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 20 },
  bioInput: {
    color: "#fff", fontSize: 14, lineHeight: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 10, padding: 10, minHeight: 80,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  reasonsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonTag: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(220,38,38,0.1)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(220,38,38,0.25)",
  },
  reasonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  reasonCount: { color: "#dc2626", fontSize: 12, fontWeight: "700" },

  bubbleRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  bubbleRowDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bubbleRowDotText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  bubbleRowInfo: { flex: 1 },
  bubbleRowName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  bubbleRowMeta: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  emptyText: { color: "rgba(255,255,255,0.35)", fontSize: 13 },

  signOutBtn: {
    marginTop: 8, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(220,38,38,0.5)",
    backgroundColor: "rgba(220,38,38,0.1)",
  },
  signOutText: { color: "#dc2626", fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },
  guestText: { color: "rgba(255,255,255,0.5)", fontSize: 15 },
  signInBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, backgroundColor: "#dc2626" },
  signInBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

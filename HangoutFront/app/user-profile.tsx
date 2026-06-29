import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Modal, Alert, RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/services/auth-context";
import {
  getProfile, getUserBubbles, getUserRatings,
  toggleUserFollow, canRateUser, submitRating,
  reportUser, blockUser, unblockUser, getIsBlocked,
} from "@/services/api";
import { SkeletonBox } from "@/components/SkeletonBox";
import { ErrorScreen } from "@/components/ErrorScreen";
import { UserAvatar } from "@/components/UserAvatar";
import { useToast } from "@/context/ToastContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/ScreenBackground";

const RATING_REASONS = [
  "Great vibes ✨", "Fun host 🎤", "Very welcoming 🤝",
  "Punctual ⏰", "Good energy ⚡", "Would hang again 🔄",
  "Made it memorable 🎉", "Chill person 😎",
];

const REPORT_REASONS = ["Spam", "Harassment", "Inappropriate behavior", "Fake profile", "Other"];

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(value) ? "star" : "star-outline"}
          size={size}
          color={i <= Math.round(value) ? "#fbbf24" : "rgba(255,255,255,0.2)"}
        />
      ))}
    </View>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(i); }}>
          <Ionicons
            name={i <= value ? "star" : "star-outline"}
            size={40}
            color={i <= value ? "#fbbf24" : "rgba(255,255,255,0.2)"}
          />
        </Pressable>
      ))}
    </View>
  );
}

type ProfileData = {
  username: string; bio: string; avatarColor: string; avatarUrl?: string | null;
  followerCount: number; followingCount: number;
  avgRating: number; ratingCount: number; isFollowing: boolean;
};

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [createdBubbles, setCreatedBubbles] = useState<any[]>([]);
  const [joinedBubbles, setJoinedBubbles] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Rating modal
  const [rateModal, setRateModal] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [rateReason, setRateReason] = useState<string | null>(null);
  const [starValue, setStarValue] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Moderation
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!username) return;
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const [p, b, r] = await Promise.all([
        getProfile(username, user ?? undefined),
        getUserBubbles(username),
        getUserRatings(username),
      ]);
      setProfile(p);
      setCreatedBubbles(b.created || []);
      setJoinedBubbles(b.joined || []);
      setReasons(r.reasons || []);

      if (user && user !== username) {
        const [eligibility, blocked] = await Promise.all([
          canRateUser(username, user),
          getIsBlocked(user, username),
        ]);
        setCanRate(eligibility.canRate === true);
        setIsBlocked(blocked);
      }
    } catch {
      setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [username, user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleFollow = async () => {
    if (!user) { router.push("/signin"); return; }
    if (!profile) return;
    setFollowLoading(true);
    try {
      const result = await toggleUserFollow(username, user);
      setProfile((prev) => prev ? { ...prev, isFollowing: result.following, followerCount: result.followerCount } : prev);
    } catch {
      showToast("Couldn't update follow. Try again.");
    }
    finally { setFollowLoading(false); }
  };

  const handleBlock = async () => {
    if (!user) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await unblockUser(user, username);
        setIsBlocked(false);
        showToast(`@${username} unblocked.`);
      } else {
        Alert.alert(
          `Block @${username}?`,
          "Their messages and activity will be hidden from you.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Block", style: "destructive",
              onPress: async () => {
                try {
                  await blockUser(user, username);
                  setIsBlocked(true);
                  showToast(`@${username} blocked.`);
                } catch {
                  showToast("Couldn't block. Try again.");
                }
              },
            },
          ]
        );
      }
    } catch {
      showToast("Couldn't update block. Try again.");
    } finally { setBlockLoading(false); }
  };

  const handleReport = async () => {
    if (!user || !reportReason) return;
    setReportSubmitting(true);
    try {
      await reportUser(user, username, reportReason);
      setReportModal(false);
      setReportReason(null);
      Alert.alert("Report Submitted", "Thanks for keeping the community safe. We'll review this.");
    } catch {
      showToast("Couldn't submit report. Try again.");
    } finally { setReportSubmitting(false); }
  };

  const handleSubmitRating = async () => {
    if (!user || !starValue || !rateReason) {
      Alert.alert("Please select a star rating and a reason.");
      return;
    }
    setSubmitting(true);
    try {
      await submitRating(username, { raterUsername: user, rating: starValue, reason: rateReason });
      setRateModal(false);
      setCanRate(false);
      const r = await getUserRatings(username);
      setReasons(r.reasons || []);
      const p = await getProfile(username, user);
      setProfile((prev) => prev ? { ...prev, avgRating: p.avgRating, ratingCount: p.ratingCount } : prev);
      Alert.alert("Thanks!", "Your anonymous rating was submitted.");
    } catch {
      Alert.alert("Error", "Could not submit rating. Try again.");
    } finally { setSubmitting(false); }
  };

  if (loadError) {
    return <ErrorScreen message="Couldn't load this profile." onRetry={load} />;
  }

  if (loading || !profile) {
    return (
      <ScreenBackground style={s.container}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={[s.hero, { gap: 14 }]}>
            <SkeletonBox width={90} height={90} borderRadius={45} />
            <SkeletonBox width={160} height={20} borderRadius={8} />
            <SkeletonBox width="100%" height={72} borderRadius={14} />
            <SkeletonBox width="80%" height={13} borderRadius={6} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SkeletonBox width={110} height={40} borderRadius={24} />
              <SkeletonBox width={80} height={40} borderRadius={24} />
            </View>
          </View>
          {/* Sections */}
          {[0, 1].map((i) => (
            <View key={i} style={s.section}>
              <SkeletonBox width={100} height={15} borderRadius={6} />
              {[0, 1, 2].map((j) => (
                <View key={j} style={{ flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "center" }}>
                  <SkeletonBox width={36} height={36} borderRadius={18} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <SkeletonBox width="52%" height={13} borderRadius={6} />
                    <SkeletonBox width="36%" height={11} borderRadius={6} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </ScreenBackground>
    );
  }

  const isOwnProfile = user === username;

  return (
    <ScreenBackground style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#dc2626" colors={["#dc2626"]} />}
      >

        {/* Hero */}
        <View style={s.hero}>
          <UserAvatar username={username as string} avatarColor={profile.avatarColor} avatarUrl={profile.avatarUrl} size={90} />
          <Text style={s.name}>@{username}</Text>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statVal}>{createdBubbles.length}</Text>
              <Text style={s.statLbl}>My Bubbles</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{joinedBubbles.length}</Text>
              <Text style={s.statLbl}>Bubbles I'm In</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statItem}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Text style={s.statVal}>{profile.ratingCount ? profile.avgRating.toFixed(1) : "—"}</Text>
                {profile.ratingCount > 0 && <Ionicons name="star" size={13} color="#fbbf24" />}
              </View>
              <Text style={s.statLbl}>{profile.ratingCount ? `${profile.ratingCount} ratings` : "No ratings"}</Text>
            </View>
          </View>

          {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}

          {/* Action buttons */}
          {!isOwnProfile && (
            <>
              <View style={s.actionRow}>
                <Pressable
                  style={[s.followBtn, profile.isFollowing && s.followingBtn, followLoading && { opacity: 0.6 }]}
                  onPress={handleFollow} disabled={followLoading}
                >
                  <Text style={[s.followBtnText, profile.isFollowing && s.followingBtnText]}>
                    {profile.isFollowing ? "✓ Following" : "Follow"}
                  </Text>
                </Pressable>

                <Pressable
                  style={s.messageBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: "/dm-chat", params: { partner: username } });
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={15} color="#fff" />
                  <Text style={s.messageBtnText}>Message</Text>
                </Pressable>

                {canRate && (
                  <Pressable style={s.rateBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRateModal(true); }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="star" size={15} color="#fbbf24" />
                      <Text style={s.rateBtnText}>Rate</Text>
                    </View>
                  </Pressable>
                )}
              </View>

              <View style={s.moderationRow}>
                <Pressable
                  style={[s.blockBtn, isBlocked && s.blockBtnActive, blockLoading && { opacity: 0.5 }]}
                  onPress={handleBlock} disabled={blockLoading}
                >
                  <Ionicons name={isBlocked ? "remove-circle" : "remove-circle-outline"} size={14} color={isBlocked ? "#dc2626" : "rgba(255,255,255,0.4)"} />
                  <Text style={[s.modBtnText, isBlocked && { color: "#dc2626" }]}>{isBlocked ? "Unblock" : "Block"}</Text>
                </Pressable>

                <Pressable style={s.reportBtn} onPress={() => { setReportReason(null); setReportModal(true); }}>
                  <Ionicons name="flag-outline" size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={s.modBtnText}>Report</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* Ratings breakdown */}
        {reasons.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>What people say</Text>
              <Stars value={profile.avgRating} />
            </View>
            <View style={s.reasonsWrap}>
              {reasons.map((r: any) => (
                <View key={r.reason} style={s.reasonTag}>
                  <Text style={s.reasonText}>{r.reason}</Text>
                  <Text style={s.reasonCount}>{r.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bubbles */}
        {createdBubbles.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Hosting ({createdBubbles.length})</Text>
            {createdBubbles.map((b) => (
              <Pressable
                key={b.id} style={s.bubbleRow}
                onPress={() => router.push({ pathname: "/bubble-detail", params: { id: b.id } })}
              >
                <View style={[s.dot, { backgroundColor: "#7c3aed" }]}>
                  <Text style={s.dotText}>{b.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.bubbleName}>{b.name}</Text>
                  <Text style={s.bubbleMeta}>{b.type ? `${b.type} · ` : ""}{b.members.length} members</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Report modal */}
      <Modal visible={reportModal} transparent animationType="slide" onRequestClose={() => setReportModal(false)}>
        <Pressable style={s.backdrop} onPress={() => setReportModal(false)} />
        <View style={s.modal}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Report @{username}</Text>
          <Text style={s.modalSub}>Reports are anonymous and reviewed by the team</Text>

          <Text style={s.reasonLabel}>What's the issue?</Text>
          <View style={s.reasonGrid}>
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r}
                style={[s.reasonChip, reportReason === r && s.reasonChipActive]}
                onPress={() => setReportReason(r)}
              >
                <Text style={[s.reasonChipText, reportReason === r && s.reasonChipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[s.submitRatingBtn, (!reportReason || reportSubmitting) && { opacity: 0.5 }]}
            onPress={handleReport}
            disabled={!reportReason || reportSubmitting}
          >
            <Text style={s.submitRatingText}>{reportSubmitting ? "Submitting…" : "Submit Report"}</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Rating modal */}
      <Modal visible={rateModal} transparent animationType="slide" onRequestClose={() => setRateModal(false)}>
        <Pressable style={s.backdrop} onPress={() => setRateModal(false)} />
        <View style={s.modal}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Rate @{username}</Text>
          <Text style={s.modalSub}>Your rating is anonymous</Text>

          <StarPicker value={starValue} onChange={setStarValue} />

          <Text style={s.reasonLabel}>What stood out?</Text>
          <View style={s.reasonGrid}>
            {RATING_REASONS.map((r) => (
              <Pressable
                key={r}
                style={[s.reasonChip, rateReason === r && s.reasonChipActive]}
                onPress={() => setRateReason(r)}
              >
                <Text style={[s.reasonChipText, rateReason === r && s.reasonChipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[s.submitRatingBtn, (!starValue || !rateReason || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmitRating}
            disabled={!starValue || !rateReason || submitting}
          >
            <Text style={s.submitRatingText}>{submitting ? "Submitting…" : "Submit Rating"}</Text>
          </Pressable>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 40 },

  hero: { alignItems: "center", padding: 24, gap: 12, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 38, fontWeight: "700" },
  name: { color: "#fff", fontSize: 22, fontWeight: "700" },
  bio: { color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 20, textAlign: "center" },

  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 14, paddingHorizontal: 20, width: "100%",
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statDiv: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.1)" },
  statVal: { color: "#fff", fontSize: 20, fontWeight: "700" },
  statLbl: { color: "rgba(255,255,255,0.4)", fontSize: 11 },

  actionRow: { flexDirection: "row", gap: 10 },
  moderationRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  blockBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  blockBtnActive: { borderColor: "rgba(220,38,38,0.4)", backgroundColor: "rgba(220,38,38,0.08)" },
  reportBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modBtnText: { color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "600" },
  followBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    borderWidth: 1.5, borderColor: "#dc2626",
  },
  followBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "700" },
  followingBtn: { backgroundColor: "rgba(220,38,38,0.12)" },
  followingBtnText: { color: "rgba(220,38,38,0.8)" },
  messageBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)",
  },
  messageBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  rateBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    backgroundColor: "rgba(251,191,36,0.15)",
    borderWidth: 1.5, borderColor: "rgba(251,191,36,0.5)",
  },
  rateBtnText: { color: "#fbbf24", fontSize: 14, fontWeight: "700" },

  section: {
    margin: 16, marginBottom: 0,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 10,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
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
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dotText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  bubbleName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  bubbleMeta: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },

  // Modal
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  modal: {
    backgroundColor: "#1a0808", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 24, paddingBottom: 40, gap: 16,
  },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", alignSelf: "center", marginBottom: 4 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  modalSub: { color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", marginTop: -8 },
  reasonLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  reasonChipActive: { backgroundColor: "rgba(220,38,38,0.15)", borderColor: "#dc2626" },
  reasonChipText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },
  reasonChipTextActive: { color: "#dc2626" },
  submitRatingBtn: {
    height: 50, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  submitRatingText: { color: "#0b0b0f", fontSize: 15, fontWeight: "700" },
});

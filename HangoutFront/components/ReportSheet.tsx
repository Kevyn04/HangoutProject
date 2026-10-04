import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { useAuth } from "@/services/auth-context";
import { useTheme } from "@/services/theme-context";
import type { ThemeColors } from "@/constants/theme";
import { useToast } from "@/context/ToastContext";
import { reportContent, ReportKind } from "@/services/api";

export type ReportTarget = {
  kind: ReportKind;
  contentId: number;
  author: string;
};

const REASONS = ["Spam", "Harassment", "Inappropriate content", "Other"];

const TITLES: Record<ReportKind, string> = {
  dm_message: "Report Message",
  event_message: "Report Message",
  discussion: "Report Discussion",
  discussion_reply: "Report Reply",
  page_post: "Report Post",
  story: "Report Story",
};

// Bottom-sheet report flow shared by every UGC surface. Same look as the
// bubble chat report modal. Pass target=null to hide.
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);
  const { showToast } = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (target) setReason(null); }, [target]);

  const submit = async () => {
    if (!user || !target || !reason) return;
    setSubmitting(true);
    try {
      await reportContent(user, target.kind, target.contentId, target.author, reason);
      onClose();
      showToast("Reported. Thanks for keeping things safe.");
    } catch {
      showToast("Couldn't submit report. Try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>{target ? TITLES[target.kind] : ""}</Text>
        <Text style={s.sub}>Reports are anonymous and reviewed by the team</Text>
        {REASONS.map((r) => (
          <Pressable
            key={r}
            style={[s.reasonRow, reason === r && s.reasonRowActive]}
            onPress={() => setReason(r)}
          >
            <Text style={[s.reasonText, reason === r && s.reasonTextActive]}>{r}</Text>
            {reason === r && <Text style={{ color: colors.red }}>✓</Text>}
          </Pressable>
        ))}
        <Pressable
          style={[s.submitBtn, (!reason || submitting) && { opacity: 0.4 }]}
          onPress={submit}
          disabled={!reason || submitting}
        >
          <Text style={s.submitText}>{submitting ? "Submitting…" : "Submit Report"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function buildStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      backgroundColor: colors.bgMid, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderTopWidth: 1, borderColor: colors.borderFaint,
      padding: 20, paddingBottom: 36,
    },
    handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.textGhost, alignSelf: "center", marginBottom: 16 },
    title: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 4 },
    sub: { color: colors.textMuted, fontSize: 12, marginBottom: 16 },
    reasonRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 14, paddingHorizontal: 4,
      borderBottomWidth: 1, borderColor: colors.borderFaint,
    },
    reasonRowActive: { borderColor: colors.redBorder },
    reasonText: { color: colors.textSub, fontSize: 15, fontWeight: "600" },
    reasonTextActive: { color: colors.red },
    submitBtn: {
      marginTop: 20, backgroundColor: colors.red, borderRadius: 14,
      height: 48, alignItems: "center", justifyContent: "center",
    },
    submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });
}

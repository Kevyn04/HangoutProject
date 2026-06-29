import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, Pressable, StyleSheet,
  NativeSyntheticEvent, NativeScrollEvent, SafeAreaView,
} from "react-native";
import * as Haptics from "expo-haptics";

interface Props {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
}

export function PrivacyPolicyModal({ visible, onAgree, onDecline }: Props) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 40) {
      setScrolledToBottom(true);
    }
  };

  const handleAgree = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScrolledToBottom(false);
    onAgree();
  };

  const handleDecline = () => {
    setScrolledToBottom(false);
    onDecline();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleDecline}>
      <SafeAreaView style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Privacy Policy</Text>
          <Text style={s.headerSub}>Last updated June 2025</Text>
        </View>

        {/* Scrollable policy body */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          <Text style={s.intro}>
            This Privacy Policy explains how <Text style={s.bold}>The Hangout</Text> ("we", "our", or "us") collects, uses, and protects information when you use our mobile application. By using the app you agree to the practices described here.
          </Text>

          <Section title="1. Information We Collect">
            <Card label="Account">
              <Text style={s.body}>
                <Text style={s.bold}>Username</Text> — required to create an account. We use a synthetic email address (<Text style={s.mono}>username@hangout.local</Text>) internally for authentication; your real email is never required for standard sign-up.{"\n\n"}
                If you sign in with <Text style={s.bold}>Apple</Text> or <Text style={s.bold}>Google</Text>, we receive only the information those providers share (typically a name and email address) and use it solely to create your profile.
              </Text>
            </Card>
            <Card label="Profile">
              <Text style={s.body}>
                <Text style={s.bold}>Bio, avatar color, profile emoji</Text> — optional fields you choose to add. These are visible to other users of the app.
              </Text>
            </Card>
            <Card label="Location">
              <Text style={s.body}>
                <Text style={s.bold}>Precise location</Text> — collected <Text style={s.italic}>only</Text> when you explicitly enable location sharing inside a Bubble. Location is shared in real time with other members of that Bubble and is not stored long-term after the Bubble ends. You can disable sharing at any time from within the Bubble screen.
              </Text>
            </Card>
            <Card label="Content">
              <Text style={s.body}>
                <Text style={s.bold}>Messages, Bubbles, Events, Pages</Text> — any content you create or send in the app is stored to provide the service and is visible to other users as intended by the feature.
              </Text>
            </Card>
            <Card label="Usage">
              <Text style={s.body}>
                <Text style={s.bold}>Follows, ratings, reports, blocks</Text> — actions you take toward other users are stored to provide those features.
              </Text>
            </Card>
            <Card label="Notifications">
              <Text style={s.body}>
                <Text style={s.bold}>Push notification token</Text> — collected when you grant notification permission, used only to deliver in-app notifications to your device.
              </Text>
            </Card>
          </Section>

          <Section title="2. How We Use Your Information">
            {[
              "To create and manage your account",
              "To provide the core social features (Bubbles, Events, Pages, Chat)",
              "To show your location to Bubble members when you opt in",
              "To send you push notifications you have enabled",
              "To enforce community safety (reports, blocks, moderation)",
              "To improve app performance and fix bugs",
            ].map((item) => (
              <View key={item} style={s.bulletRow}>
                <Text style={s.bullet}>•</Text>
                <Text style={[s.body, { flex: 1 }]}>{item}</Text>
              </View>
            ))}
            <Text style={[s.body, { marginTop: 10 }]}>
              We do <Text style={s.bold}>not</Text> sell your data to third parties. We do not use your data for advertising.
            </Text>
          </Section>

          <Section title="3. Third-Party Services">
            <Text style={[s.body, { marginBottom: 10 }]}>We use the following third-party services to operate the app:</Text>
            {[
              { name: "Supabase", desc: "Database, authentication, and real-time messaging." },
              { name: "Expo", desc: "App infrastructure and push notifications." },
              { name: "Apple Sign-In / Google OAuth", desc: "Optional authentication methods governed by Apple's and Google's own privacy policies." },
              { name: "Nominatim / OpenStreetMap", desc: "Used for address search when creating a Bubble. Only the address text you type is sent; no personal data is attached." },
            ].map((item) => (
              <View key={item.name} style={s.bulletRow}>
                <Text style={s.bullet}>•</Text>
                <Text style={[s.body, { flex: 1 }]}>
                  <Text style={s.bold}>{item.name}</Text> — {item.desc}
                </Text>
              </View>
            ))}
          </Section>

          <Section title="4. Data Sharing">
            <Text style={s.body}>
              Your profile, content, and activity are visible to other users of the app as described by each feature. We do not share your personal data with any third party except as required to operate the services listed above or as required by law.
            </Text>
          </Section>

          <Section title="5. Data Retention">
            <Text style={s.body}>
              We retain your data for as long as your account exists. Bubbles and their associated messages are deleted when the host ends the Hangout. You may request deletion of your account and all associated data at any time by contacting us (see Section 8).
            </Text>
          </Section>

          <Section title="6. Children's Privacy">
            <Text style={s.body}>
              The Hangout is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.
            </Text>
          </Section>

          <Section title="7. Your Rights">
            <Text style={[s.body, { marginBottom: 10 }]}>You have the right to:</Text>
            {[
              "Access the personal data we hold about you",
              "Correct inaccurate data via the Profile screen in the app",
              "Request deletion of your account and all associated data",
              "Opt out of push notifications at any time via your device settings",
              "Disable location sharing at any time from within any Bubble",
            ].map((item) => (
              <View key={item} style={s.bulletRow}>
                <Text style={s.bullet}>•</Text>
                <Text style={[s.body, { flex: 1 }]}>{item}</Text>
              </View>
            ))}
          </Section>

          <Section title="8. Contact Us">
            <Text style={s.body}>
              If you have any questions about this Privacy Policy or wish to request account deletion, please contact us at:{"\n\n"}
              <Text style={s.email}>kevynvictor.salonga8@gmail.com</Text>
            </Text>
          </Section>

          <Section title="9. Changes to This Policy">
            <Text style={s.body}>
              We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last updated" date at the top of this page. Continued use of the app after changes constitutes acceptance of the revised policy.
            </Text>
          </Section>

          <Text style={s.footer}>© 2025 The Hangout. All rights reserved.</Text>
        </ScrollView>

        {/* Scroll hint */}
        {!scrolledToBottom && (
          <View style={s.scrollHint}>
            <Text style={s.scrollHintText}>Scroll down to read everything</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={s.footer2}>
          <Pressable
            style={({ pressed }) => [s.declineBtn, pressed && { opacity: 0.7 }]}
            onPress={handleDecline}
          >
            <Text style={s.declineBtnText}>Decline</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              s.agreeBtn,
              !scrolledToBottom && s.agreeBtnDisabled,
              pressed && scrolledToBottom && { opacity: 0.85 },
            ]}
            onPress={handleAgree}
            disabled={!scrolledToBottom}
          >
            <Text style={[s.agreeBtnText, !scrolledToBottom && s.agreeBtnTextDisabled]}>
              I Agree
            </Text>
          </Pressable>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardBadge}>
        <Text style={s.cardBadgeText}>{label.toUpperCase()}</Text>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0305" },

  header: {
    padding: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  headerSub: { color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 3 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },

  intro: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 22, marginBottom: 8 },

  section: { marginTop: 28 },
  sectionTitle: {
    color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 14,
    paddingBottom: 8, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 14, marginBottom: 10,
  },
  cardBadge: {
    alignSelf: "flex-start", backgroundColor: "rgba(220,38,38,0.15)",
    borderWidth: 1, borderColor: "rgba(220,38,38,0.35)",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10,
  },
  cardBadgeText: { color: "#dc2626", fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },

  body: { color: "rgba(255,255,255,0.68)", fontSize: 14, lineHeight: 22 },
  bold: { color: "#fff", fontWeight: "700" },
  italic: { fontStyle: "italic" },
  mono: { color: "rgba(255,255,255,0.5)", fontFamily: "monospace" },
  email: { color: "#dc2626" },

  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  bullet: { color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 22 },

  footer: { color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center", marginTop: 32 },

  scrollHint: {
    paddingVertical: 8, alignItems: "center",
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  scrollHintText: { color: "rgba(255,255,255,0.35)", fontSize: 12 },

  footer2: {
    flexDirection: "row", gap: 12, padding: 16,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0f0305",
  },
  declineBtn: {
    flex: 1, height: 50, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  declineBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" },

  agreeBtn: {
    flex: 2, height: 50, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#dc2626",
  },
  agreeBtnDisabled: { backgroundColor: "rgba(220,38,38,0.25)" },
  agreeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  agreeBtnTextDisabled: { color: "rgba(255,255,255,0.35)" },
});

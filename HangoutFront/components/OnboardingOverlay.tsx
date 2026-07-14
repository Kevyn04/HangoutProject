import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal, Alert,
  FlatList, Dimensions, Animated, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

const PRIVACY_URL = "https://kevyn04.github.io/HangoutProject/privacy.html";

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  title: string;
  subtitle: string;
  isConsent?: boolean;
};

const FEATURE_SLIDES: Slide[] = [
  {
    icon: "people-circle-outline",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.12)",
    title: "Drop a Bubble",
    subtitle:
      "Spontaneously invite friends or anyone nearby to hang out at your spot. No planning needed — just vibe.",
  },
  {
    icon: "calendar-outline",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.12)",
    title: "Join Events",
    subtitle:
      "Discover events happening around you. RSVP, chat with attendees, and get reminded 1 hour before showtime.",
  },
  {
    icon: "compass-outline",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.12)",
    title: "Find Your Vibe",
    subtitle:
      "Follow people you click with, explore the map to see what's popping, and build your hangout circle.",
  },
];

const CONSENT_SLIDE: Slide = {
  icon: "shield-checkmark-outline",
  color: "#22c55e",
  bg: "rgba(34,197,94,0.12)",
  title: "Your Privacy",
  subtitle: "Hangout works by connecting you with people nearby. Here's what we use:",
  isConsent: true,
};

const DATA_POINTS = [
  {
    icon: "location-outline" as const,
    label: "Location",
    detail: "To show bubbles, events, and people near you",
  },
  {
    icon: "person-circle-outline" as const,
    label: "Profile info",
    detail: "The username, photo, and bio you choose to share",
  },
  {
    icon: "chatbubbles-outline" as const,
    label: "Messages & activity",
    detail: "Chats and RSVPs, kept safe and used for moderation",
  },
];

interface Props {
  visible: boolean;
  /** "full" shows the feature tour + consent; "consent" shows only the privacy step */
  mode?: "full" | "consent";
  onAccept: () => void;
}

export function OnboardingOverlay({ visible, mode = "full", onAccept }: Props) {
  const slides = mode === "consent" ? [CONSENT_SLIDE] : [...FEATURE_SLIDES, CONSENT_SLIDE];
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollX = useRef(new Animated.Value(0)).current;

  const isConsent = !!slides[index]?.isConsent;
  const lastIndex = slides.length - 1;

  const goTo = (next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(fadeAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(onAccept);
  };

  const handleDecline = () => {
    Alert.alert(
      "Consent Needed",
      "Hangout connects you with people nearby, so it needs your location, profile, and messages to work. We can't continue without your consent.",
      [
        { text: "Read Privacy Policy", onPress: () => Linking.openURL(PRIVACY_URL) },
        { text: "OK", style: "cancel" },
      ],
    );
  };

  const handleNext = () => {
    if (index < lastIndex) goTo(index + 1);
    else handleAccept();
  };

  // Skip fast-forwards to the consent step — it never bypasses it
  const handleSkip = () => goTo(lastIndex);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={["#120303", "#1a0505", "#0f0305"]}
          style={StyleSheet.absoluteFill}
        />

        {/* Skip button */}
        {!isConsent && slides.length > 1 && (
          <Pressable style={s.skipBtn} onPress={handleSkip} accessibilityRole="button" accessibilityLabel="Skip to privacy step">
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        )}

        {/* Slides */}
        <Animated.FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          scrollEnabled={slides.length > 1}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          onMomentumScrollEnd={(e) => {
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          renderItem={({ item, index: i }) => {
            const iconScale = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.6, 1, 0.6],
              extrapolate: "clamp",
            });
            const contentOpacity = scrollX.interpolate({
              inputRange: [(i - 0.6) * width, i * width, (i + 0.6) * width],
              outputRange: [0, 1, 0],
              extrapolate: "clamp",
            });
            return (
              <Animated.View style={[s.slide, { opacity: contentOpacity }]}>
                <Animated.View
                  style={[
                    s.iconCircle,
                    { backgroundColor: item.bg, borderColor: `${item.color}33`, transform: [{ scale: iconScale }] },
                  ]}
                >
                  <Ionicons name={item.icon} size={52} color={item.color} />
                </Animated.View>
                <Text style={s.title}>{item.title}</Text>
                <Text style={s.subtitle}>{item.subtitle}</Text>

                {item.isConsent && (
                  <View style={s.consentBox}>
                    {DATA_POINTS.map((d) => (
                      <View key={d.label} style={s.dataRow}>
                        <View style={s.dataIcon}>
                          <Ionicons name={d.icon} size={18} color="#22c55e" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.dataLabel}>{d.label}</Text>
                          <Text style={s.dataDetail}>{d.detail}</Text>
                        </View>
                      </View>
                    ))}
                    <Pressable
                      style={({ pressed }) => [s.policyLink, pressed && { opacity: 0.7 }]}
                      onPress={() => Linking.openURL(PRIVACY_URL)}
                      accessibilityRole="link"
                      accessibilityLabel="Read the full privacy policy"
                    >
                      <Ionicons name="document-text-outline" size={15} color="#7dd3fc" />
                      <Text style={s.policyLinkText}>Read the full Privacy Policy</Text>
                      <Ionicons name="open-outline" size={13} color="#7dd3fc" />
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            );
          }}
        />

        {/* Dots */}
        {slides.length > 1 && (
          <View style={s.dots}>
            {slides.map((_, i) => {
              // Scale (not width) so this stays on the native driver like scrollX —
              // width/height aren't supported there and log a warning every frame.
              const dotScaleX = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [0.25, 1, 0.25],
                extrapolate: "clamp",
              });
              const dotOpacity = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [0.25, 1, 0.25],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={i}
                  style={[s.dot, { opacity: dotOpacity, transform: [{ scaleX: dotScaleX }] }]}
                />
              );
            })}
          </View>
        )}

        {/* CTA */}
        {isConsent && (
          <Text style={s.consentFootnote}>
            By tapping Accept, you agree to our Privacy Policy.
          </Text>
        )}
        <Pressable
          style={({ pressed }) => [s.ctaBtn, isConsent && s.ctaBtnAccept, pressed && { opacity: 0.85 }]}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel={isConsent ? "Accept the privacy policy and continue" : "Next slide"}
        >
          <Text style={[s.ctaText, isConsent && s.ctaTextAccept]}>
            {isConsent ? "Accept & Continue" : "Next"}
          </Text>
          {!isConsent && (
            <Ionicons name="arrow-forward" size={16} color="#0b0b0f" style={{ marginLeft: 6 }} />
          )}
        </Pressable>
        {isConsent ? (
          <Pressable
            style={s.declineBtn}
            onPress={handleDecline}
            accessibilityRole="button"
            accessibilityLabel="Decline and learn why consent is needed"
          >
            <Text style={s.declineText}>Not now</Text>
          </Pressable>
        ) : (
          <View style={{ height: 44 }} />
        )}

        <View style={{ height: 40 }} />
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtn: {
    position: "absolute",
    top: 60,
    right: 24,
    padding: 12,
    zIndex: 10,
  },
  skipText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "600",
  },
  slide: {
    width,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 16,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 4,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
  },
  consentBox: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 16,
    gap: 14,
    marginTop: 4,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  dataIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(34,197,94,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  dataLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  dataDetail: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12.5,
    lineHeight: 17,
  },
  policyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 2,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  policyLinkText: {
    color: "#7dd3fc",
    fontSize: 13,
    fontWeight: "600",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 36,
    marginBottom: 28,
  },
  dot: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#dc2626",
  },
  consentFootnote: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 40,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    minWidth: 220,
  },
  ctaBtnAccept: {
    backgroundColor: "#22c55e",
  },
  ctaText: {
    color: "#0b0b0f",
    fontSize: 16,
    fontWeight: "800",
  },
  ctaTextAccept: {
    color: "#04120a",
  },
  declineBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 4,
    minHeight: 44,
    justifyContent: "center",
  },
  declineText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "600",
  },
});

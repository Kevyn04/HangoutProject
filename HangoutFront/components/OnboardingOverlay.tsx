import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal,
  FlatList, Dimensions, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "people-circle-outline" as const,
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.12)",
    title: "Drop a Bubble",
    subtitle:
      "Spontaneously invite friends or anyone nearby to hang out at your spot. No planning needed — just vibe.",
  },
  {
    icon: "calendar-outline" as const,
    color: "#dc2626",
    bg: "rgba(220,38,38,0.12)",
    title: "Join Events",
    subtitle:
      "Discover events happening around you. RSVP, chat with attendees, and get reminded 1 hour before showtime.",
  },
  {
    icon: "compass-outline" as const,
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.12)",
    title: "Find Your Vibe",
    subtitle:
      "Follow people you click with, explore the map to see what's popping, and build your hangout circle.",
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function OnboardingOverlay({ visible, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const handleNext = () => {
    if (index < SLIDES.length - 1) {
      goTo(index + 1);
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(onDone);
    }
  };

  const handleSkip = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDone);
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={["#120303", "#1a0505", "#0f0305"]}
          style={StyleSheet.absoluteFill}
        />

        {/* Skip button */}
        {!isLast && (
          <Pressable style={s.skipBtn} onPress={handleSkip}>
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        )}

        {/* Slides */}
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.slide}>
              <View style={[s.iconCircle, { backgroundColor: item.bg, borderColor: `${item.color}33` }]}>
                <Ionicons name={item.icon} size={56} color={item.color} />
              </View>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.subtitle}>{item.subtitle}</Text>
            </View>
          )}
        />

        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === index ? s.dotActive : s.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={handleNext}
        >
          <Text style={s.ctaText}>{isLast ? "Get Started" : "Next"}</Text>
          {!isLast && (
            <Ionicons name="arrow-forward" size={16} color="#0b0b0f" style={{ marginLeft: 6 }} />
          )}
        </Pressable>

        <View style={{ height: 48 }} />
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
    padding: 8,
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
    paddingHorizontal: 40,
    gap: 20,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 8,
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
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 40,
    marginBottom: 32,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: "#dc2626",
  },
  dotInactive: {
    width: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
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
  ctaText: {
    color: "#0b0b0f",
    fontSize: 16,
    fontWeight: "800",
  },
});

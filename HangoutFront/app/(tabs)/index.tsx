import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  AccessibilityInfo,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { useFonts, GreatVibes_400Regular } from "@expo-google-fonts/great-vibes";
import { Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useRouter } from "expo-router";
import { useAuth } from "@/services/auth-context";
import { AppColors } from "@/constants/theme";

const { width: WIN_W, height: WIN_H } = Dimensions.get("window");
// Fixed circle diameter matching the original max radius (280) * 2
const PULSE_D = 560;

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/map");
    }
  }, [loading, user]);

  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({ GreatVibes_400Regular, Cinzel_700Bold });

  useEffect(() => {
    // useNativeDriver: true — only transform + opacity are animated
    const makePulse = (v: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(v, {
            toValue: 1,
            duration: 3800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    let animations: Animated.CompositeAnimation[] = [];

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) return;
      const a = makePulse(pulse1, 0);
      const b = makePulse(pulse2, 1200);
      const c = makePulse(pulse3, 2400);
      animations = [a, b, c];
      a.start();
      b.start();
      c.start();
    });

    return () => animations.forEach((a) => a.stop());
  }, [pulse1, pulse2, pulse3]);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  // Opacity fades: appear quickly, linger, then vanish
  const o1 = pulse1.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.35, 0] });
  const o2 = pulse2.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.28, 0] });
  const o3 = pulse3.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.22, 0] });

  // Position circles so they expand from the same point as the original SVG circles
  const circleTop  = WIN_H * 0.3 - PULSE_D / 2;
  const circleLeft = WIN_W * 0.5 - PULSE_D / 2;

  return (
    <View style={styles.container}>
      <LinearGradient colors={AppColors.gradient} style={StyleSheet.absoluteFill} />

      {/* Static radial glow */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="20%" r="60%">
            <Stop offset="0%"   stopColor="#dc2626" stopOpacity="0.35" />
            <Stop offset="45%"  stopColor="#7c3aed" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>

      {/* Pulse rings — Animated.View with useNativeDriver: true */}
      <Animated.View
        pointerEvents="none"
        style={[styles.pulseCircle, { borderColor: "rgba(220,38,38,1)", top: circleTop, left: circleLeft, opacity: o1, transform: [{ scale: pulse1 }] }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.pulseCircle, { borderColor: "rgba(124,58,237,1)", top: circleTop, left: circleLeft, opacity: o2, transform: [{ scale: pulse2 }] }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.pulseCircle, { borderColor: "rgba(14,165,233,1)", top: circleTop, left: circleLeft, opacity: o3, transform: [{ scale: pulse3 }] }]}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>The Hangout</Text>
          <Text style={styles.subtitle}>FOR EVERYONE, EVERYWHERE</Text>
        </View>

        <View style={styles.signInSection}>
          {user ? (
            <View style={styles.buttonRow}>
              <Text style={styles.welcomeText}>Welcome, {user}</Text>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => router.push("/(tabs)/map")}
                accessibilityLabel="Enter the app"
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>Enter</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => logout()}
                accessibilityLabel="Sign out of your account"
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>Sign Out</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => router.push("/signin")}
                accessibilityLabel="Sign in to your account"
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>Sign In</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => router.push("/signup")}
                accessibilityLabel="Create a new account"
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>Sign Up</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => router.push("/(tabs)/map")}
                accessibilityLabel="Continue as guest without signing in"
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>Enter as Guest</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  loadingContainer: {
    flex: 1,
    backgroundColor: AppColors.bgDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  pulseCircle: {
    position: "absolute",
    width: PULSE_D,
    height: PULSE_D,
    borderRadius: PULSE_D / 2,
    borderWidth: 2,
  },
  hero: { paddingTop: 70, paddingBottom: 10, alignItems: "center" },
  title: {
    fontSize: 56,
    fontFamily: "GreatVibes_400Regular",
    color: "white",
    letterSpacing: 1,
    textAlign: "center",
    textShadowColor: "rgba(255,255,255,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 2,
    color: "#f8fafc",
    opacity: 0.9,
    textAlign: "center",
  },
  signInSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
  },
  buttonRow: { width: "100%", paddingHorizontal: 44, gap: 12 },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.btnLight,
  },
  primaryBtnText: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: AppColors.btnLightText,
    fontFamily: "Cinzel_700Bold",
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  secondaryBtnText: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#f8fafc",
    fontFamily: "Cinzel_700Bold",
  },
  welcomeText: {
    fontSize: 18,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 1,
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 4,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});

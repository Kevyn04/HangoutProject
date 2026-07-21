import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/services/theme-context";

interface Props {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width, height, borderRadius = 8, style }: Props) {
  const { colors } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-300, 300] });

  return (
    <View
      style={[
        { width, height, borderRadius, backgroundColor: colors.card, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View style={{ position: "absolute", inset: 0, transform: [{ translateX }] }}>
        <LinearGradient
          colors={["transparent", colors.borderLight, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

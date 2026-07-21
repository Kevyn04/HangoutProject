import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/services/theme-context";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ScreenBackground({ children, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={colors.gradient}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Red ambient blob — top right */}
      <View style={[styles.blob, {
        width: 380, height: 380, borderRadius: 190,
        backgroundColor: colors.blobRed,
        top: -100, right: -80,
      }]} />
      {/* Purple ambient blob — bottom left */}
      <View style={[styles.blob, {
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: colors.blobPurple,
        bottom: 80, left: -70,
      }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: { position: "absolute" },
});

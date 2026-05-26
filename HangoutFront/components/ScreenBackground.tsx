import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ScreenBackground({ children, style }: Props) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={["#0f0305", "#120303", "#0a0208"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Red ambient blob — top right */}
      <View style={[styles.blob, {
        width: 380, height: 380, borderRadius: 190,
        backgroundColor: "rgba(220,38,38,0.055)",
        top: -100, right: -80,
      }]} />
      {/* Purple ambient blob — bottom left */}
      <View style={[styles.blob, {
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: "rgba(124,58,237,0.045)",
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

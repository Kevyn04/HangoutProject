import React from "react";
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from "react-native";

interface Props {
  username: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  size?: number;
  style?: ViewStyle;
}

export function UserAvatar({ username, avatarColor = "#7c3aed", avatarUrl, size = 40, style }: Props) {
  const dim: ImageStyle = { width: size, height: size, borderRadius: size / 2 };
  const fontSize = Math.round(size * 0.38);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[dim, styles.photo]}
      />
    );
  }

  return (
    <View style={[dim, styles.circle, { backgroundColor: avatarColor }, style]}>
      <Text style={[styles.initial, { fontSize }]}>
        {username.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: "#1a1a1a" },
  circle: { alignItems: "center", justifyContent: "center" },
  initial: { color: "#fff", fontWeight: "700" },
});

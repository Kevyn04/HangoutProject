import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorScreen({ message = "Something went wrong.", onRetry }: Props) {
  return (
    <View style={s.container}>
      <Text style={s.icon}>⚠️</Text>
      <Text style={s.message}>{message}</Text>
      {onRetry && (
        <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]} onPress={onRetry}>
          <Text style={s.btnText}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#120303", alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  icon: { fontSize: 40 },
  message: { color: "rgba(255,255,255,0.6)", fontSize: 15, textAlign: "center", lineHeight: 22 },
  btn: {
    marginTop: 4, paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(220,38,38,0.5)",
    backgroundColor: "rgba(220,38,38,0.12)",
  },
  btnText: { color: "#dc2626", fontWeight: "700", fontSize: 14 },
});

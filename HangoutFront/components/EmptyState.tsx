import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/services/theme-context";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => buildStyles(colors), [colors]);
  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Ionicons name={icon} size={40} color={colors.borderLight} />
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {action && (
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            action.onPress();
          }}
        >
          <Text style={s.btnText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

function buildStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
      paddingHorizontal: 32,
      gap: 10,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderFaint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    title: {
      color: colors.textSub,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    subtitle: {
      color: colors.textGhost,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 19,
    },
    btn: {
      marginTop: 8,
      paddingHorizontal: 24,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.redBorder,
      backgroundColor: colors.redSubtle,
    },
    btnText: {
      color: colors.red,
      fontWeight: "700",
      fontSize: 13,
    },
  });
}

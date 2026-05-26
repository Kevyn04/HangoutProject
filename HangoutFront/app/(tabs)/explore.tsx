import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { getBubbles } from "@/services/api";
import { SkeletonBox } from "@/components/SkeletonBox";
import { ErrorScreen } from "@/components/ErrorScreen";
import { useToast } from "@/context/ToastContext";

type Bubble = {
  id: number;
  name: string;
  description?: string;
  createdBy: string;
  type?: string;
  meetTime?: string;
  maxMembers?: number;
  members: string[];
  latitude?: number;
  longitude?: number;
};

export default function BubblesScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadBubbles = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getBubbles();
      setBubbles(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBubbles();
    }, [loadBubbles])
  );

  if (loadError) {
    return <ErrorScreen message="Couldn't load bubbles." onRetry={loadBubbles} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#120303" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bubbles</Text>
        <Pressable style={styles.createButton} onPress={() => router.push("/create-bubble")}>
          <Text style={styles.createButtonText}>+ New</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>Your groups &amp; meetup circles</Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0,1,2,3].map((i) => (
            <View key={i} style={[styles.card, { gap: 12 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <SkeletonBox width={44} height={44} borderRadius={22} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonBox width="50%" height={15} borderRadius={6} />
                  <SkeletonBox width="30%" height={11} borderRadius={6} />
                </View>
              </View>
              <SkeletonBox width="70%" height={11} borderRadius={6} />
            </View>
          ))
        ) : bubbles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No bubbles yet.</Text>
            <Text style={styles.emptySubtext}>Tap + New to get started.</Text>
          </View>
        ) : (
          bubbles.map((bubble) => (
            <Pressable
              key={bubble.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push({ pathname: "/bubble-detail", params: { id: bubble.id } })}
            >
              <View style={styles.cardTop}>
                <View style={styles.bubbleIcon}>
                  <Text style={styles.bubbleIconText}>{bubble.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{bubble.name}</Text>
                  <View style={styles.cardMeta}>
                    {bubble.type ? (
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{bubble.type}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.cardMembers}>
                      {bubble.members.length}{bubble.maxMembers ? `/${bubble.maxMembers}` : ""} member{bubble.members.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              </View>
              {bubble.meetTime ? (
                <Text style={styles.meetTime}>🕐 {bubble.meetTime}</Text>
              ) : null}
              {bubble.description ? (
                <Text style={styles.cardDescription}>{bubble.description}</Text>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#120303",
    paddingTop: 56,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  createButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    gap: 8,
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtext: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
    gap: 10,
  },
  cardPressed: {
    opacity: 0.75,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bubbleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleIconText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  typeBadge: {
    backgroundColor: "rgba(124,58,237,0.3)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    color: "#c4b5fd",
    fontSize: 11,
    fontWeight: "600",
  },
  cardMembers: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
  },
  meetTime: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  cardDescription: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    lineHeight: 18,
  },
});

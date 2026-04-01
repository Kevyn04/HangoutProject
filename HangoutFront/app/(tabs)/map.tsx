import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  Modal,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { getEvents, getBubbles, joinBubble } from "@/services/api";
import { useAuth } from "@/services/auth-context";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.6;
const SHEET_MIN_H = 80;
const COLLAPSED_Y = SHEET_MAX_H - SHEET_MIN_H;

const BLOOMSBURG_REGION = {
  latitude: 41.0026,
  longitude: -76.4547,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

type Event = {
  id: number;
  title: string;
  location: string;
  time: string;
  createdBy: string;
  latitude?: number;
  longitude?: number;
};

type Bubble = {
  id: number;
  name: string;
  description?: string;
  createdBy: string;
  type?: string;
  meetTime?: string;
  latitude?: number;
  longitude?: number;
  members: string[];
  isSecret?: boolean;
  revealAt?: string;
};

export default function MapScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinedIds, setJoinedIds] = useState<Set<number>>(new Set());

  const translateY = useRef(new Animated.Value(COLLAPSED_Y)).current;
  const offsetRef = useRef(COLLAPSED_Y);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        translateY.stopAnimation((val) => {
          offsetRef.current = val;
        });
      },
      onPanResponderMove: (_, { dy }) => {
        const newVal = Math.max(0, Math.min(COLLAPSED_Y, offsetRef.current + dy));
        translateY.setValue(newVal);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const currentY = Math.max(0, Math.min(COLLAPSED_Y, offsetRef.current + dy));
        const target = vy < -0.5 || currentY < COLLAPSED_Y / 2 ? 0 : COLLAPSED_Y;
        Animated.spring(translateY, {
          toValue: target,
          useNativeDriver: false,
          bounciness: 4,
        }).start(() => {
          offsetRef.current = target;
        });
      },
    })
  ).current;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsData, bubblesData] = await Promise.all([getEvents(), getBubbles()]);
      setEvents(eventsData);
      setBubbles(bubblesData);
    } catch (e) {
      console.error("Failed to load map data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleJoin = async () => {
    if (!selectedBubble) return;
    const username = user ?? "Guest";
    setJoining(true);
    try {
      const updated = await joinBubble(selectedBubble.id, username);
      setBubbles((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b))
      );
      setJoinedIds((prev) => new Set(prev).add(selectedBubble.id));
      setSelectedBubble(updated);
    } catch (e) {
      console.error("Failed to join bubble:", e);
    } finally {
      setJoining(false);
    }
  };

  const eventMarkers = events.filter((e) => e.latitude != null && e.longitude != null);
  const bubbleMarkers = bubbles.filter((b) => b.latitude != null && b.longitude != null);

  const alreadyJoined = selectedBubble
    ? joinedIds.has(selectedBubble.id) || (user != null && selectedBubble.members.includes(user))
    : false;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={BLOOMSBURG_REGION}
        showsUserLocation
        showsMyLocationButton
        showsBuildings
      >
        {/* Event markers — red */}
        {eventMarkers.map((m) => (
          <Marker
            key={`event-${m.id}`}
            coordinate={{ latitude: m.latitude!, longitude: m.longitude! }}
            title={m.title}
            description={m.location}
            pinColor="#dc2626"
          />
        ))}

        {/* Bubble markers — custom view, lock icon if secret */}
        {bubbleMarkers.map((b) => {
          const stillSecret = b.isSecret && b.revealAt && new Date(b.revealAt) > new Date();
          return (
            <Marker
              key={`bubble-${b.id}`}
              coordinate={{ latitude: b.latitude!, longitude: b.longitude! }}
              onPress={() => setSelectedBubble(b)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={stillSecret ? bMarker.secret : bMarker.normal}>
                <Text style={bMarker.label}>
                  {stillSecret ? "🔒" : b.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#dc2626" }]} />
          <Text style={styles.legendText}>Events</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#7c3aed" }]} />
          <Text style={styles.legendText}>Bubbles</Text>
        </View>
      </View>

      {/* Events bottom sheet */}
      <Animated.View
        style={[styles.sheet, { height: SHEET_MAX_H, transform: [{ translateY }] }]}
      >
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Events Nearby</Text>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetList}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="large" color="white" style={{ marginTop: 20 }} />
          ) : events.length === 0 ? (
            <Text style={styles.emptyText}>No events nearby yet.</Text>
          ) : (
            events.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() =>
                  router.push({
                    pathname: "/event-details",
                    params: {
                      id: item.id,
                      title: item.title,
                      location: item.location,
                      time: item.time,
                      createdBy: item.createdBy,
                    },
                  })
                }
              >
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Location</Text>
                  <Text style={styles.cardValue}>{item.location}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Time</Text>
                  <Text style={styles.cardValue}>{item.time}</Text>
                </View>
                <Text style={styles.createdBy}>by {item.createdBy}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </Animated.View>

      {/* Bubble join modal */}
      <Modal
        visible={selectedBubble != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBubble(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedBubble(null)} />
        {selectedBubble && (() => {
          const stillSecret = selectedBubble.isSecret && selectedBubble.revealAt
            && new Date(selectedBubble.revealAt) > new Date();
          const revealTime = selectedBubble.revealAt
            ? new Date(selectedBubble.revealAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;
          return (
            <View style={styles.bubbleSheet}>
              <View style={styles.bubbleSheetHandle} />

              <View style={styles.bubbleIconRow}>
                <View style={[styles.bubbleIcon, stillSecret && styles.bubbleIconSecret]}>
                  <Text style={styles.bubbleIconText}>
                    {stillSecret ? "🔒" : selectedBubble.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bubbleName}>{selectedBubble.name}</Text>
                  <Text style={styles.bubbleMeta}>
                    {selectedBubble.members.length} member{selectedBubble.members.length !== 1 ? "s" : ""} · by {selectedBubble.createdBy}
                  </Text>
                </View>
              </View>

              {/* Type + time row */}
              {(selectedBubble.type || selectedBubble.meetTime) && (
                <View style={styles.bubbleTagRow}>
                  {selectedBubble.type && (
                    <View style={styles.bubbleTypeBadge}>
                      <Text style={styles.bubbleTypeBadgeText}>{selectedBubble.type}</Text>
                    </View>
                  )}
                  {selectedBubble.meetTime && (
                    <Text style={styles.bubbleTimeText}>🕐 {selectedBubble.meetTime}</Text>
                  )}
                </View>
              )}

              {/* Secret reveal notice */}
              {stillSecret && revealTime && (
                <View style={styles.secretBanner}>
                  <Text style={styles.secretBannerText}>
                    🔒 Location revealed at {revealTime}
                  </Text>
                </View>
              )}

              {selectedBubble.description ? (
                <Text style={styles.bubbleDesc}>{selectedBubble.description}</Text>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.joinBtn,
                  alreadyJoined && styles.joinBtnJoined,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={alreadyJoined ? undefined : handleJoin}
                disabled={joining || alreadyJoined}
              >
                {joining ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.joinBtnText}>
                    {alreadyJoined ? "Already in this Bubble" : "Join Bubble"}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#120303",
  },
  map: {
    flex: 1,
  },

  // Legend
  legend: {
    position: "absolute",
    top: 56,
    right: 12,
    backgroundColor: "rgba(18,3,3,0.85)",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
  },

  // Events bottom sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1a0808",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.85)",
  },
  sheetScroll: {
    flex: 1,
  },
  sheetList: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    gap: 6,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
  },
  cardValue: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
  createdBy: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontStyle: "italic",
    marginTop: 4,
  },
  emptyText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    paddingVertical: 20,
  },

  // Bubble join modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  bubbleSheet: {
    backgroundColor: "#1a0808",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  bubbleSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignSelf: "center",
    marginBottom: 4,
  },
  bubbleIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bubbleIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleIconText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  bubbleName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  bubbleMeta: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginTop: 2,
  },
  bubbleDesc: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    lineHeight: 20,
  },
  joinBtn: {
    backgroundColor: "#7c3aed",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  joinBtnJoined: {
    backgroundColor: "rgba(124,58,237,0.35)",
  },
  joinBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  bubbleIconSecret: {
    backgroundColor: "#374151",
  },
  bubbleTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  bubbleTypeBadge: {
    backgroundColor: "rgba(124,58,237,0.3)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bubbleTypeBadgeText: {
    color: "#c4b5fd",
    fontSize: 12,
    fontWeight: "600",
  },
  bubbleTimeText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
  },
  secretBanner: {
    backgroundColor: "rgba(55,65,81,0.6)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  secretBannerText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
});

const bMarker = StyleSheet.create({
  normal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  secret: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  label: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

import React, { useRef, useState, useCallback, useMemo } from "react";
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
  TextInput,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { getEvents, getBubbles } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import { useToast } from "@/context/ToastContext";

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

const EVENT_TYPES = ["Hangout", "Munchies", "Secret Location", "Sports", "Games"];

type Event = {
  id: number;
  title: string;
  location: string;
  time: string;
  createdBy: string;
  latitude?: number;
  longitude?: number;
  type?: string | null;
  eventDate?: string | null;
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
  isSecret: boolean;
  revealAt?: string | null;
  members: string[];
};

type MapPoint = {
  key: string;
  kind: "event" | "bubble";
  latitude: number;
  longitude: number;
  event?: Event;
  bubble?: Bubble;
};

type Cluster = {
  key: string;
  latitude: number;
  longitude: number;
  points: MapPoint[];
};

// Grid-based clustering: bucket points into cells sized from the current zoom
// so overlapping pins merge into count badges instead of stacking.
function clusterPoints(points: MapPoint[], region: Region): Cluster[] {
  const cell = region.latitudeDelta / 8;
  const buckets = new Map<string, MapPoint[]>();
  for (const p of points) {
    const k = `${Math.round(p.latitude / cell)}:${Math.round(p.longitude / cell)}`;
    const arr = buckets.get(k);
    if (arr) arr.push(p);
    else buckets.set(k, [p]);
  }
  return Array.from(buckets.entries()).map(([k, pts]) => ({
    key: k,
    latitude: pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
    longitude: pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
    points: pts,
  }));
}

// A secret bubble's location stays hidden until its reveal time has passed.
function bubbleLocationVisible(b: Bubble): boolean {
  if (!b.isSecret) return true;
  if (!b.revealAt) return false;
  return new Date(b.revealAt).getTime() <= Date.now();
}

function isToday(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export default function MapScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { showToast } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBubbles, setShowBubbles] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [todayOnly, setTodayOnly] = useState(false);
  const [region, setRegion] = useState<Region>(BLOOMSBURG_REGION);

  const mapRef = useRef<MapView>(null);
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
    } catch {
      showToast("Couldn't load map data. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const q = searchQuery.toLowerCase().trim();

  const filteredEvents = useMemo(() => {
    let list = events;
    if (typeFilter) list = list.filter((e) => e.type === typeFilter);
    if (todayOnly) list = list.filter((e) => isToday(e.eventDate));
    if (q) list = list.filter((e) => e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
    return list;
  }, [events, typeFilter, todayOnly, q]);

  const filteredBubbles = useMemo(() => {
    if (!showBubbles || typeFilter || todayOnly) return [];
    let list = bubbles;
    if (q) list = list.filter((b) => b.name.toLowerCase().includes(q) || (b.description ?? "").toLowerCase().includes(q));
    return list;
  }, [bubbles, showBubbles, typeFilter, todayOnly, q]);

  const clusters = useMemo(() => {
    const points: MapPoint[] = [
      ...filteredEvents
        .filter((e) => e.latitude != null && e.longitude != null)
        .map((e) => ({
          key: `event-${e.id}`, kind: "event" as const,
          latitude: e.latitude!, longitude: e.longitude!, event: e,
        })),
      ...filteredBubbles
        .filter((b) => b.latitude != null && b.longitude != null && bubbleLocationVisible(b))
        .map((b) => ({
          key: `bubble-${b.id}`, kind: "bubble" as const,
          latitude: b.latitude!, longitude: b.longitude!, bubble: b,
        })),
    ];
    return clusterPoints(points, region);
  }, [filteredEvents, filteredBubbles, region]);

  const openPoint = (p: MapPoint) => {
    if (p.kind === "event" && p.event) {
      router.push({
        pathname: "/event-details",
        params: {
          id: p.event.id,
          title: p.event.title,
          location: p.event.location,
          time: p.event.time,
          createdBy: p.event.createdBy,
          type: p.event.type ?? "",
        },
      });
    } else if (p.bubble) {
      router.push({ pathname: "/bubble-detail", params: { id: p.bubble.id } });
    }
  };

  const zoomIntoCluster = (c: Cluster) => {
    mapRef.current?.animateToRegion(
      {
        latitude: c.latitude,
        longitude: c.longitude,
        latitudeDelta: region.latitudeDelta / 3,
        longitudeDelta: region.longitudeDelta / 3,
      },
      300
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={BLOOMSBURG_REGION}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
        showsBuildings
      >
        {clusters.map((c) =>
          c.points.length === 1 ? (
            <Marker
              key={c.points[0].key}
              coordinate={{ latitude: c.points[0].latitude, longitude: c.points[0].longitude }}
              title={c.points[0].event?.title ?? c.points[0].bubble?.name}
              description={c.points[0].event?.location ?? c.points[0].bubble?.description ?? undefined}
              pinColor={c.points[0].kind === "event" ? "#dc2626" : "#7c3aed"}
              onCalloutPress={() => openPoint(c.points[0])}
            />
          ) : (
            <Marker
              key={`cluster-${c.key}`}
              coordinate={{ latitude: c.latitude, longitude: c.longitude }}
              onPress={() => zoomIntoCluster(c)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.clusterBubble,
                  { backgroundColor: c.points.some((p) => p.kind === "event") ? "#dc2626" : "#7c3aed" },
                ]}
              >
                <Text style={styles.clusterText}>{c.points.length}</Text>
              </View>
            </Marker>
          )
        )}
      </MapView>

      {/* Filter chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            style={[styles.chip, showBubbles && styles.chipPurpleOn]}
            onPress={() => setShowBubbles((v) => !v)}
          >
            <Text style={[styles.chipText, showBubbles && styles.chipTextOn]}>Bubbles</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, todayOnly && styles.chipRedOn]}
            onPress={() => setTodayOnly((v) => !v)}
          >
            <Text style={[styles.chipText, todayOnly && styles.chipTextOn]}>Today</Text>
          </Pressable>
          {EVENT_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, typeFilter === t && styles.chipRedOn]}
              onPress={() => setTypeFilter((cur) => (cur === t ? null : t))}
            >
              <Text style={[styles.chipText, typeFilter === t && styles.chipTextOn]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#dc2626" }]} />
          <Text style={styles.legendText}>Events</Text>
        </View>
        {showBubbles && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#7c3aed" }]} />
            <Text style={styles.legendText}>Bubbles</Text>
          </View>
        )}
      </View>

      {/* Nearby bottom sheet */}
      <Animated.View
        style={[styles.sheet, { height: SHEET_MAX_H, transform: [{ translateY }] }]}
      >
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Nearby</Text>
            <Pressable style={styles.newEventBtn} onPress={() => router.push("/create")}>
              <Text style={styles.newEventBtnText}>+ New</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search events and bubbles…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetList}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="large" color="white" style={{ marginTop: 20 }} />
          ) : filteredEvents.length === 0 && filteredBubbles.length === 0 ? (
            <Text style={styles.emptyText}>Nothing nearby matches your filters.</Text>
          ) : (
            <>
              {filteredEvents.map((item) => (
                <Pressable
                  key={`e-${item.id}`}
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
                        type: item.type ?? "",
                      },
                    })
                  }
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {!!item.type && <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{item.type}</Text></View>}
                  </View>
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
              ))}
              {filteredBubbles.map((item) => (
                <Pressable
                  key={`b-${item.id}`}
                  style={({ pressed }) => [styles.card, styles.bubbleCard, pressed && styles.cardPressed]}
                  onPress={() => router.push({ pathname: "/bubble-detail", params: { id: item.id } })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <View style={styles.bubbleBadge}><Text style={styles.bubbleBadgeText}>Bubble</Text></View>
                  </View>
                  {!!item.description && (
                    <Text style={styles.cardValue} numberOfLines={1}>{item.description}</Text>
                  )}
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Members</Text>
                    <Text style={styles.cardValue}>{item.members.length}</Text>
                  </View>
                  <Text style={styles.createdBy}>by {item.createdBy}</Text>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      </Animated.View>

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

  // Filter chips
  filterBar: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
  },
  filterRow: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    backgroundColor: "rgba(18,3,3,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipRedOn: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
  },
  chipPurpleOn: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  chipText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextOn: {
    color: "#fff",
  },

  // Cluster badge
  clusterBubble: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  clusterText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },

  // Legend
  legend: {
    position: "absolute",
    top: 100,
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
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.85)",
  },
  newEventBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  newEventBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
    marginTop: 8,
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
  bubbleCard: {
    borderColor: "rgba(124,58,237,0.4)",
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
  typeBadge: {
    backgroundColor: "rgba(220,38,38,0.15)", borderRadius: 6,
    borderWidth: 1, borderColor: "rgba(220,38,38,0.3)",
    paddingHorizontal: 6, paddingVertical: 2,
  },
  typeBadgeText: { color: "#dc2626", fontSize: 10, fontWeight: "700" },
  bubbleBadge: {
    backgroundColor: "rgba(124,58,237,0.15)", borderRadius: 6,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
    paddingHorizontal: 6, paddingVertical: 2,
  },
  bubbleBadgeText: { color: "#a78bfa", fontSize: 10, fontWeight: "700" },
});

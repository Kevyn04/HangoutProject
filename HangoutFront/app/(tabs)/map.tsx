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
  TextInput,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { getEvents } from "@/services/api";
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

type Event = {
  id: number;
  title: string;
  location: string;
  time: string;
  createdBy: string;
  latitude?: number;
  longitude?: number;
  type?: string | null;
};


export default function MapScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { showToast } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
      const eventsData = await getEvents();
      setEvents(eventsData);
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
  const filteredEvents = q
    ? events.filter((e) => e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q))
    : events;
  const eventMarkers = filteredEvents.filter((e) => e.latitude != null && e.longitude != null);

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
      </MapView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#dc2626" }]} />
          <Text style={styles.legendText}>Events</Text>
        </View>
      </View>

      {/* Events bottom sheet */}
      <Animated.View
        style={[styles.sheet, { height: SHEET_MAX_H, transform: [{ translateY }] }]}
      >
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Events Nearby</Text>
            <Pressable style={styles.newEventBtn} onPress={() => router.push("/create")}>
              <Text style={styles.newEventBtnText}>+ New</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search events…"
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
          ) : filteredEvents.length === 0 ? (
            <Text style={styles.emptyText}>No events nearby yet.</Text>
          ) : (
            filteredEvents.map((item) => (
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
            ))
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
});

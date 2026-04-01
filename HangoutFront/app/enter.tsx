import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useFonts, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { getEvents } from "@/services/api";
import * as Location from "expo-location";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.75;
const SHEET_MIN_H = 240;
const COLLAPSED_Y = SHEET_MAX_H - SHEET_MIN_H;

type Event = {
  id: number;
  title: string;
  location: string;
  time: string;
  createdBy: string;
  latitude?: number;
  longitude?: number;
};

function getDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function EnterScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"loading" | "granted" | "denied">("loading");

  const [fontsLoaded] = useFonts({ Cinzel_700Bold });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocStatus("denied");
        return;
      }
      setLocStatus("granted");
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

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

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (e) {
      console.error("Failed to load events:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      {/* Map placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapBg}>
          {/* Grid lines to suggest a map */}
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={`h${i}`}
              style={[
                styles.gridLineH,
                { top: ((i + 1) / 9) * SCREEN_H },
              ]}
            />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <View
              key={`v${i}`}
              style={[
                styles.gridLineV,
                { left: ((i + 1) / 6) * SCREEN_W },
              ]}
            />
          ))}
          {/* Center marker */}
          <View style={styles.markerWrap}>
            <View style={styles.marker} />
            <View style={styles.markerDot} />
          </View>
          {locStatus === "loading" ? (
            <View style={styles.coordsWrap}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
              <Text style={styles.mapLabel}>Locating you...</Text>
            </View>
          ) : locStatus === "denied" ? (
            <View style={styles.coordsWrap}>
              <Text style={styles.mapLabel}>Location permission denied</Text>
            </View>
          ) : userCoords ? (
            <View style={styles.coordsWrap}>
              <Text style={styles.coordsText}>
                {userCoords.latitude.toFixed(4)}, {userCoords.longitude.toFixed(4)}
              </Text>
              <Text style={styles.mapLabel}>Your Location</Text>
            </View>
          ) : (
            <View style={styles.coordsWrap}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
              <Text style={styles.mapLabel}>Getting coordinates...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { height: SHEET_MAX_H, transform: [{ translateY }] },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <View style={styles.handle} />
        </View>

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Events Nearby</Text>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetList}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="large" color="white" style={{ marginTop: 30 }} />
          ) : events.length === 0 ? (
            <Text style={styles.emptyText}>No events nearby yet.</Text>
          ) : (
            [...events]
              .sort((a, b) => {
                if (!userCoords) return 0;
                const dA = a.latitude != null && a.longitude != null
                  ? getDistanceKm(userCoords.latitude, userCoords.longitude, a.latitude, a.longitude)
                  : Infinity;
                const dB = b.latitude != null && b.longitude != null
                  ? getDistanceKm(userCoords.latitude, userCoords.longitude, b.latitude, b.longitude)
                  : Infinity;
                return dA - dB;
              })
              .map((item) => {
                const dist =
                  userCoords && item.latitude != null && item.longitude != null
                    ? getDistanceKm(userCoords.latitude, userCoords.longitude, item.latitude, item.longitude)
                    : null;
                return (
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
                <View style={styles.cardFooter}>
                  <Text style={styles.createdBy}>by {item.createdBy}</Text>
                  {dist != null && (
                    <Text style={styles.distText}>
                      {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                    </Text>
                  )}
                </View>
              </Pressable>
                );
              })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1117",
  },

  // Map placeholder
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  mapBg: {
    flex: 1,
    backgroundColor: "#131a24",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  markerWrap: {
    position: "absolute",
    top: "35%",
    left: "50%",
    alignItems: "center",
    marginLeft: -16,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#dc2626",
    backgroundColor: "rgba(220,38,38,0.2)",
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#dc2626",
    marginTop: -20,
  },
  coordsWrap: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
  },
  coordsText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
    fontFamily: "Cinzel_700Bold",
  },
  mapLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.2)",
    letterSpacing: 2,
  },

  // Sheet
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
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.85)",
  },
  sheetScroll: {
    flex: 1,
  },
  sheetList: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  // Cards (same style as home screen)
  card: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    marginBottom: 14,
    gap: 6,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 1,
  },
  cardValue: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  createdBy: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    fontStyle: "italic",
  },
  distText: {
    fontSize: 12,
    color: "rgba(220,38,38,0.7)",
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    paddingVertical: 20,
  },
});

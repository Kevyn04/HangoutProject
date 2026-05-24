import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { getEvents, getBubbles, joinBubble } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import { AppColors } from "@/constants/theme";

// ── Leaflet setup ─────────────────────────────────────────────────────────────
// Load CSS from CDN so Metro doesn't need to bundle it
function useLeafletCSS() {
  useEffect(() => {
    const id = "leaflet-css";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }, []);
}

// Fix default marker icons broken by bundlers
function fixLeafletIcons() {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}
fixLeafletIcons();

// Custom marker icons
const eventIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function bubbleIcon(initial: string, isSecret: boolean) {
  const bg = isSecret ? "#374151" : "#7c3aed";
  return L.divIcon({
    className: "",
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${bg};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.5)">${isSecret ? "🔒" : initial}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Event = {
  id: number; title: string; location: string;
  time: string; createdBy: string;
  latitude?: number; longitude?: number;
};

type Bubble = {
  id: number; name: string; description?: string; createdBy: string;
  type?: string; meetTime?: string; members: string[];
  latitude?: number; longitude?: number;
  isSecret?: boolean; revealAt?: string;
};

// Keeps map centered on Bloomsburg
const BLOOMSBURG: [number, number] = [41.0026, -76.4547];

function RecenterOnLoad() {
  const map = useMap();
  useEffect(() => { map.setView(BLOOMSBURG, 14); }, [map]);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MapWebScreen() {
  useLeafletCSS();

  const router = useRouter();
  const { user } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinedIds, setJoinedIds] = useState<Set<number>>(new Set());

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

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleJoin = async () => {
    if (!selectedBubble) return;
    const username = user ?? "Guest";
    setJoining(true);
    try {
      const updated = await joinBubble(selectedBubble.id, username);
      setBubbles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setJoinedIds((prev) => new Set(prev).add(selectedBubble.id));
      setSelectedBubble(updated);
    } catch (e) {
      console.error("Failed to join bubble:", e);
    } finally {
      setJoining(false);
    }
  };

  const eventMarkers  = events.filter((e) => e.latitude != null && e.longitude != null);
  const bubbleMarkers = bubbles.filter((b) => b.latitude != null && b.longitude != null);

  const alreadyJoined = selectedBubble
    ? joinedIds.has(selectedBubble.id) || (user != null && selectedBubble.members.includes(user))
    : false;

  return (
    <View style={styles.container}>
      {/* ── Left: Map ── */}
      <View style={styles.mapContainer}>
        <MapContainer
          center={BLOOMSBURG}
          zoom={14}
          style={{ width: "100%", height: "100%" }}
          zoomControl
        >
          <RecenterOnLoad />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Event markers */}
          {eventMarkers.map((ev) => (
            <Marker key={`event-${ev.id}`} position={[ev.latitude!, ev.longitude!]} icon={eventIcon}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong style={{ fontSize: 14 }}>{ev.title}</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>📍 {ev.location}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#555" }}>🕐 {ev.time}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888" }}>by {ev.createdBy}</p>
                  <button
                    onClick={() => router.push({ pathname: "/event-details", params: { id: ev.id, title: ev.title, location: ev.location, time: ev.time, createdBy: ev.createdBy } })}
                    style={{ marginTop: 8, padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Bubble markers */}
          {bubbleMarkers.map((b) => {
            const stillSecret = b.isSecret && b.revealAt && new Date(b.revealAt) > new Date();
            return (
              <Marker
                key={`bubble-${b.id}`}
                position={[b.latitude!, b.longitude!]}
                icon={bubbleIcon(b.name.charAt(0).toUpperCase(), !!stillSecret)}
                eventHandlers={{ click: () => setSelectedBubble(b) }}
              >
                <Popup>
                  <strong style={{ fontSize: 13 }}>{stillSecret ? "Secret Bubble" : b.name}</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
                    {b.members.length} member{b.members.length !== 1 ? "s" : ""}
                  </p>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Legend overlay */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: AppColors.red }]} />
            <Text style={styles.legendText}>Events</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: AppColors.purple }]} />
            <Text style={styles.legendText}>Bubbles</Text>
          </View>
        </View>
      </View>

      {/* ── Right: Events sidebar ── */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Events Nearby</Text>
          <Pressable
            style={styles.createBtn}
            onPress={() => router.push("/create")}
            accessibilityLabel="Create a new hangout event"
            accessibilityRole="button"
          >
            <Text style={styles.createBtnText}>+ New</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color="white" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            style={styles.sidebarScroll}
            contentContainerStyle={styles.sidebarList}
            showsVerticalScrollIndicator={false}
          >
            {events.length === 0 ? (
              <Text style={styles.emptyText}>No events yet. Create the first one!</Text>
            ) : (
              events.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => router.push({ pathname: "/event-details", params: { id: item.id, title: item.title, location: item.location, time: item.time, createdBy: item.createdBy } })}
                  accessibilityLabel={`View details for ${item.title}`}
                  accessibilityRole="button"
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
                  <Text style={styles.cardBy}>by {item.createdBy}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        {/* Bubble detail panel — shown when a bubble is selected */}
        {selectedBubble && (() => {
          const stillSecret = selectedBubble.isSecret && selectedBubble.revealAt && new Date(selectedBubble.revealAt) > new Date();
          const revealTime = selectedBubble.revealAt
            ? new Date(selectedBubble.revealAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;
          return (
            <View style={styles.bubblePanel}>
              <View style={styles.bubblePanelHeader}>
                <View style={[styles.bubbleAvatar, stillSecret && styles.bubbleAvatarSecret]}>
                  <Text style={styles.bubbleAvatarText}>
                    {stillSecret ? "🔒" : selectedBubble.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bubbleName}>{selectedBubble.name}</Text>
                  <Text style={styles.bubbleMeta}>
                    {selectedBubble.members.length} member{selectedBubble.members.length !== 1 ? "s" : ""} · by {selectedBubble.createdBy}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedBubble(null)} accessibilityLabel="Close bubble panel" accessibilityRole="button">
                  <Text style={styles.closeBtn}>✕</Text>
                </Pressable>
              </View>

              {selectedBubble.type && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{selectedBubble.type}</Text>
                </View>
              )}

              {stillSecret && revealTime && (
                <Text style={styles.secretNote}>🔒 Location revealed at {revealTime}</Text>
              )}

              {selectedBubble.description ? (
                <Text style={styles.bubbleDesc}>{selectedBubble.description}</Text>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.joinBtn, alreadyJoined && styles.joinBtnJoined, pressed && { opacity: 0.8 }]}
                onPress={alreadyJoined ? undefined : handleJoin}
                disabled={joining || alreadyJoined}
                accessibilityLabel={alreadyJoined ? "Already joined this bubble" : "Join this bubble"}
                accessibilityRole="button"
              >
                {joining
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.joinBtnText}>{alreadyJoined ? "Already Joined" : "Join Bubble"}</Text>
                }
              </Pressable>
            </View>
          );
        })()}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, flexDirection: "row", backgroundColor: AppColors.bgBase },
  mapContainer:  { flex: 1, position: "relative" },

  legend: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(18,3,3,0.88)",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.borderFaint,
    zIndex: 1000,
  },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { color: "rgba(255,255,255,0.75)", fontSize: 12 },

  // Sidebar
  sidebar: {
    width: 320,
    backgroundColor: AppColors.bgMid,
    borderLeftWidth: 1,
    borderLeftColor: AppColors.borderFaint,
    flexDirection: "column",
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderFaint,
  },
  sidebarTitle: { fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.9)", letterSpacing: 0.5 },
  createBtn: {
    backgroundColor: AppColors.red,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  createBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sidebarScroll: { flex: 1 },
  sidebarList:   { padding: 12, gap: 10 },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    textAlign: "center",
    paddingTop: 30,
    lineHeight: 20,
  },

  // Event cards
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.card,
    gap: 5,
  },
  cardPressed:  { opacity: 0.7 },
  cardTitle:    { fontSize: 15, fontWeight: "700", color: "#fff" },
  cardRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel:    { fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 0.5 },
  cardValue:    { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  cardBy:       { fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic", marginTop: 2 },

  // Bubble panel
  bubblePanel: {
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.3)",
    backgroundColor: "rgba(18,3,3,0.95)",
    padding: 16,
    gap: 10,
  },
  bubblePanelHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  bubbleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleAvatarSecret: { backgroundColor: "#374151" },
  bubbleAvatarText:   { color: "#fff", fontSize: 18, fontWeight: "700" },
  bubbleName:  { color: "#fff", fontSize: 16, fontWeight: "700" },
  bubbleMeta:  { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 1 },
  closeBtn:    { color: "rgba(255,255,255,0.4)", fontSize: 18, padding: 4 },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(124,58,237,0.25)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { color: "#c4b5fd", fontSize: 12, fontWeight: "600" },
  secretNote:    { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  bubbleDesc:    { color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 18 },
  joinBtn: {
    backgroundColor: AppColors.purple,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnJoined: { backgroundColor: "rgba(124,58,237,0.3)" },
  joinBtnText:   { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
});

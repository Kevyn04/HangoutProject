import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { getEvents, getBubbles, joinBubble } from "@/services/api";
import { useAuth } from "@/services/auth-context";
import { AppColors } from "@/constants/theme";

// Leaflet is loaded from CDN at runtime — no static import so Metro never bundles it
type L = typeof import("leaflet");

const BLOOMSBURG: [number, number] = [41.0026, -76.4547];
const MAP_ID = "hangout-web-map";

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

// ── CDN loader ────────────────────────────────────────────────────────────────
function loadLeaflet(cb: () => void) {
  if ((window as any).L) { cb(); return; }

  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  if (!document.getElementById("leaflet-js")) {
    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = cb;
    document.head.appendChild(script);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapWebScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinedIds, setJoinedIds] = useState<Set<number>>(new Set());
  const [mapReady, setMapReady] = useState(false);

  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Load events + bubbles
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ev, bu] = await Promise.all([getEvents(), getBubbles()]);
      setEvents(ev);
      setBubbles(bu);
    } catch (e) {
      console.error("Map data load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Init Leaflet map from CDN
  useEffect(() => {
    loadLeaflet(() => {
      const container = document.getElementById(MAP_ID);
      if (!container || leafletMapRef.current) return;

      const Lf = (window as any).L as L;

      // Fix broken default marker icons (common in bundlers)
      delete (Lf.Icon.Default.prototype as any)._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = Lf.map(container).setView(BLOOMSBURG, 14);
      Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      leafletMapRef.current = map;
      setMapReady(true);
    });

    return () => {
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Sync markers whenever data or map changes
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;
    const Lf = (window as any).L as L;
    const map = leafletMapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const eventIcon = Lf.divIcon({
      className: "",
      html: '<div style="width:12px;height:12px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    events
      .filter((e) => e.latitude != null && e.longitude != null)
      .forEach((ev) => {
        const m = Lf.marker([ev.latitude!, ev.longitude!], { icon: eventIcon }).addTo(map);
        m.bindPopup(
          `<div style="min-width:140px"><b style="font-size:13px">${ev.title}</b>` +
          `<p style="margin:4px 0 0;font-size:12px;color:#555">📍 ${ev.location}</p>` +
          `<p style="margin:2px 0 0;font-size:12px;color:#555">🕐 ${ev.time}</p>` +
          `<p style="margin:2px 0 0;font-size:11px;color:#888">by ${ev.createdBy}</p></div>`
        );
        markersRef.current.push(m);
      });

    bubbles
      .filter((b) => b.latitude != null && b.longitude != null)
      .forEach((b) => {
        const isSecret = b.isSecret && b.revealAt && new Date(b.revealAt) > new Date();
        const bg = isSecret ? "#374151" : "#7c3aed";
        const label = isSecret ? "🔒" : b.name.charAt(0).toUpperCase();
        const icon = Lf.divIcon({
          className: "",
          html: `<div style="width:34px;height:34px;border-radius:50%;background:${bg};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${label}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        });
        const m = Lf.marker([b.latitude!, b.longitude!], { icon }).addTo(map);
        m.on("click", () => setSelectedBubble(b));
        markersRef.current.push(m);
      });
  }, [events, bubbles, mapReady]);

  const handleJoin = async () => {
    if (!selectedBubble) return;
    setJoining(true);
    try {
      const updated = await joinBubble(selectedBubble.id, user ?? "Guest");
      setBubbles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setJoinedIds((prev) => new Set(prev).add(selectedBubble.id));
      setSelectedBubble(updated);
    } catch (e) {
      console.error("Join failed:", e);
    } finally {
      setJoining(false);
    }
  };

  const alreadyJoined = selectedBubble
    ? joinedIds.has(selectedBubble.id) || (user != null && selectedBubble.members.includes(user))
    : false;

  return (
    <View style={styles.root}>
      {/* ── Map ── */}
      <View style={styles.mapWrap}>
        {/* nativeID maps to the HTML id attribute in React Native Web */}
        <View nativeID={MAP_ID} style={StyleSheet.absoluteFill} />

        <View style={styles.legend} pointerEvents="none">
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: AppColors.red }]} />
            <Text style={styles.legendText}>Events</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: AppColors.purple }]} />
            <Text style={styles.legendText}>Bubbles</Text>
          </View>
        </View>
      </View>

      {/* ── Sidebar ── */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHead}>
          <Text style={styles.sidebarTitle}>Events Nearby</Text>
          <Pressable
            style={styles.newBtn}
            onPress={() => router.push("/create")}
            accessibilityLabel="Create a new hangout"
            accessibilityRole="button"
          >
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color="white" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.eventList} showsVerticalScrollIndicator={false}>
            {events.length === 0 ? (
              <Text style={styles.emptyText}>No events yet. Create the first one!</Text>
            ) : (
              events.map((ev) => (
                <Pressable
                  key={ev.id}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push({ pathname: "/event-details", params: { id: ev.id, title: ev.title, location: ev.location, time: ev.time, createdBy: ev.createdBy } })}
                  accessibilityLabel={`View details for ${ev.title}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.cardTitle}>{ev.title}</Text>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Location</Text>
                    <Text style={styles.cardValue}>{ev.location}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Time</Text>
                    <Text style={styles.cardValue}>{ev.time}</Text>
                  </View>
                  <Text style={styles.cardBy}>by {ev.createdBy}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        {/* Bubble detail panel */}
        {selectedBubble && (() => {
          const isSecret = selectedBubble.isSecret && selectedBubble.revealAt && new Date(selectedBubble.revealAt) > new Date();
          return (
            <View style={styles.bubblePanel}>
              <View style={styles.bubbleRow}>
                <View style={[styles.bubbleAvatar, isSecret && styles.bubbleAvatarSecret]}>
                  <Text style={styles.bubbleAvatarText}>
                    {isSecret ? "🔒" : selectedBubble.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bubbleName}>{selectedBubble.name}</Text>
                  <Text style={styles.bubbleMeta}>
                    {selectedBubble.members.length} member{selectedBubble.members.length !== 1 ? "s" : ""} · by {selectedBubble.createdBy}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedBubble(null)} accessibilityLabel="Close" accessibilityRole="button">
                  <Text style={styles.closeBtn}>✕</Text>
                </Pressable>
              </View>

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

const styles = StyleSheet.create({
  root:       { flex: 1, flexDirection: "row", backgroundColor: AppColors.bgBase },
  mapWrap:    { flex: 1, position: "relative" },

  legend: {
    position: "absolute", top: 12, right: 12, zIndex: 1000,
    backgroundColor: "rgba(18,3,3,0.88)",
    borderRadius: 10, padding: 10, gap: 6,
    borderWidth: 1, borderColor: AppColors.borderFaint,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "rgba(255,255,255,0.75)", fontSize: 12 },

  sidebar: {
    width: 320,
    backgroundColor: AppColors.bgMid,
    borderLeftWidth: 1, borderLeftColor: AppColors.borderFaint,
  },
  sidebarHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: AppColors.borderFaint,
  },
  sidebarTitle: { fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.9)", letterSpacing: 0.5 },
  newBtn:       { backgroundColor: AppColors.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  newBtnText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  eventList:    { padding: 12, gap: 10 },
  emptyText:    { color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", paddingTop: 30, lineHeight: 20 },

  card: {
    padding: 14, borderRadius: 12, gap: 5,
    borderWidth: 1, borderColor: AppColors.border,
    backgroundColor: AppColors.card,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  cardRow:   { flexDirection: "row", justifyContent: "space-between" },
  cardLabel: { fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 0.5 },
  cardValue: { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  cardBy:    { fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic", marginTop: 2 },

  bubblePanel: {
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.3)",
    backgroundColor: "rgba(18,3,3,0.95)", padding: 16, gap: 10,
  },
  bubbleRow:         { flexDirection: "row", alignItems: "center", gap: 12 },
  bubbleAvatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: AppColors.purple, alignItems: "center", justifyContent: "center" },
  bubbleAvatarSecret:{ backgroundColor: "#374151" },
  bubbleAvatarText:  { color: "#fff", fontSize: 18, fontWeight: "700" },
  bubbleName:        { color: "#fff", fontSize: 16, fontWeight: "700" },
  bubbleMeta:        { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 1 },
  closeBtn:          { color: "rgba(255,255,255,0.4)", fontSize: 18, padding: 4 },
  bubbleDesc:        { color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 18 },
  joinBtn:           { backgroundColor: AppColors.purple, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  joinBtnJoined:     { backgroundColor: "rgba(124,58,237,0.3)" },
  joinBtnText:       { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
});

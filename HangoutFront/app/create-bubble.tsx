import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { createBubble } from "@/services/api";
import { useAuth } from "@/services/auth-context";

// ── Constants ────────────────────────────────────────────────────────
const BLOOMSBURG_REGION = {
  latitude: 41.0026,
  longitude: -76.4547,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const BUBBLE_TYPES = [
  "Hangout", "Party", "Study Group", "Sports", "Food & Drinks",
  "Gaming", "Music", "Outdoor", "Art", "Other",
];

const REVEAL_OPTIONS: { label: string; ms: number }[] = [
  { label: "30 min", ms: 30 * 60_000 },
  { label: "1 hr",  ms: 60 * 60_000 },
  { label: "2 hr",  ms: 2 * 60 * 60_000 },
  { label: "6 hr",  ms: 6 * 60 * 60_000 },
  { label: "12 hr", ms: 12 * 60 * 60_000 },
  { label: "24 hr", ms: 24 * 60 * 60_000 },
];

type LocationMode = "none" | "gps" | "address" | "map";

// ── Time picker ──────────────────────────────────────────────────────
const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

const ITEM_H = 48;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

function ScrollColumn({
  items, initialIndex = 0, onChange, width = 64,
}: {
  items: string[]; initialIndex?: number; onChange: (v: string) => void; width?: number;
}) {
  const selectedRef = useRef(initialIndex);
  const padded = ["", "", ...items, "", ""];

  const onEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      selectedRef.current = clamped;
      onChange(items[clamped]);
    },
    [items, onChange]
  );

  return (
    <View style={[col.wrap, { width }]}>
      <View style={col.highlight} pointerEvents="none" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: initialIndex * ITEM_H }}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        style={{ height: ITEM_H * VISIBLE }}
      >
        {padded.map((item, i) => {
          const isSelected = i - PAD === selectedRef.current;
          return (
            <View key={i} style={col.item}>
              <Text style={[col.text, isSelected && col.selected, !item && { opacity: 0 }]}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const col = StyleSheet.create({
  wrap:      { alignItems: "center", overflow: "hidden" },
  highlight: {
    position: "absolute", top: ITEM_H * PAD, left: 0, right: 0, height: ITEM_H,
    backgroundColor: "rgba(220,38,38,0.15)",
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(220,38,38,0.4)",
    borderRadius: 8, zIndex: 1,
  },
  item:     { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  text:     { fontSize: 20, color: "rgba(255,255,255,0.3)", fontWeight: "500" },
  selected: { color: "#fff", fontSize: 22, fontWeight: "700" },
});

// ── Map Picker Modal ─────────────────────────────────────────────────
type Coord = { latitude: number; longitude: number };

function MapPickerModal({
  visible, initialCoord, onConfirm, onClose,
}: {
  visible: boolean; initialCoord?: Coord;
  onConfirm: (c: Coord) => void; onClose: () => void;
}) {
  const [pin, setPin] = useState<Coord | null>(initialCoord ?? null);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={mp.container}>
        {/* Header */}
        <View style={mp.header}>
          <Pressable onPress={onClose} style={mp.headerBtn} accessibilityLabel="Cancel location picker" accessibilityRole="button">
            <Text style={mp.headerBtnText}>Cancel</Text>
          </Pressable>
          <Text style={mp.headerTitle}>Pick Location</Text>
          <View style={mp.headerBtn} />
        </View>

        {/* Map */}
        <MapView
          style={{ flex: 1 }}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={
            initialCoord
              ? { ...initialCoord, latitudeDelta: 0.01, longitudeDelta: 0.01 }
              : BLOOMSBURG_REGION
          }
          onPress={(e) => setPin(e.nativeEvent.coordinate)}
        >
          {pin && <Marker coordinate={pin} pinColor="#dc2626" />}
        </MapView>

        {/* Footer */}
        <View style={mp.footer}>
          <Text style={mp.footerHint}>
            {pin ? `📍 ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}` : "Tap the map to place a pin"}
          </Text>
          <Pressable
            style={[mp.confirmBtn, !pin && mp.confirmBtnDisabled]}
            onPress={() => { if (pin) { onConfirm(pin); onClose(); } }}
            disabled={!pin}
            accessibilityLabel="Confirm selected location"
            accessibilityRole="button"
          >
            <Text style={mp.confirmBtnText}>Confirm Location</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const mp = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#0f0305" },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: "#0f0305" },
  headerBtn:        { width: 70 },
  headerBtnText:    { color: "#dc2626", fontSize: 16 },
  headerTitle:      { color: "#fff", fontSize: 16, fontWeight: "700" },
  footer:           { backgroundColor: "#1a0808", padding: 20, paddingBottom: 36, gap: 12, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  footerHint:       { color: "rgba(255,255,255,0.55)", fontSize: 13, textAlign: "center" },
  confirmBtn:       { backgroundColor: "#dc2626", borderRadius: 14, height: 48, alignItems: "center", justifyContent: "center" },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText:   { color: "#fff", fontSize: 15, fontWeight: "700" },
});

// ── Main Screen ──────────────────────────────────────────────────────
export default function CreateBubbleScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Core fields
  const [name, setName]               = useState("");
  const [type, setType]               = useState("Hangout");
  const [hour, setHour]               = useState("12");
  const [minute, setMinute]           = useState("00");
  const [period, setPeriod]           = useState("PM");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers]   = useState("");

  // Location
  const [locationMode, setLocationMode] = useState<LocationMode>("none");
  const [latitude, setLatitude]         = useState<number | null>(null);
  const [longitude, setLongitude]       = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [suggestions, setSuggestions]   = useState<{ label: string; lat: number; lon: number }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gpsLoading, setGpsLoading]     = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);

  // Secret location
  const [isSecret, setIsSecret]         = useState(false);
  const [revealIndex, setRevealIndex]   = useState(1); // default "1 hr"

  const [saving, setSaving] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission denied", "Location permission is required."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setLocationMode("gps");
    } catch { Alert.alert("Error", "Could not get location."); }
    finally { setGpsLoading(false); }
  };

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`,
        { headers: { "User-Agent": "HangoutApp/1.0" } }
      );
      const data = await res.json();
      setSuggestions(
        data.map((r: any) => ({
          label: r.display_name as string,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
        }))
      );
    } catch { setSuggestions([]); }
  }, []);

  const handleAddressChange = useCallback((v: string) => {
    setAddressInput(v);
    setAddressError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length >= 3) {
      debounceRef.current = setTimeout(() => fetchSuggestions(v.trim()), 420);
    } else {
      setSuggestions([]);
    }
  }, [fetchSuggestions]);

  const pickSuggestion = useCallback((sug: { label: string; lat: number; lon: number }) => {
    setAddressInput(sug.label);
    setLatitude(sug.lat);
    setLongitude(sug.lon);
    setLocationMode("address");
    setSuggestions([]);
  }, []);

  const handleAddressSearch = async () => {
    if (!addressInput.trim()) return;
    setAddressLoading(true);
    setAddressError("");
    try {
      const results = await Location.geocodeAsync(addressInput.trim());
      if (results.length > 0) {
        setLatitude(results[0].latitude);
        setLongitude(results[0].longitude);
        setLocationMode("address");
      } else {
        setAddressError("Address not found — place a pin manually.");
        setMapPickerVisible(true);
      }
    } catch {
      setAddressError("Search failed — place a pin manually.");
      setMapPickerVisible(true);
    } finally { setAddressLoading(false); }
  };

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert("Name required", "Please give your bubble a name."); return; }
    setSaving(true);
    try {
      let revealAt: string | undefined;
      if (isSecret) {
        revealAt = new Date(Date.now() + REVEAL_OPTIONS[revealIndex].ms).toISOString();
      }
      await createBubble({
        name: name.trim(),
        type,
        meetTime: `${hour}:${minute} ${period}`,
        description: description.trim() || undefined,
        maxMembers: maxMembers ? parseInt(maxMembers, 10) : undefined,
        createdBy: user ?? "Guest",
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        isSecret: isSecret || undefined,
        revealAt,
      });
      router.back();
    } catch { Alert.alert("Error", "Failed to create bubble. Is the server running?"); }
    finally { setSaving(false); }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Text style={s.label}>Bubble Name *</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Downtown Crew"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={name}
          onChangeText={setName}
        />

        {/* Type */}
        <Text style={s.label}>Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {BUBBLE_TYPES.map((t) => (
            <Pressable key={t} style={[s.chip, type === t && s.chipActive]} onPress={() => setType(t)}>
              <Text style={[s.chipText, type === t && s.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Time */}
        <Text style={s.label}>Meet Time</Text>
        <View style={s.pickerCard}>
          <ScrollColumn items={HOURS}   initialIndex={11} onChange={setHour}   width={60} />
          <Text style={s.colon}>:</Text>
          <ScrollColumn items={MINUTES} initialIndex={0}  onChange={setMinute} width={60} />
          <ScrollColumn items={PERIODS} initialIndex={1}  onChange={setPeriod} width={56} />
        </View>

        {/* Location */}
        <Text style={s.label}>Location</Text>
        <View style={s.locModeRow}>
          {/* GPS */}
          <Pressable
            style={[s.locModeBtn, locationMode === "gps" && s.locModeBtnActive]}
            onPress={handleGPS}
            disabled={gpsLoading}
            accessibilityLabel="Use GPS to get current location"
            accessibilityRole="button"
          >
            {gpsLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[s.locModeBtnText, locationMode === "gps" && s.locModeBtnTextActive]}>📍 GPS</Text>
            }
          </Pressable>

          {/* Address */}
          <Pressable
            style={[s.locModeBtn, locationMode === "address" && s.locModeBtnActive]}
            onPress={() => setLocationMode("address")}
            accessibilityLabel="Search location by address"
            accessibilityRole="button"
          >
            <Text style={[s.locModeBtnText, locationMode === "address" && s.locModeBtnTextActive]}>🔍 Address</Text>
          </Pressable>

          {/* Map pin */}
          <Pressable
            style={[s.locModeBtn, locationMode === "map" && s.locModeBtnActive]}
            onPress={() => setMapPickerVisible(true)}
            accessibilityLabel="Place a pin on the map"
            accessibilityRole="button"
          >
            <Text style={[s.locModeBtnText, locationMode === "map" && s.locModeBtnTextActive]}>🗺 Pin</Text>
          </Pressable>
        </View>

        {/* Address input + autocomplete */}
        {locationMode === "address" && (
          <View>
            <View style={s.addressRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="123 Main St, Bloomsburg PA"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={addressInput}
                onChangeText={handleAddressChange}
                onSubmitEditing={handleAddressSearch}
                returnKeyType="search"
                autoCorrect={false}
              />
              <Pressable style={s.searchBtn} onPress={handleAddressSearch} disabled={addressLoading}>
                {addressLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.searchBtnText}>Search</Text>
                }
              </Pressable>
            </View>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <View style={s.suggestionsBox}>
                {suggestions.map((sug, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [
                      s.suggestionItem,
                      i < suggestions.length - 1 && s.suggestionDivider,
                      pressed && s.suggestionPressed,
                    ]}
                    onPress={() => pickSuggestion(sug)}
                  >
                    <Text style={s.suggestionText} numberOfLines={2}>{sug.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
        {addressError ? <Text style={s.addressError}>{addressError}</Text> : null}

        {/* Coord confirmation */}
        {latitude != null && (
          <View style={s.coordPill}>
            <Text style={s.coordPillText}>
              📍 {latitude.toFixed(5)}, {longitude!.toFixed(5)}
            </Text>
            <Pressable onPress={() => { setLatitude(null); setLongitude(null); setLocationMode("none"); }}>
              <Text style={s.coordClear}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Secret location */}
        <View style={s.secretRow}>
          <View>
            <Text style={s.secretLabel}>Secret Location</Text>
            <Text style={s.secretSub}>Hide location until a timer reveals it</Text>
          </View>
          <Pressable
            style={[s.toggle, isSecret && s.toggleOn]}
            onPress={() => setIsSecret((v) => !v)}
          >
            <View style={[s.toggleThumb, isSecret && s.toggleThumbOn]} />
          </Pressable>
        </View>

        {isSecret && (
          <>
            <Text style={s.label}>Reveal Location In</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {REVEAL_OPTIONS.map((opt, i) => (
                <Pressable
                  key={opt.label}
                  style={[s.chip, s.chipPurple, revealIndex === i && s.chipPurpleActive]}
                  onPress={() => setRevealIndex(i)}
                >
                  <Text style={[s.chipText, revealIndex === i && s.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Max members */}
        <Text style={s.label}>Max Members (optional)</Text>
        <TextInput
          style={s.input}
          placeholder="Leave blank for unlimited"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={maxMembers}
          onChangeText={(v) => setMaxMembers(v.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
        />

        {/* Description */}
        <Text style={s.label}>Details (optional)</Text>
        <TextInput
          style={[s.input, s.inputMulti]}
          placeholder="What's this bubble about? Where exactly? Bring anything?"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Create */}
        <Pressable
          style={({ pressed }) => [s.createBtn, pressed && { opacity: 0.8 }]}
          onPress={handleCreate}
          disabled={saving}
          accessibilityLabel="Create bubble"
          accessibilityRole="button"
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.createBtnText}>Create Bubble</Text>
          }
        </Pressable>
      </ScrollView>

      {/* Map picker modal */}
      <MapPickerModal
        visible={mapPickerVisible}
        initialCoord={latitude != null ? { latitude, longitude: longitude! } : undefined}
        onConfirm={(coord) => {
          setLatitude(coord.latitude);
          setLongitude(coord.longitude);
          setLocationMode("map");
        }}
        onClose={() => setMapPickerVisible(false)}
      />
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0305" },
  content:   { padding: 20, paddingBottom: 48, gap: 8 },

  label: {
    color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: 1.3,
    fontWeight: "600", marginTop: 16, marginBottom: 6, textTransform: "uppercase",
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 16,
  },
  inputMulti: { minHeight: 100, paddingTop: 14 },

  // Type chips
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.05)",
  },
  chipActive:       { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  chipPurple:       { borderColor: "rgba(124,58,237,0.4)" },
  chipPurpleActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText:         { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  chipTextActive:   { color: "#fff" },

  // Time picker
  pickerCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)", borderRadius: 16, paddingVertical: 8, gap: 4,
  },
  colon: { color: "rgba(255,255,255,0.5)", fontSize: 26, fontWeight: "700", marginBottom: 4 },

  // Location mode buttons
  locModeRow: { flexDirection: "row", gap: 8 },
  locModeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)",
  },
  locModeBtnActive:    { borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.15)" },
  locModeBtnText:      { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  locModeBtnTextActive:{ color: "#fff" },

  // Address row
  addressRow:    { flexDirection: "row", gap: 8, marginTop: 8 },
  searchBtn:     {
    backgroundColor: "#dc2626", borderRadius: 12,
    paddingHorizontal: 16, alignItems: "center", justifyContent: "center",
  },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  addressError:  { color: "rgba(220,38,38,0.8)", fontSize: 12, marginTop: 4 },

  // Autocomplete suggestions
  suggestionsBox: {
    backgroundColor: "#1a0808",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    marginTop: 4,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  suggestionPressed: {
    backgroundColor: "rgba(220,38,38,0.12)",
  },
  suggestionText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 18,
  },

  // Coord pill
  coordPill: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(220,38,38,0.12)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
  },
  coordPillText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  coordClear:    { color: "rgba(255,255,255,0.4)", fontSize: 16, paddingLeft: 8 },

  // Secret toggle
  secretRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 20, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14, padding: 16,
  },
  secretLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secretSub:   { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  toggle: {
    width: 50, height: 28, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", padding: 2,
  },
  toggleOn:      { backgroundColor: "#7c3aed" },
  toggleThumb:   { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
  toggleThumbOn: { alignSelf: "flex-end" },

  // Create button
  createBtn: {
    backgroundColor: "#dc2626", borderRadius: 14, height: 52,
    alignItems: "center", justifyContent: "center", marginTop: 24,
  },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
});

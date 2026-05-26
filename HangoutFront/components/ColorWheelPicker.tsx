import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Modal, PanResponder, LayoutChangeEvent,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

// ── Color math ────────────────────────────────────────────────────────

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0, 1, 0.8];
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, max ? d / max : 0, max];
}

function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const p1 = polarToCart(cx, cy, outerR, startDeg);
  const p2 = polarToCart(cx, cy, outerR, endDeg);
  const p3 = polarToCart(cx, cy, innerR, endDeg);
  const p4 = polarToCart(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${p1.x},${p1.y} A${outerR},${outerR},0,${large},1,${p2.x},${p2.y} L${p3.x},${p3.y} A${innerR},${innerR},0,${large},0,${p4.x},${p4.y} Z`;
}

// ── Constants ─────────────────────────────────────────────────────────

const WHEEL_SIZE = 260;
const CENTER = WHEEL_SIZE / 2;
const OUTER_R = 120;
const INNER_R = 82;
const SEGMENTS = 60;

// Pre-compute wheel segments
const WHEEL_SEGMENTS = Array.from({ length: SEGMENTS }).map((_, i) => {
  const startDeg = (360 / SEGMENTS) * i;
  const endDeg = startDeg + 360 / SEGMENTS + 0.5;
  const hueDeg = (startDeg + endDeg) / 2;
  return { d: arcPath(CENTER, CENTER, OUTER_R, INNER_R, startDeg, endDeg), color: hsvToHex(hueDeg, 1, 1) };
});

// ── Component ─────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  initialColor: string;
  onClose: () => void;
  onSelect: (hex: string) => void;
}

export function ColorWheelPicker({ visible, initialColor, onClose, onSelect }: Props) {
  const [initH, initS, initV] = hexToHsv(initialColor);
  const [h, setH] = useState(initH);
  const [s, setS] = useState(initS);
  const [v, setV] = useState(Math.max(initV, 0.25));
  const [hexInput, setHexInput] = useState(initialColor);
  const [satWidth, setSatWidth] = useState(1);
  const [briWidth, setBriWidth] = useState(1);

  const currentHex = hsvToHex(h, s, v);
  const pureHueHex = hsvToHex(h, 1, 1);

  // Indicator dot on wheel
  const indicatorPos = polarToCart(CENTER, CENTER, (OUTER_R + INNER_R) / 2, h);

  // ── Wheel pan ──────────────────────────────────────────────────────
  const wheelPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleWheelTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => handleWheelTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
    })
  ).current;

  function handleWheelTouch(lx: number, ly: number) {
    const dx = lx - CENTER, dy = ly - CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= INNER_R - 18 && dist <= OUTER_R + 18) {
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      setH(angle);
      setHexInput(hsvToHex(angle, s, v));
    }
  }

  // ── Saturation pan ─────────────────────────────────────────────────
  const satPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => applyS(e.nativeEvent.locationX),
      onPanResponderMove: (e) => applyS(e.nativeEvent.locationX),
    })
  ).current;

  function applyS(lx: number) {
    const newS = Math.max(0, Math.min(1, lx / satWidth));
    setS(newS);
    setHexInput(hsvToHex(h, newS, v));
  }

  // ── Brightness pan ─────────────────────────────────────────────────
  const briPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => applyV(e.nativeEvent.locationX),
      onPanResponderMove: (e) => applyV(e.nativeEvent.locationX),
    })
  ).current;

  function applyV(lx: number) {
    const newV = Math.max(0.05, Math.min(1, lx / briWidth));
    setV(newV);
    setHexInput(hsvToHex(h, s, newV));
  }

  // ── Hex input ──────────────────────────────────────────────────────
  function handleHexInput(text: string) {
    setHexInput(text);
    if (/^#[0-9a-fA-F]{6}$/.test(text)) {
      const [nh, ns, nv] = hexToHsv(text);
      setH(nh); setS(ns); setV(Math.max(nv, 0.05));
    }
  }

  const satThumb = Math.max(0, (s * satWidth) - 12);
  const briThumb = Math.max(0, (v * briWidth) - 12);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cs.backdrop} onPress={onClose} />
      <View style={cs.sheet}>
        <View style={cs.handle} />
        <Text style={cs.title}>Choose Color</Text>

        {/* Color preview */}
        <View style={[cs.preview, { backgroundColor: currentHex }]}>
          <Text style={cs.previewLabel}>Preview</Text>
        </View>

        {/* Hue wheel */}
        <View style={cs.wheelWrap} {...wheelPan.panHandlers}>
          <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
            {WHEEL_SEGMENTS.map((seg, i) => (
              <Path key={i} d={seg.d} fill={seg.color} />
            ))}
            {/* Selected hue indicator */}
            <Circle
              cx={indicatorPos.x} cy={indicatorPos.y}
              r={11} fill={currentHex} stroke="#fff" strokeWidth={2.5}
            />
          </Svg>
        </View>

        {/* Saturation slider */}
        <Text style={cs.sliderLabel}>Saturation</Text>
        <View
          style={cs.sliderTrack}
          onLayout={(e: LayoutChangeEvent) => setSatWidth(e.nativeEvent.layout.width)}
          {...satPan.panHandlers}
        >
          <LinearGradient
            colors={["#ffffff", pureHueHex]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[cs.thumb, { left: satThumb, backgroundColor: currentHex }]} />
        </View>

        {/* Brightness slider */}
        <Text style={cs.sliderLabel}>Brightness</Text>
        <View
          style={cs.sliderTrack}
          onLayout={(e: LayoutChangeEvent) => setBriWidth(e.nativeEvent.layout.width)}
          {...briPan.panHandlers}
        >
          <LinearGradient
            colors={["#000000", pureHueHex]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[cs.thumb, { left: briThumb, backgroundColor: currentHex }]} />
        </View>

        {/* Hex input */}
        <View style={cs.hexRow}>
          <View style={[cs.hexDot, { backgroundColor: currentHex }]} />
          <TextInput
            style={cs.hexInput}
            value={hexInput}
            onChangeText={handleHexInput}
            placeholder="#000000"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            maxLength={7}
          />
        </View>

        {/* Buttons */}
        <View style={cs.btnRow}>
          <Pressable style={cs.cancelBtn} onPress={onClose}>
            <Text style={cs.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[cs.applyBtn, { backgroundColor: currentHex }]}
            onPress={() => { onSelect(currentHex); onClose(); }}
          >
            <Text style={cs.applyText}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    backgroundColor: "#1a0808",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 20, paddingBottom: 44,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", alignSelf: "center", marginBottom: 14 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 14 },

  preview: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  previewLabel: { color: "rgba(0,0,0,0.45)", fontWeight: "700", fontSize: 12 },

  wheelWrap: { width: WHEEL_SIZE, height: WHEEL_SIZE, alignSelf: "center" },

  sliderLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", marginTop: 10, marginBottom: 6 },
  sliderTrack: {
    height: 30, borderRadius: 15, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center",
  },
  thumb: {
    position: "absolute", width: 26, height: 26,
    borderRadius: 13, borderWidth: 3, borderColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
    top: 2,
  },

  hexRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  hexDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)" },
  hexInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    color: "#fff", fontSize: 16, letterSpacing: 1,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  cancelText: { color: "rgba(255,255,255,0.55)", fontWeight: "600", fontSize: 15 },
  applyBtn: { flex: 2, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  applyText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

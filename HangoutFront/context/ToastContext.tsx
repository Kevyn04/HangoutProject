import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type ToastType = "error" | "success" | "info";

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("error");
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, t: ToastType = "error") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    setType(t);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 2800);
  }, [opacity]);

  const bg =
    type === "success" ? "rgba(22,163,74,0.95)"
    : type === "info"  ? "rgba(14,165,233,0.95)"
    :                    "rgba(185,28,28,0.95)";

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Animated.View style={[s.toast, { opacity, backgroundColor: bg }]} pointerEvents="none">
        <Text style={s.text}>{message}</Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

const s = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 20 },
});

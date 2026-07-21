import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Themes, ThemeMode, ThemeColors } from "@/constants/theme";

const THEME_KEY = "@hangout/theme";

type ThemeContextType = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  colors: Themes.dark,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark"); // dark is the default — light is opt-in

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_KEY);
        if (raw === "light" || raw === "dark") setMode(raw);
      } catch {}
    })();
  }, []);

  const setTheme = (next: ThemeMode) => {
    setMode(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  };

  const toggleTheme = () => setTheme(mode === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ mode, colors: Themes[mode], toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

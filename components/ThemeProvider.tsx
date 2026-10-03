import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkColors, LightColors, type ThemeColors } from "../constants/theme";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  /** The user's chosen preference (persisted). */
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "beatrackfam-theme";

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  isDark: false,
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default is light — matches the App Store preview screenshots (the blueprint).
  const [theme, setThemeState] = useState<ThemePreference>("light");
  const systemScheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") {
          setThemeState(v);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = (t: ThemePreference) => {
    setThemeState(t);
    AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
  };

  const isDark = theme === "dark" || (theme === "system" && systemScheme === "dark");

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? DarkColors : LightColors,
      isDark,
      theme,
      setTheme,
      toggleTheme: () =>
        setThemeState((cur) => {
          const next: ThemePreference = cur === "dark" ? "light" : "dark";
          AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
          return next;
        }),
    }),
    [isDark, theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

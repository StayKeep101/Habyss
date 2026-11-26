import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { loadRankLook, subscribeRankLook } from "@/lib/rankLook";
import { loadThemeChoice, subscribeThemeChoice, themeRank } from "@/lib/themeChoice";
import { applyRankPalette, HABYSS_PALETTE } from "@/theme/palettes";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = 'abyss';
export type VisualTheme = 'light' | 'abyss' | 'trueDark';

type ThemeContextType = {
  /** The visual theme: always the dark Habyss look. */
  theme: VisualTheme;
  mode: ThemeMode;
  isDarkMode: boolean;
  /** The rank whose palette the app wears (theme/palettes.ts): a change redraws everything that reads the theme. */
  palette: string;
};

const VALUE: ThemeContextType = { theme: 'abyss', mode: 'abyss', isDarkMode: true, palette: HABYSS_PALETTE };
const ThemeContext = createContext<ThemeContextType>(VALUE);

/**
 * Habyss is dark, always: one look, the Abyss. The system's own pieces
 * (alerts, sheets, the keyboard, the status bar) are asked to be dark too,
 * whatever the phone is set to (ios/Habyss/Info.plist says the same from launch).
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    try { Appearance.setColorScheme('dark'); } catch { /* the plist still holds it */ }
    // The old Light / Auto choice is gone with the setting.
    void AsyncStorage.removeItem('theme').catch(() => undefined);
  }, []);
  // Settings → Appearance → Theme: Default (Habyss blue, theme/palettes.ts HABYSS_PALETTE) or the hourglass in use's palette (theme/palettes.ts).
  useEffect(() => { void loadRankLook(); void loadThemeChoice(); }, []);
  const rank = useSyncExternalStore(subscribeBoth, themeRank, themeRank) ?? HABYSS_PALETTE;
  const value = useMemo(() => {
    applyRankPalette(rank);
    return { ...VALUE, palette: rank };
  }, [rank]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/** A change of either the hourglass in use or the theme chosen. */
const subscribeBoth = (listener: () => void) => {
  const offRank = subscribeRankLook(listener);
  const offChoice = subscribeThemeChoice(listener);
  return () => { offRank(); offChoice(); };
};

export const useTheme = () => useContext(ThemeContext);

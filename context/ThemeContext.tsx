import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { loadRankLook, shownRankLook, subscribeRankLook } from "@/lib/rankLook";
import { applyRankPalette, DEFAULT_PALETTE } from "@/theme/palettes";
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

const VALUE: ThemeContextType = { theme: 'abyss', mode: 'abyss', isDarkMode: true, palette: DEFAULT_PALETTE };
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
  // The hourglass in use dresses the app in its palette (theme/palettes.ts); Lost until a rank is known.
  useEffect(() => { void loadRankLook(); }, []);
  const rank = useSyncExternalStore(subscribeRankLook, shownRankLook, shownRankLook) ?? DEFAULT_PALETTE;
  const value = useMemo(() => {
    applyRankPalette(rank);
    return { ...VALUE, palette: rank };
  }, [rank]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

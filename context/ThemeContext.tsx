import React, { createContext, useContext, useEffect } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = 'abyss';
export type VisualTheme = 'light' | 'abyss' | 'trueDark';

type ThemeContextType = {
  /** The visual theme: always the dark Habyss look. */
  theme: VisualTheme;
  mode: ThemeMode;
  isDarkMode: boolean;
};

const VALUE: ThemeContextType = { theme: 'abyss', mode: 'abyss', isDarkMode: true };
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
  return <ThemeContext.Provider value={VALUE}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

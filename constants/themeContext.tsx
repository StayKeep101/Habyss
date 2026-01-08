import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme as useNativeColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = 'light' | 'abyss' | 'trueDark' | 'system';
export type VisualTheme = 'light' | 'abyss' | 'trueDark';

type ThemeContextType = {
  theme: VisualTheme; // The actual visual theme to render
  mode: ThemeMode;    // The user's selected preference
  setTheme: (mode: ThemeMode) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useNativeColorScheme(); // 'light' | 'dark'
  const [mode, setModeState] = useState<ThemeMode>('abyss'); // Default preference
  const [theme, setThemeState] = useState<VisualTheme>('abyss'); // Actual visual theme

  // Effect to update visual theme whenever mode or system scheme changes
  useEffect(() => {
    if (mode === 'system') {
      // Map system 'dark' to 'abyss' as the default dark theme
      setThemeState(systemColorScheme === 'dark' ? 'abyss' : 'light');
    } else {
      setThemeState(mode as VisualTheme);
    }
  }, [mode, systemColorScheme]);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem("theme");
        if (storedTheme) {
          setModeState(storedTheme as ThemeMode);
        } else {
          await AsyncStorage.setItem("theme", "abyss");
          setModeState('abyss');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        setModeState('abyss');
      }
    };
    loadTheme();
  }, []);

  const setTheme = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem("theme", newMode);
  };

  const toggleTheme = async () => {
    // Legacy toggle mainly for dev or simple switch
    const newMode = mode === 'light' ? 'abyss' : 'light';
    setTheme(newMode);
  };

  const isDarkMode = theme === 'abyss' || theme === 'trueDark';

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};

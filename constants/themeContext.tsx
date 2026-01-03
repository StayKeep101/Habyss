import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = 'light' | 'abyss' | 'trueDark';

type ThemeContextType = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemTheme = useColorScheme(); // Detects system dark/light mode
  const [theme, setThemeState] = useState<ThemeMode>('abyss'); // Default to Abyss (Dark)

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem("theme");
        if (storedTheme) {
          if (storedTheme === 'dark') {
            setThemeState('abyss');
          } else if (storedTheme === 'light' || storedTheme === 'abyss' || storedTheme === 'trueDark') {
            setThemeState(storedTheme as ThemeMode);
          } else {
            // Unknown theme, default to abyss
            setThemeState('abyss');
          }
        } else {
          // No stored theme, ensure we save the default
          await AsyncStorage.setItem("theme", "abyss");
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        setThemeState('abyss');
      }
    };
    loadTheme();
  }, []);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem("theme", newTheme);
  };

  const toggleTheme = async () => {
    // Legacy toggle behavior: cycles Light <-> Abyss
    // (Settings screen will use setTheme for the 3-way switch)
    const newTheme = theme === 'light' ? 'abyss' : 'light';
    setTheme(newTheme);
  };

  const isDarkMode = theme === 'abyss' || theme === 'trueDark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};

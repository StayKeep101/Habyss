import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, type Theme } from "expo-router";
import { Colors } from "./Colors";

export const LightTheme: Theme = {
  ...NavigationLightTheme,
  colors: {
    ...NavigationLightTheme.colors,
    background: Colors.light.background,
    primary: Colors.light.tint,
    text: Colors.light.text,
    card: Colors.light.surface,
    border: Colors.light.border,
  },
};

export const DarkTheme: Theme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: Colors.abyss.background,
    primary: Colors.abyss.tint,
    text: Colors.abyss.text,
    card: Colors.abyss.surface,
    border: Colors.abyss.border,
  },
};

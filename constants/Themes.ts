import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, Theme } from "@react-navigation/native";
import { Colors } from "./Colors";

export const LightTheme: Theme = {
  ...NavigationLightTheme,
  colors: {
    ...NavigationLightTheme.colors,
    background: Colors.light.background,
    primary: Colors.light.tint,
    text: Colors.light.text,
    card: "#F8F8F8", // Optional: Adjust as needed
    border: "#E5E5E5", // Optional
  },
};

export const DarkTheme: Theme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: Colors.abyss.background,
    primary: Colors.abyss.tint,
    text: Colors.abyss.text,
    card: "#1E1E1E", // Optional
    border: "#333333", // Optional
  },
};

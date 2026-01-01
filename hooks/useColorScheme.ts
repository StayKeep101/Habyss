import { useTheme } from '@/constants/themeContext';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export const useColorScheme = () => {
  try {
    const { theme } = useTheme();
    return theme;
  } catch (e) {
    // Fallback to native color scheme if ThemeProvider is not available
    // Fallback to native color scheme if ThemeProvider is not available
    const native = useNativeColorScheme();
    return native === 'dark' ? 'abyss' : 'light';
  }
};

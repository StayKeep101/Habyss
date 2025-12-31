import { useTheme } from '@/constants/themeContext';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export const useColorScheme = () => {
  try {
    const { theme } = useTheme();
    return theme;
  } catch (e) {
    // Fallback to native color scheme if ThemeProvider is not available
    return useNativeColorScheme() ?? 'light';
  }
};

import { useTheme } from '@/context/ThemeContext';

// Resolve the saved Appearance preference through the same provider on web and native.
export function useColorScheme() {
  return useTheme().theme;
}

import { useTheme } from '@/context/ThemeContext';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export const useColorScheme = () => {
  const native = useNativeColorScheme();
  const { theme } = useTheme();
  return theme || (native === 'dark' ? 'abyss' : 'light');
};

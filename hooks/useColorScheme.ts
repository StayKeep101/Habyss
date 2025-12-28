import { useTheme } from '@/constants/themeContext';

export const useColorScheme = () => {
  const { theme } = useTheme();
  return theme;
};

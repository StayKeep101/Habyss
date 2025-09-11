import { useTheme } from '@/constants/themeContext';

export const useColorScheme = () => {
  const { isDarkMode } = useTheme();
  return isDarkMode ? 'dark' : 'light';
};

/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.abyss
) {
  const theme = useColorScheme() ?? 'light';
  
  // Map 'dark' to 'abyss' if needed, or handle props mapping
  const activeTheme = (theme === 'light' || theme === 'abyss' || theme === 'trueDark') 
    ? theme 
    : 'abyss';

  const propsKey = (activeTheme === 'light') ? 'light' : 'dark';
  const colorFromProps = props[propsKey];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[activeTheme][colorName];
  }
}

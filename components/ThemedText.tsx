import { Text, type TextProps, StyleSheet } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Lexend_400Regular',
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Lexend_600SemiBold',
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: 'Lexend_700Bold',
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Lexend_600SemiBold',
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3A5A8C', // Brand Deep Blue
    fontFamily: 'Lexend_600SemiBold',
  },
});

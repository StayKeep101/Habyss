import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { Control, FontFamily } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';
import { useUISound } from '@/hooks/useUISound';

interface IconButtonProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    /** The glyph's size. */
    size?: number;
    /** The disc's diameter; 44 by default. */
    diameter?: number;
    /** The glyph's colour, when it has to say something. */
    color?: string;
    /** A count waiting behind the button (unread, requests), shown as a red badge. */
    badge?: number;
    /** Floating over content that scrolls under it (a page's buttons over its cards): a shadow lifts it off. */
    floating?: boolean;
    style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, label, onPress, disabled, loading, size = Control.icon, diameter = Control.hitTarget, color, badge, floating, style }: IconButtonProps) {
    const tap = useUISound('tap');
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tint = color ?? colors.textPrimary;
    return (
        <TouchableOpacity onPress={() => { tap(); onPress(); }} disabled={disabled || loading} activeOpacity={0.75}
            accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
            hitSlop={diameter < Control.hitTarget ? (Control.hitTarget - diameter) / 2 : undefined}
            style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
            <MatteSurface radius={diameter / 2} level="control" elevation={floating ? 'floating' : undefined} style={{ width: diameter, height: diameter }}>
                {/* Centred on the disc itself, not on a line of text: a glyph's
                    line height is taller than the glyph and pushed it down. */}
                <View pointerEvents="none" style={styles.centre}>
                    {loading ? <ActivityIndicator size="small" color={tint} />
                        : <Ionicons filled name={icon} size={size} color={tint} style={{ width: size, height: size, lineHeight: size, textAlign: 'center' }} />}
                </View>
            </MatteSurface>
            {badge ? (
                <View pointerEvents="none" style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.background }]}>
                    <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    badge: {
        position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, borderWidth: 2,
        paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: FontFamily.bold },
});

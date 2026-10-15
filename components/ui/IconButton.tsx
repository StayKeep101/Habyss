import { ActivityIndicator, StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { Control, UIStyles } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';

interface IconButtonProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    /**
     * Kept so older screens compile. There is one icon button: a matte disc
     * with the card's gradient and a soft shadow, the icon in the middle — the
     * way Phantom draws its bell and share buttons. `accent` only tints the
     * glyph, never the disc.
     */
    variant?: 'plain' | 'surface' | 'accent';
    disabled?: boolean;
    loading?: boolean;
    /** The glyph's size. */
    size?: number;
    /** The disc's diameter; 44 by default. */
    diameter?: number;
    /** The glyph's colour, when it has to say something. */
    color?: string;
    style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, label, onPress, disabled, loading, size = Control.icon, diameter = Control.hitTarget, color, style }: IconButtonProps) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tint = color ?? colors.textPrimary;
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.75}
            accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
            hitSlop={diameter < Control.hitTarget ? (Control.hitTarget - diameter) / 2 : undefined}
            style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
            <MatteSurface radius={diameter / 2} level="control" style={[UIStyles.iconButton, { width: diameter, height: diameter }]}>
                {loading ? <ActivityIndicator size="small" color={tint} /> : <Ionicons name={icon} size={size} color={tint} />}
            </MatteSurface>
        </TouchableOpacity>
    );
}

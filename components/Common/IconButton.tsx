import { ActivityIndicator, StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { Control, Radius, UIStyles, surfaceFor } from '@/constants/DesignSystem';

interface IconButtonProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    variant?: 'plain' | 'surface' | 'accent';
    disabled?: boolean;
    loading?: boolean;
    size?: number;
    style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, label, onPress, variant = 'plain', disabled, loading, size = Control.icon, style }: IconButtonProps) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { foreground } = useAccentGradient();
    const color = variant === 'accent' ? foreground : colors.textPrimary;
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.7}
            accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
            style={[UIStyles.iconButton, {
                borderRadius: Radius.pill,
                // A matte disc rather than a wash of the accent behind the
                // glyph: the accent belongs to the icon, not to a circle around
                // it, and a tinted circle on a dark page reads as a smudge.
                backgroundColor: variant === 'plain' ? 'transparent' : surfaceFor(theme).raised,
                opacity: disabled ? 0.5 : 1,
            }, style]}>
            {loading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={size} color={color} />}
        </TouchableOpacity>
    );
}

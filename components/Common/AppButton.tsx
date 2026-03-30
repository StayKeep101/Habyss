import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';

type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface AppButtonProps {
    label: string;
    onPress: () => void;
    variant?: AppButtonVariant;
    icon?: keyof typeof Ionicons.glyphMap;
    disabled?: boolean;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
    fullWidth?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    icon,
    disabled = false,
    loading = false,
    style,
    fullWidth = true,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { colors: accentGradient } = useAccentGradient();

    const content = (
        <>
            {loading ? (
                <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : colors.textPrimary} />
            ) : icon ? (
                <Ionicons
                    name={icon}
                    size={18}
                    color={variant === 'primary' ? '#fff' : variant === 'danger' ? colors.error : colors.textPrimary}
                />
            ) : null}
            <Text
                style={[
                    styles.label,
                    {
                        color:
                            variant === 'primary'
                                ? '#fff'
                                : variant === 'danger'
                                    ? colors.error
                                    : colors.textPrimary,
                    },
                ]}
            >
                {label}
            </Text>
        </>
    );

    if (variant === 'primary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.86}
                disabled={disabled || loading}
                style={[fullWidth && styles.fullWidth, style, (disabled || loading) && styles.disabled]}
            >
                <LinearGradient
                    colors={accentGradient as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryButton}
                >
                    {content}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    const backgroundColor =
        variant === 'secondary'
            ? isLight
                ? 'rgba(255,255,255,0.86)'
                : colors.surfaceSecondary
            : variant === 'danger'
                ? isLight
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(239,68,68,0.12)'
                : 'transparent';

    const borderColor =
        variant === 'danger'
            ? 'rgba(239,68,68,0.28)'
            : variant === 'ghost'
                ? colors.border
                : colors.border;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.86}
            disabled={disabled || loading}
            style={[
                styles.buttonBase,
                fullWidth && styles.fullWidth,
                { backgroundColor, borderColor },
                style,
                (disabled || loading) && styles.disabled,
            ]}
        >
            {content}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    fullWidth: {
        width: '100%',
    },
    buttonBase: {
        minHeight: 54,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 18,
    },
    primaryButton: {
        minHeight: 54,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 18,
    },
    label: {
        fontSize: 15,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    disabled: {
        opacity: 0.5,
    },
});

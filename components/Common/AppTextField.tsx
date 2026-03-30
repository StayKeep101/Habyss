import React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface AppTextFieldProps extends TextInputProps {
    label: string;
    leadingIcon?: keyof typeof Ionicons.glyphMap;
    trailingIcon?: keyof typeof Ionicons.glyphMap;
    onTrailingPress?: () => void;
}

export const AppTextField: React.FC<AppTextFieldProps> = ({
    label,
    leadingIcon,
    trailingIcon,
    onTrailingPress,
    style,
    ...inputProps
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';

    return (
        <View style={styles.group}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
            <View
                style={[
                    styles.inputShell,
                    {
                        backgroundColor: isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.04)',
                        borderColor: colors.border,
                    },
                ]}
            >
                {leadingIcon ? (
                    <Ionicons
                        name={leadingIcon}
                        size={18}
                        color={colors.textTertiary}
                        style={styles.leadingIcon}
                    />
                ) : null}
                <TextInput
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.textPrimary }, style]}
                    {...inputProps}
                />
                {trailingIcon ? (
                    <TouchableOpacity onPress={onTrailingPress} hitSlop={10}>
                        <Ionicons name={trailingIcon} size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    group: {
        gap: 8,
    },
    label: {
        fontSize: 10,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
    inputShell: {
        minHeight: 58,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    leadingIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        minHeight: 56,
        fontSize: 15,
        fontFamily: 'Lexend_400Regular',
    },
});

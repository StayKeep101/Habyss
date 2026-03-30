import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';

interface ModalHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    onAction?: () => void;
    actionIcon?: keyof typeof Ionicons.glyphMap;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title,
    subtitle,
    onBack,
    onAction,
    actionIcon = 'share-social',
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();

    return (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onBack} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.copy}>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                {subtitle ? <Text style={[styles.subtitle, { color: accentColor }]}>{subtitle}</Text> : null}
            </View>
            {onAction ? (
                <TouchableOpacity onPress={onAction} style={[styles.iconButton, { backgroundColor: accentColor + '20' }]}>
                    <Ionicons name={actionIcon} size={20} color={accentColor} />
                </TouchableOpacity>
            ) : (
                <View style={styles.iconButtonPlaceholder} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    copy: {
        flex: 1,
        marginLeft: 16,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButtonPlaceholder: {
        width: 40,
        height: 40,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
});

import React from 'react';
import { ShareButton, ShareSummary } from '@/components/Common/ShareButton';
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
    shareSummary?: ShareSummary;
    actionIcon?: keyof typeof Ionicons.glyphMap;
    /** Chevron for a pushed screen, close for a sheet that dismisses. */
    backIcon?: 'chevron-back' | 'close';
    /** Custom right-hand control, used when the action is not a share. */
    rightSlot?: React.ReactNode;
}

/**
 * Shared sheet header.
 *
 * Matches the AI Configuration screen: a plain back control, a centred title and
 * a balanced slot on the right so the title stays optically centred whether or
 * not an action is present.
 */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title,
    subtitle,
    onBack,
    onAction,
    actionIcon = 'share-outline',
    shareSummary,
    backIcon = 'chevron-back',
    rightSlot,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();

    const right = rightSlot
        ?? (onAction || shareSummary
            ? <ShareButton onPress={onAction} summary={shareSummary} variant={actionIcon === 'person-add-outline' ? 'friend' : 'share'} />
            : <View style={styles.slot} />);

    return (
        <View style={styles.header}>
            {onBack ? (
                <TouchableOpacity
                    onPress={onBack}
                    accessibilityRole="button"
                    accessibilityLabel={backIcon === 'close' ? 'Close' : 'Back'}
                    style={styles.slot}
                >
                    <Ionicons name={backIcon} size={backIcon === 'close' ? 22 : 26} color={colors.textPrimary} />
                </TouchableOpacity>
            ) : (
                <View style={styles.slot} />
            )}

            <View style={styles.copy}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
                {subtitle ? (
                    <Text style={[styles.subtitle, { color: accentColor }]} numberOfLines={1}>{subtitle}</Text>
                ) : null}
            </View>

            <View style={styles.rightSlot}>{right}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 12,
    },
    copy: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    slot: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rightSlot: {
        minWidth: 44,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        fontFamily: 'Lexend_400Regular',
        marginTop: 3,
        textAlign: 'center',
    },
});

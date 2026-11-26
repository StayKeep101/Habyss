import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import type { FriendStatus } from '@/lib/presence';

/**
 * What someone is doing, as a small mark for the corner of their photo:
 * a lock while focusing, a green dot while on the app, a moon while asleep,
 * a grey dot while away. The same mark on the friends row and on profiles.
 */
export function StatusBadge({ status, size = 20 }: { status: FriendStatus; size?: number }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const icon = size * 0.5;
    if (status === 'live' || status === 'away') {
        const dot = size * 0.7;
        return <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: status === 'live' ? colors.success : colors.textTertiary }} />;
    }
    return (
        <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: status === 'focus' ? primary : colors.surfaceTertiary }]}>
            <AppIcon name={status === 'focus' ? 'lock-closed' : 'moon'} size={icon} color={status === 'focus' ? colors.background : colors.textSecondary} />
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { alignItems: 'center', justifyContent: 'center' },
});

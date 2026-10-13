import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

/**
 * Says when the on-device model read what was typed, and when it is still
 * reading. Renders nothing when there is no model, so the rule-based preview
 * never looks unfinished.
 */
export const AIBadge: React.FC<{ thinking: boolean; used: boolean; color: string }> = ({ thinking, used, color }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    if (!thinking && !used) return null;
    return (
        <View style={styles.row} accessibilityLiveRegion="polite">
            {thinking ? <ActivityIndicator size="small" color={colors.textTertiary} style={{ transform: [{ scale: 0.7 }] }} /> : (
                <Ionicons name="sparkles" size={12} color={color} />
            )}
            <Text style={[styles.text, { color: thinking ? colors.textTertiary : color }]}>
                {thinking ? 'Reading…' : 'Understood on-device'}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    text: { fontSize: 11, fontFamily: FontFamily.medium },
});

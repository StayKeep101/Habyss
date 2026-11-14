import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/theme/colors';
import { Spacing, UIStyles } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

/**
 * The heading over a section, everywhere: large, bold, sentence case — the
 * look of "Numbers" on a goal's Stats tab. `right` puts a pill or a link on the
 * same line; `after` sits right after the title (a figure that belongs to it).
 */
export const SectionTitle: React.FC<{
    children: string;
    tone?: string;
    right?: React.ReactNode;
    /** Right after the title, on its line: a figure that belongs to it (your Shards beside Challenges). */
    after?: React.ReactNode;
    first?: boolean;
    style?: StyleProp<ViewStyle>;
}> = ({ children, tone, right, after, first, style }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={[styles.row, first && styles.first, style]}>
            <View style={styles.lead}>
                <Text accessibilityRole="header" numberOfLines={1} style={[styles.text, { color: tone ?? colors.textPrimary }]}>{children}</Text>
                {after}
            </View>
            {right}
        </View>
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.xxl, marginBottom: Spacing.md },
    first: { marginTop: Spacing.xs },
    lead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
    text: { ...UIStyles.sectionTitle, marginBottom: 0, flexShrink: 1 },
});

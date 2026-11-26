import React from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Spacing } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';
import { Badge, type BadgeProps } from './Badge';
import { Divider } from './Divider';
import { Text } from './Text';

/**
 * One game between friends — a bet, a duel, a challenge — laid out the way a
 * trading app lays out a market: a face or icon, a name and one short line,
 * a pill on the right that says how it stands (Ahead ↗, Doubted ↘), then a
 * hairline and the contest itself (usually a VersusBar), then any buttons.
 * Tappable as a whole when `onPress` is given.
 */
export function GameCard({ lead, title, subtitle, badge, onPress, accessibilityLabel, accessibilityHint, children, footer, style }: {
    lead: React.ReactNode;
    title: string;
    subtitle?: string;
    badge?: BadgeProps;
    onPress?: () => void;
    accessibilityLabel?: string;
    /** What a tap does, read after the card: "Opens the bet". */
    accessibilityHint?: string;
    /** The contest, under the hairline. */
    children?: React.ReactNode;
    /** Buttons, under everything. */
    footer?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}) {
    // Pressable, the card is read as one: its name, its line and its pill, so how it stands is heard too.
    const said = accessibilityLabel ?? [title, subtitle, badge?.label].filter(Boolean).join(', ');
    const body = (
        <MatteSurface radius={Radius.card} style={[styles.card, style]}>
            <View style={styles.head}>
                {lead}
                <View style={styles.text}>
                    <Text variant="heading" numberOfLines={2}>{title}</Text>
                    {subtitle ? <Text variant="bodySmall" tone="muted" numberOfLines={1}>{subtitle}</Text> : null}
                </View>
                {badge ? <Badge {...badge} /> : null}
            </View>
            {children ? <><Divider />{children}</> : null}
            {footer}
        </MatteSurface>
    );
    if (!onPress) return body;
    return (
        // The same press as every card-sized control in components/ui.
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={said} accessibilityHint={accessibilityHint}>
            {body}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    text: { flex: 1, gap: Spacing.xs / 2 },
});

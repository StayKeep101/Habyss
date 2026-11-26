import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, IconTile, MatteSurface, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { textOn } from '@/theme/tokens';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { PLUS_TABS, type PlusTab } from '@/lib/plusActions';

/**
 * One thing the + can do, and the tabs it is on: its icon and name, then a
 * small disc for each tab (Home, Roadmap, Community). A disc filled in the
 * accent is on; tap to put it on that tab or take it off. A disc that cannot
 * change (a tab's last action, or a tab already full) is drawn faint.
 */
export function PlusActionRow({ label, icon, color, on, locked, onToggle }: {
    label: string; icon: string; color: string;
    on: Record<PlusTab, boolean>;
    locked: Record<PlusTab, boolean>;
    onToggle: (tab: PlusTab) => void;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    return (
        <View style={styles.row}>
            <IconTile icon={icon} color={color} size={Control.hitTarget - Spacing.md} />
            <Text variant="body" grow numberOfLines={1}>{label}</Text>
            <View style={styles.tabs}>
                {PLUS_TABS.map(tab => {
                    const active = on[tab.id];
                    const disabled = locked[tab.id];
                    return (
                        <Pressable key={tab.id} disabled={disabled} hitSlop={Spacing.xs}
                            onPress={() => { selectionFeedback(); onToggle(tab.id); }}
                            accessibilityRole="checkbox" accessibilityState={{ checked: active, disabled }}
                            accessibilityLabel={`${label} on ${tab.label}`}
                            accessibilityHint={disabled ? (active ? 'Each tab keeps at least one' : 'This tab already has five') : undefined}>
                            <MatteSurface radius={Radius.pill} level="control" tint={active ? t.color.accent : undefined}
                                style={[styles.disc, disabled && styles.faint]}>
                                <AppIcon name={tab.icon} filled={active} size={Spacing.lg} color={active ? textOn(t.color.accent) : t.color.textMuted} />
                            </MatteSurface>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.hitTarget + Spacing.sm, paddingHorizontal: Spacing.lg },
    tabs: { flexDirection: 'row', gap: Spacing.sm },
    disc: { width: Control.hitTarget - Spacing.xs, height: Control.hitTarget - Spacing.xs, alignItems: 'center', justifyContent: 'center' },
    faint: { opacity: 0.4 },
});

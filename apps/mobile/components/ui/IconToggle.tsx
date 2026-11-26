import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { textOn } from '@/theme/tokens';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';

/**
 * A small two-way switch for a page's header (top right): two icons in one
 * matte capsule, the one showing filled in the accent. For a page that shows
 * one of two sides of the same thing (Focus time or Screen time). Each side is
 * a full 44 pt target, and says its name and whether it is showing.
 */
export function IconToggle<T extends string>({ options, value, onChange }: {
    options: readonly [{ id: T; icon: IconName; label: string }, { id: T; icon: IconName; label: string }];
    value: T;
    onChange: (next: T) => void;
}) {
    const t = useTokens();
    return (
        <MatteSurface radius={Radius.pill} level="control" elevation="none" style={styles.capsule}>
            <View style={styles.row} accessibilityRole="tablist">
                {options.map(option => {
                    const on = option.id === value;
                    return (
                        <Pressable key={option.id} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: on }}
                            hitSlop={{ top: Spacing.sm, bottom: Spacing.sm, left: Spacing.xs, right: Spacing.xs }}
                            onPress={() => { if (!on) onChange(option.id); }}>
                            <View style={[styles.side, { borderRadius: Radius.pill, backgroundColor: on ? t.color.accent : undefined }]}>
                                <AppIcon name={option.icon} filled={on} size={Control.icon} color={on ? textOn(t.color.accent) : t.color.textMuted} />
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </MatteSurface>
    );
}

const styles = StyleSheet.create({
    capsule: { padding: Spacing.xs / 2 },
    row: { flexDirection: 'row' },
    side: { width: Control.icon + Spacing.lg, height: Control.icon + Spacing.sm + Spacing.xs, alignItems: 'center', justifyContent: 'center' },
});

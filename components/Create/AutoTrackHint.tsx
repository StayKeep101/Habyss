import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon, ChoicePill, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { Spacing } from '@/theme/designSystem';
import type { AutoTrackOption } from '@/lib/autoTrackSources';

const ICON: Record<AutoTrackOption['kind'], string> = { health: 'heart', app: 'apps', place: 'location' };

/**
 * Under the habit's sentence, the moment its name says something can count
 * it: "Tracks itself", the ways it could (Apple Health, time in apps, a
 * place), the chosen one filled, and Off. Below, in one line, what that
 * means: the apps that feed it, or how long it takes to tick.
 */
export function AutoTrackHint({ options, chosen, onChoose, accent }: {
    options: AutoTrackOption[];
    /** The option's key, or 'off'. */
    chosen: string;
    onChoose: (key: string) => void;
    accent: string;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    if (!options.length) return null;
    const current = options.find(option => option.key === chosen);
    const pick = (key: string) => { if (key !== chosen) { selectionFeedback(); onChoose(key); } };
    return (
        <View style={styles.wrap} accessibilityLabel="Tracks itself">
            <View style={styles.head}>
                <AppIcon name="flash" filled size={Spacing.md + 2} color={current ? accent : t.color.textSubtle} />
                <Text variant="caption" tone={current ? 'primary' : 'muted'}>{current ? 'Tracks itself' : 'Ticked by hand'}</Text>
            </View>
            <View style={styles.pills}>
                {options.map(option => (
                    <ChoicePill key={option.key} label={option.label} icon={ICON[option.kind]} on={option.key === chosen} color={accent} onPress={() => pick(option.key)} />
                ))}
                <ChoicePill label="Off" on={!current} color={accent} onPress={() => pick('off')} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm, paddingTop: Spacing.xs },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});

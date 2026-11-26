import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, MatteSurface, SectionTitle, Text } from '@/components/ui';
import { habitThoughts, loadHabitThoughts, subscribeHabitThoughts, type HabitThought } from '@/lib/habitThoughts';
import { Radius, Spacing } from '@/theme/designSystem';

const SHOWN = 3;
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * What you wrote as you ticked this habit (lib/habitThoughts.ts), newest
 * first: the last three, the rest a tap away. Nothing until there is one.
 */
export function HabitThoughts({ habitId }: { habitId: string }) {
    const [thoughts, setThoughts] = useState<HabitThought[]>([]);
    const [all, setAll] = useState(false);
    useEffect(() => {
        const read = () => setThoughts(habitThoughts(habitId));
        void loadHabitThoughts().then(read);
        return subscribeHabitThoughts(read);
    }, [habitId]);
    if (!thoughts.length) return null;
    const shown = all ? thoughts : thoughts.slice(0, SHOWN);
    return (
        <View style={styles.wrap}>
            <SectionTitle first>Thoughts</SectionTitle>
            {shown.map(thought => (
                <MatteSurface key={thought.date} radius={Radius.card} style={styles.card}>
                    <Text variant="caption" tone="muted">{dayLabel(thought.date)}</Text>
                    <Text variant="body">{thought.text}</Text>
                </MatteSurface>
            ))}
            {thoughts.length > SHOWN ? (
                <AppButton label={all ? 'Show fewer' : `See all ${thoughts.length}`} variant="ghost" onPress={() => setAll(value => !value)} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    card: { padding: Spacing.lg, gap: Spacing.xs },
});

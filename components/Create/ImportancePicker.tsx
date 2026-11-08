import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StepSlider } from '@/components/ui';
import { DIFFICULTIES, type Difficulty } from '@/lib/difficulty';
import { Spacing } from '@/theme/designSystem';

type Level = 1 | 2 | 3;

/** Urgency, from calm to pressing as the slider goes right (1 is the most urgent). */
const URGENCY: readonly Level[] = [3, 2, 1];
const URGENCY_SAID: Record<Level, string> = { 1: 'Urgent', 2: 'Normal', 3: 'Not urgent' };
const EFFORT: readonly Difficulty[] = [1, 2, 3];
const effortSaid = (value: Difficulty) => DIFFICULTIES.find(item => item.id === value)?.label ?? 'Medium';

/**
 * How much a habit or task matters to the timeline, in one place: a slider
 * for each thing it is weighed on (how urgent, how hard). Urgent ones are
 * placed first; of equal urgency, the hard one goes first, while there is
 * energy. Both show on the card when they are not the ordinary case.
 */
export function ImportancePicker({ priority, difficulty, onChange }: {
    priority?: Level;
    difficulty?: Difficulty;
    onChange: (patch: { priority?: Level; difficulty?: Difficulty }) => void;
}) {
    return (
        <View style={styles.wrap}>
            <StepSlider compact label="Urgency" values={URGENCY} value={priority ?? 2} say={value => URGENCY_SAID[value]}
                onChange={value => onChange({ priority: value })} />
            <StepSlider compact label="Difficulty" values={EFFORT} value={difficulty ?? 2} say={effortSaid}
                onChange={value => onChange({ difficulty: value })} />
        </View>
    );
}

/** The row's summary: only what is not the ordinary case ("Urgent · Hard"). */
export function importanceLabel(priority?: Level, difficulty?: Difficulty): string | undefined {
    const parts = [priority && priority !== 2 ? URGENCY_SAID[priority] : null, difficulty && difficulty !== 2 ? effortSaid(difficulty) : null].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
});

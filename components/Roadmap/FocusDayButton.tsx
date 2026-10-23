import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * Focus the day: the focus page takes you through today's timeline in order,
 * each habit and task timed, meals and events as rests, until there is
 * nothing left or you close it.
 */
export function FocusDayButton() {
    const t = useTokens();
    const { mediumFeedback } = useHaptics();
    return (
        <View style={[styles.row, { marginBottom: t.space.md }]}>
            <ChoicePill label="Focus the day" icon="timer" on color={t.color.accent} role="button"
                accessibilityLabel="Focus the day: go through today's timeline one thing after another"
                onPress={() => { mediumFeedback(); router.push({ pathname: '/(root)/focus', params: { day: '1' } }); }} />
        </View>
    );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });

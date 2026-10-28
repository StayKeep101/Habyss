import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PopupCard } from '@/components/ui/PopupCard';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { QUESTIONS, type CheckIn, type CheckInKind } from '@/lib/checkIns';

/** One of Echo's quick questions: five answers, one tap, done. */
export function CheckInPopup({ kind, onAnswer, onClose }: {
    kind: CheckInKind | null;
    onAnswer: (kind: CheckInKind, value: CheckIn['value']) => void;
    onClose: () => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    // Keeps the question it opened with while it slides away, so the energy
    // bolt never turns into the mood smiley on the way down.
    const [shownKind, setShownKind] = useState<CheckInKind>(kind ?? 'mood');
    if (kind && kind !== shownKind) setShownKind(kind);
    const question = QUESTIONS[shownKind];
    return (
        <PopupCard visible={!!kind} onClose={onClose} icon={question.icon} iconColor={primary} title={question.title} body="One tap. It helps Echo help you.">
            <View style={styles.row}>
                {question.options.map((label, index) => (
                    <Pressable key={label} style={styles.flex} accessibilityRole="button" accessibilityLabel={label}
                        onPress={() => { selectionFeedback(); onAnswer(shownKind, (index + 1) as CheckIn['value']); }}>
                        <MatteSurface radius={Radius.small} level="control" style={styles.option}>
                            <View style={[styles.level, { backgroundColor: primary, opacity: 0.25 + index * 0.18 }]} />
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
                        </MatteSurface>
                    </Pressable>
                ))}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.skip}>
                <Text style={[styles.skipText, { color: colors.textTertiary }]}>Not now</Text>
            </Pressable>
        </PopupCard>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.xs + 2 },
    flex: { flex: 1 },
    option: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: 2 },
    level: { width: 18, height: 18, borderRadius: 9 },
    label: { fontFamily: FontFamily.medium, fontSize: 12 },
    skip: { alignSelf: 'center', paddingVertical: Spacing.sm },
    skipText: { fontFamily: FontFamily.medium, fontSize: 13 },
});

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppButton, AppTextField, ChoicePill } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { Control, Radius, Spacing, Typography } from '@/theme/designSystem';
import { DURATION, EASE, STAGGER } from '@/theme/motion';
import type { Option, Suggestion } from '@/lib/ascent/story';

const rise = (index: number) => FadeInDown.delay(index * STAGGER.stage * 0.6).duration(DURATION.base).easing(EASE.enter);

/**
 * A choice: the app's own choice pills, at full width and control height,
 * rising one after another; the tapped one fills solid in the accent (as a
 * chosen chip does everywhere), then the story goes on.
 */
export function ChoiceList({ options, color, onChoose }: { options: Option[]; color: string; onChoose: (id: string) => void }) {
    const { selectionFeedback } = useHaptics();
    const [chosen, setChosen] = useState<string | null>(null);
    return (
        <View style={styles.list} accessibilityRole="radiogroup">
            {options.map((option, index) => (
                <Animated.View key={option.id} entering={rise(index)}>
                    <ChoicePill label={option.label} on={chosen === option.id} color={color} radius={Radius.control}
                        style={styles.choice} textStyle={styles.choiceText} lines={2}
                        onPress={() => {
                            if (chosen) return;
                            selectionFeedback();
                            setChosen(option.id);
                            setTimeout(() => onChoose(option.id), DURATION.base);
                        }} />
                </Animated.View>
            ))}
        </View>
    );
}

/** Words: a name, or a goal in their own words. Optional ones can be skipped. */
export function TextAnswer({ label, placeholder, optional, onAnswer, autoCapitalize = 'words' }: {
    label: string; placeholder: string; optional?: boolean; onAnswer: (value: string) => void; autoCapitalize?: 'words' | 'sentences';
}) {
    const [value, setValue] = useState('');
    const ready = value.trim().length > 0;
    return (
        <Animated.View entering={rise(0)} style={styles.list}>
            <AppTextField label={label} value={value} onChangeText={setValue} placeholder={placeholder}
                autoFocus autoCapitalize={autoCapitalize} returnKeyType="done" maxLength={60}
                onSubmitEditing={() => { if (ready) onAnswer(value.trim()); }} />
            <AppButton label="Continue" icon="arrow-forward" disabled={!ready} onPress={() => onAnswer(value.trim())} />
            {optional ? <AppButton label="Skip" variant="ghost" onPress={() => onAnswer('')} /> : null}
        </Animated.View>
    );
}

/** The first step: the suggestions for this person, or their own words. */
export function ActionPicker({ suggestions, color, onPick }: { suggestions: Suggestion[]; color: string; onPick: (label: string, own: boolean) => void }) {
    const [own, setOwn] = useState(false);
    const { selectionFeedback } = useHaptics();
    if (own) return <TextAnswer label="Your first step" placeholder="Something small, today" autoCapitalize="sentences" onAnswer={value => value && onPick(value, true)} />;
    return (
        <View style={styles.list}>
            <ChoiceList color={color} onChoose={label => onPick(label, false)}
                options={suggestions.map(item => ({ id: item.label, label: item.label }))} />
            <Animated.View entering={rise(suggestions.length)}>
                <AppButton label="Something else" variant="ghost" onPress={() => { selectionFeedback(); setOwn(true); }} />
            </Animated.View>
        </View>
    );
}

/** The last button: begin the climb. */
export function BeginButton({ onPress }: { onPress: () => void }) {
    return (
        <Animated.View entering={FadeInDown.delay(STAGGER.stage).duration(DURATION.reward).easing(EASE.enter)}>
            <AppButton label="Begin my ascent" icon="arrow-up" onPress={onPress} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    list: { gap: Spacing.sm },
    // The app's choice pill at the size of a control, for an answer that is a whole sentence.
    choice: { minHeight: Control.height, paddingHorizontal: Spacing.lg },
    choiceText: Typography.button,
});

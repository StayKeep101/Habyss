import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppButton, AppIcon, AppTextField, ChoicePill, Text, TimeRow } from '@/components/ui';
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
                    <ChoicePill label={option.label} icon={option.icon} on={chosen === option.id} color={color} radius={Radius.control}
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

/** Several at once (what they juggle): tap to pick, then Continue. */
export function MultiList({ options, color, onDone }: { options: Option[]; color: string; onDone: (ids: string[]) => void }) {
    const { selectionFeedback } = useHaptics();
    const [chosen, setChosen] = useState<string[]>([]);
    return (
        <View style={styles.list}>
            <View style={styles.wrap}>
                {options.map((option, index) => (
                    <Animated.View key={option.id} entering={rise(index)}>
                        <ChoicePill label={option.label} icon={option.icon} role="checkbox" on={chosen.includes(option.id)} color={color}
                            onPress={() => {
                                selectionFeedback();
                                setChosen(list => list.includes(option.id) ? list.filter(id => id !== option.id) : [...list, option.id]);
                            }} />
                    </Animated.View>
                ))}
            </View>
            <AppButton label="Continue" icon="arrow-forward" disabled={chosen.length === 0} onPress={() => onDone(chosen)} />
        </View>
    );
}

/** When the day starts and ends: set from their rhythm, adjustable, then Continue. */
export function DayAnswer({ wake: startWake, sleep: startSleep, color, onDone }: { wake: string; sleep: string; color: string; onDone: (day: { wake: string; sleep: string }) => void }) {
    const [wake, setWake] = useState(startWake);
    const [sleep, setSleep] = useState(startSleep);
    return (
        <Animated.View entering={rise(0)} style={styles.list}>
            <TimeRow icon="sunny-outline" label="Wake up" value={wake} accent={color} onChange={setWake} />
            <TimeRow icon="moon-outline" label="Go to sleep" value={sleep} accent={color} onChange={setSleep} />
            <AppButton label="Continue" icon="arrow-forward" onPress={() => onDone({ wake, sleep })} />
        </Animated.View>
    );
}

/** Echo being built: each part of it appears in turn, ticked, from what they said. */
export function BuildList({ parts, color }: { parts: { icon: string; text: string }[]; color: string }) {
    return (
        <View style={styles.list} accessibilityLiveRegion="polite">
            {parts.map((part, index) => (
                <Animated.View key={part.text} entering={FadeInDown.delay(index * BUILD_STEP_MS).duration(DURATION.base).easing(EASE.enter)} style={styles.part}>
                    <AppIcon name={part.icon} filled size={Control.icon} color={color} />
                    <View style={styles.partText}><Text variant="heading">{part.text}</Text></View>
                    <AppIcon name="checkmark-circle" filled size={Control.icon} color={color} />
                </Animated.View>
            ))}
        </View>
    );
}

/** How long each part of Echo takes to appear while it is built. */
export const BUILD_STEP_MS = 650;

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
            <AppButton label="Let’s go" icon="arrow-forward" onPress={onPress} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    list: { gap: Spacing.sm },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    part: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.hitTarget },
    partText: { flex: 1 },
    // The app's choice pill at the size of a control, for an answer that is a whole sentence.
    choice: { minHeight: Control.height, paddingHorizontal: Spacing.lg },
    choiceText: Typography.button,
});

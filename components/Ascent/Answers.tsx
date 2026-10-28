import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { textOn } from '@/theme/tokens';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE, STAGGER } from '@/theme/motion';
import type { Option, Suggestion } from '@/lib/ascent/story';

const INK = '#F4F1E8';
const MUTED = 'rgba(244,241,232,0.62)';
const rise = (index: number) => FadeInDown.delay(index * STAGGER.stage * 0.6).duration(DURATION.base).easing(EASE.enter);

/** One answer: a matte pill that lights up in Echo's colour when chosen. */
function Pill({ label, chosen, color, onPress, index, icon }: { label: string; chosen: boolean; color: string; onPress: () => void; index: number; icon?: string }) {
    return (
        <Animated.View entering={rise(index)}>
            <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: chosen }} accessibilityLabel={label}>
                <MatteSurface radius={Radius.card} level="control" tint={chosen ? color : undefined} style={styles.pill}>
                    {icon ? <AppIcon name={icon} size={18} color={chosen ? textOn(color) : color} /> : null}
                    <Text style={[styles.pillText, { color: chosen ? textOn(color) : INK }]}>{label}</Text>
                </MatteSurface>
            </Pressable>
        </Animated.View>
    );
}

/** A choice: options rise one after another; the tapped one lights, then the story goes on. */
export function ChoiceList({ options, color, onChoose }: { options: Option[]; color: string; onChoose: (id: string) => void }) {
    const { selectionFeedback } = useHaptics();
    const [chosen, setChosen] = useState<string | null>(null);
    return (
        <View style={styles.list} accessibilityRole="radiogroup">
            {options.map((option, index) => (
                <Pill key={option.id} index={index} label={option.label} chosen={chosen === option.id} color={color}
                    onPress={() => {
                        if (chosen) return;
                        selectionFeedback();
                        setChosen(option.id);
                        setTimeout(() => onChoose(option.id), DURATION.base);
                    }} />
            ))}
        </View>
    );
}

/** Words: a name, or a goal in their own words. Optional ones can be skipped. */
export function TextAnswer({ placeholder, optional, color, onAnswer, autoCapitalize = 'words' }: {
    placeholder: string; optional?: boolean; color: string; onAnswer: (value: string) => void; autoCapitalize?: 'words' | 'sentences';
}) {
    const [value, setValue] = useState('');
    const ready = value.trim().length > 0;
    return (
        <Animated.View entering={rise(0)} style={styles.list}>
            <MatteInput value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor={MUTED}
                style={styles.input} autoFocus autoCapitalize={autoCapitalize} returnKeyType="done" maxLength={60}
                onSubmitEditing={() => { if (ready) onAnswer(value.trim()); }} accessibilityLabel={placeholder} />
            <View style={styles.row}>
                {optional ? (
                    <Pressable onPress={() => onAnswer('')} style={styles.quiet} accessibilityRole="button">
                        <Text style={[styles.quietText, { color: MUTED }]}>Skip</Text>
                    </Pressable>
                ) : <View />}
                <Pressable onPress={() => ready && onAnswer(value.trim())} disabled={!ready} accessibilityRole="button" accessibilityState={{ disabled: !ready }}>
                    <MatteSurface radius={Radius.pill} level="control" tint={ready ? color : undefined} style={[styles.go, !ready && styles.dim]}>
                        <Text style={[styles.pillText, { color: ready ? textOn(color) : MUTED }]}>Continue</Text>
                        <AppIcon name="arrow-forward" size={16} color={ready ? textOn(color) : MUTED} />
                    </MatteSurface>
                </Pressable>
            </View>
        </Animated.View>
    );
}

/** The first step: the suggestions for this person, or their own words. */
export function ActionPicker({ suggestions, color, onPick }: { suggestions: Suggestion[]; color: string; onPick: (label: string, own: boolean) => void }) {
    const [own, setOwn] = useState(false);
    const { selectionFeedback } = useHaptics();
    if (own) return <TextAnswer placeholder="My first step" color={color} autoCapitalize="sentences" onAnswer={value => value && onPick(value, true)} />;
    return (
        <View style={styles.list}>
            <ChoiceList color={color} onChoose={label => onPick(label, false)}
                options={suggestions.map(item => ({ id: item.label, label: item.label }))} />
            <Animated.View entering={rise(suggestions.length)}>
                <Pressable onPress={() => { selectionFeedback(); setOwn(true); }} style={styles.quiet} accessibilityRole="button">
                    <Text style={[styles.quietText, { color: MUTED }]}>Something else</Text>
                </Pressable>
            </Animated.View>
        </View>
    );
}

/** The last button: begin the climb. */
export function BeginButton({ color, onPress }: { color: string; onPress: () => void }) {
    return (
        <Animated.View entering={FadeInDown.delay(STAGGER.stage).duration(DURATION.reward).easing(EASE.enter)}>
            <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Begin my ascent">
                <MatteSurface radius={Radius.pill} level="control" tint={color} style={styles.begin}>
                    <Text style={[styles.beginText, { color: textOn(color) }]}>Begin my ascent</Text>
                    <AppIcon name="arrow-up" size={18} color={textOn(color)} />
                </MatteSurface>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    list: { gap: Spacing.sm },
    pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, minHeight: 54 },
    pillText: { fontFamily: FontFamily.semibold, fontSize: 16 },
    input: { minHeight: 54, paddingHorizontal: Spacing.lg, fontFamily: FontFamily.semibold, fontSize: 18, color: INK },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    quiet: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm, alignSelf: 'center' },
    quietText: { fontFamily: FontFamily.semibold, fontSize: 15 },
    go: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, minHeight: 48 },
    dim: { opacity: 0.6 },
    begin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 58 },
    beginText: { fontFamily: FontFamily.bold, fontSize: 18, letterSpacing: 0.2 },
});

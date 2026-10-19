import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { EchoLine } from '@/components/Home/EchoLine';
import { useTokens } from '@/hooks/useTokens';
import { PERSONALITY_MODES, type PersonalityModeId } from '@/constants/AIPersonalities';
import { coachHello } from '@/lib/coachMessages';
import { ECHO_NAME } from '@/lib/echo';
import { Spacing } from '@/theme/designSystem';
import { EchoOrb } from './EchoOrb';

/** How fast Echo breathes in each voice: calm slow, impatient fast. */
const PACE: Record<string, number> = { friendly: 1800, normal: 2600, dad_mode: 3000, bully_mode: 800 };

/**
 * Choosing how Echo sounds, by hearing it. Echo sits at the top; tap a voice
 * and it says hello in that voice, typed out, and breathes at that voice's
 * pace. The choice is felt, not described.
 */
export function EchoVoicePicker({ chosen, suggested, name, onChoose, children }: {
    chosen: PersonalityModeId;
    suggested?: PersonalityModeId;
    name?: string;
    onChoose: (id: PersonalityModeId) => void;
    children?: React.ReactNode;
}) {
    const t = useTokens();
    const mode = PERSONALITY_MODES.find(item => item.id === chosen) ?? PERSONALITY_MODES[1];
    return (
        <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: t.space.xl, gap: t.space.lg }]} showsVerticalScrollIndicator={false}>
            <View style={styles.orb}><EchoOrb pace={PACE[chosen] ?? 2200} /></View>
            <Text style={[t.type.title, styles.center, { color: t.color.textPrimary }]}>How should {ECHO_NAME} sound?</Text>

            <View style={[styles.grid, { gap: t.space.sm }]}>
                {PERSONALITY_MODES.map(item => (
                    <ChoicePill key={item.id} label={item.id === suggested ? `${item.name} · for you` : item.name} icon={item.icon}
                        on={item.id === chosen} color={t.color.accent} onPress={() => onChoose(item.id)} pressStyle={styles.cell} />
                ))}
            </View>

            {/* Echo says hello in the chosen voice. Keyed, so a new voice starts a new line. */}
            <EchoLine key={chosen} text={coachHello(chosen, name)} style={[styles.line, { minHeight: t.space['4xl'] * 2 }]} />
            {mode.warning ? (
                <Animated.Text key={`${chosen}-warning`} entering={FadeIn.duration(300)} style={[t.type.caption, { color: t.color.textSubtle }]}>
                    {mode.warning}
                </Animated.Text>
            ) : null}
            <Text style={[t.type.caption, styles.center, { color: t.color.textSubtle }]}>You can change this any time in Settings.</Text>
            {children}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: { paddingBottom: Spacing.xxl, alignItems: 'stretch' },
    orb: { alignItems: 'center' },
    center: { textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: '48%', flexGrow: 1 },
    line: { alignSelf: 'stretch' },
});

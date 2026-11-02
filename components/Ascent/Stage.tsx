import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Echo } from '@/components/ui';
import { Spacing } from '@/theme/designSystem';
import { DURATION, EASE } from '@/theme/motion';
import type { EchoMood } from '@/lib/echo';
import type { Answers, StageId } from '@/lib/ascent/story';
import { ClockExplainer, CompoundExplainer, CostExplainer, MotivationExplainer, TradeExplainer } from './Explainers';

/** The stage's share of the screen's height: room for a film, with Echo's line still near eye level under it. */
const SHARE = 0.38;

/** How big the stage is on this screen: its width inside the page margins, and its height. */
export function useStageSize() {
    const window = useWindowDimensions();
    const height = Math.round(Math.min(Spacing.section * 12, Math.max(Spacing.section * 8, window.height * SHARE)));
    return { width: Math.min(window.width - Spacing.xl * 2, Spacing.section * 14), height };
}

/**
 * The top of the Ascent: Echo, or what Echo has become to show something
 * (lib/ascent/story.ts `stage`), built up as the conversation reaches each
 * `step`. Always the same height, so Echo's line under it stays where the eye
 * already is. Echo's rings are clipped to the stage; an explainer never is:
 * each is laid out inside the size it is given.
 */
export function Stage({ stage, step, answers, mood, speaking, color, label }: {
    stage: StageId; step: number; answers: Answers; mood: EchoMood; speaking: boolean; color: string;
    /** What the scene is about, said by VoiceOver for Echo (each explainer says its own). */
    label: string;
}) {
    const size = useStageSize();
    const props = { answers, color, step, ...size };
    return (
        <View style={[styles.stage, { height: size.height }, stage === 'echo' && styles.clip]}>
            <Animated.View key={stage} style={styles.fill} pointerEvents="none"
                entering={FadeIn.duration(DURATION.reward).easing(EASE.enter)} exiting={FadeOut.duration(DURATION.exit).easing(EASE.exit)}>
                {stage === 'echo' ? <View accessible accessibilityRole="image" accessibilityLabel={label}><Echo mood={mood} color={color} speaking={speaking} /></View>
                    : stage === 'clock' ? <ClockExplainer {...props} />
                        : stage === 'cost' ? <CostExplainer {...props} />
                            : stage === 'trade' ? <TradeExplainer {...props} />
                                : stage === 'compound' ? <CompoundExplainer {...props} />
                                    : <MotivationExplainer {...props} />}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    stage: { alignItems: 'center' },
    // Echo's rings reach past its box; clipped so they never pass over its words.
    clip: { overflow: 'hidden' },
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Echo } from '@/components/ui';
import { DURATION, EASE } from '@/theme/motion';
import type { EchoMood } from '@/lib/echo';
import type { Answers, StageId } from '@/lib/ascent/story';
import { ClockExplainer, CompoundExplainer, LifetimeExplainer, MotivationExplainer, STAGE_HEIGHT, TradeExplainer } from './Explainers';

/**
 * The top of the Ascent: Echo, or what Echo has become to show something
 * (lib/ascent/story.ts `stage`). Always the same height, so Echo's line
 * under it stays where the eye already is. One fades into the next; the
 * motivation chart stays put while discipline is drawn onto it.
 */
export function Stage({ stage, answers, mood, speaking, color, label }: {
    stage: StageId; answers: Answers; mood: EchoMood; speaking: boolean; color: string;
    /** What the scene is about, said by VoiceOver for Echo (each explainer says its own). */
    label: string;
}) {
    const key = stage === 'discipline' ? 'motivation' : stage;
    return (
        <View style={styles.stage}>
            <Animated.View key={key} style={styles.fill} pointerEvents="none"
                entering={FadeIn.duration(DURATION.reward).easing(EASE.enter)} exiting={FadeOut.duration(DURATION.exit).easing(EASE.exit)}>
                {stage === 'echo' ? <View accessible accessibilityRole="image" accessibilityLabel={label}><Echo mood={mood} color={color} speaking={speaking} /></View>
                    : stage === 'clock' ? <ClockExplainer answers={answers} color={color} />
                        : stage === 'lifetime' ? <LifetimeExplainer answers={answers} color={color} />
                            : stage === 'trade' ? <TradeExplainer answers={answers} color={color} />
                                : stage === 'compound' ? <CompoundExplainer color={color} />
                                    : <MotivationExplainer color={color} both={stage === 'discipline'} />}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Echo's rings reach past its box; clipped here so they never pass over its words.
    stage: { height: STAGE_HEIGHT, overflow: 'hidden' },
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});

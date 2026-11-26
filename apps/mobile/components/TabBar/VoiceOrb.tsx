import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    Easing, interpolate, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { on } from '@/lib/appEvents';
import { voiceLevel } from '@/lib/voiceLevel';

const BARS = [0.55, 0.85, 1, 0.75, 0.5];
const BAR_HEIGHT = 22;
const OPEN = { damping: 18, stiffness: 190, mass: 0.9, reduceMotion: ReduceMotion.System };
const CLOSE = { duration: 200, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * The create button, stretched into a listening pill while it is held.
 *
 * Grows leftwards out of the button over the tab bar — same gradient, same
 * height — with the mic where the plus was, a level meter that follows the
 * voice, and the words as they are heard. Letting go folds it back into the
 * button. Draws over the button and takes no touches: the finger stays on the
 * button underneath, which is what stops the listening when it lifts.
 */
export function VoiceOrb({ size, maxWidth, colors, ink }: {
    size: number; maxWidth: number; colors: [string, string]; ink: string;
}) {
    const [heard, setHeard] = useState('');
    const open = useSharedValue(0);

    useEffect(() => {
        const subscription = on('voice_state', state => {
            open.value = state.listening ? withSpring(1, OPEN) : withTiming(0, CLOSE);
            setHeard(state.listening ? state.heard : '');
        });
        return () => subscription.remove();
    }, [open]);

    const pill = useAnimatedStyle(() => ({
        width: interpolate(open.value, [0, 1], [size, maxWidth]),
        opacity: open.value > 0.01 ? 1 : 0,
    }));
    const content = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.45, 1], [0, 1], 'clamp') }));

    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.anchor]}>
            <Animated.View style={[styles.pill, { height: size, borderRadius: size / 2 }, pill]}>
                <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <Animated.View style={[styles.row, { paddingLeft: size * 0.42 }, content]}>
                    <View style={styles.bars}>
                        {BARS.map((weight, index) => <Bar key={index} weight={weight} index={index} ink={ink} />)}
                    </View>
                    <Text numberOfLines={1} ellipsizeMode="head" style={[styles.heard, { color: ink, opacity: heard ? 1 : 0.7 }]}>
                        {heard || 'Listening…'}
                    </Text>
                </Animated.View>
                <View style={[styles.mic, { width: size, height: size }]}>
                    <AppIcon name="mic" size={size * 0.4} color={ink} />
                </View>
            </Animated.View>
        </View>
    );
}

/** One bar of the level meter, driven on the UI thread by the voice level. */
function Bar({ weight, index, ink }: { weight: number; index: number; ink: string }) {
    const style = useAnimatedStyle(() => {
        // A little life even in silence, staggered so the bars do not move as one.
        const target = 0.18 + voiceLevel.value * weight * 0.82;
        return { height: withTiming(target * BAR_HEIGHT, { duration: 90 + index * 15 }) };
    });
    return <Animated.View style={[styles.bar, { backgroundColor: ink }, style]} />;
}

const styles = StyleSheet.create({
    anchor: { alignItems: 'flex-end', justifyContent: 'center' },
    pill: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
    row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    bars: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 3 },
    bar: { width: 3, borderRadius: 2 },
    heard: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 15 },
    mic: { alignItems: 'center', justifyContent: 'center' },
});

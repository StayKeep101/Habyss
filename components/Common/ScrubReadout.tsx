import React, { useEffect } from 'react';
import { StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

const AnimatedInput = Animated.createAnimatedComponent(TextInput);

/**
 * A line of text that follows the finger.
 *
 * Text cannot be changed from the UI thread — a `<Text>` only takes what React
 * last rendered — so this is a read-only `TextInput`, whose `text` prop
 * Reanimated *can* write straight from a worklet. It is the standard way to put
 * a live number beside a chart, and it is the difference between a readout that
 * keeps up with a drag and one that stutters a frame behind it.
 *
 * Everything it can say is handed over as an array up front. The worklet only
 * picks; it never formats, because formatting a date on the UI thread would be
 * both slow and locale-blind.
 */
export const ScrubReadout: React.FC<{
    /** One string per point, in the same order as the chart's data. */
    labels: string[];
    /** What to show when nothing is being read. */
    idle: string;
    index: SharedValue<number>;
    style?: TextStyle | TextStyle[];
    /** For the label a screen reader announces in place of the live text. */
    accessibilityLabel?: string;
}> = ({ labels, idle, index, style, accessibilityLabel }) => {
    const source = useSharedValue<string[]>(labels);
    const blank = useSharedValue(idle);
    useEffect(() => { source.set(labels); }, [labels, source]);
    useEffect(() => { blank.set(idle); }, [idle, blank]);

    const props = useAnimatedProps(() => {
        const at = index.get();
        return { text: (at >= 0 ? source.get()[at] : undefined) ?? blank.get() } as never;
    });

    return (
        <AnimatedInput
            editable={false}
            // The value React renders is only ever the first frame; after that
            // the worklet owns it. Both are needed: without `value` the input is
            // uncontrolled and keeps whatever it had.
            value={idle}
            animatedProps={props}
            underlineColorAndroid="transparent"
            // Announced as one label rather than read out character by character
            // while somebody drags.
            accessible={!!accessibilityLabel}
            accessibilityLabel={accessibilityLabel}
            importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
            style={[styles.text, style]}
            pointerEvents="none"
        />
    );
};

/**
 * The vertical line under the finger.
 *
 * A plain view rather than anything drawn, so it can sit over a bar chart or an
 * SVG without either knowing about it, and so it moves by transform — which is
 * the only way to move something every frame without laying out again.
 */
export const ScrubLine: React.FC<{
    x: SharedValue<number>;
    active: SharedValue<number>;
    color: string;
    /** Drawn from the top of the chart down this far. */
    height: number;
    width?: number;
}> = ({ x, active, color, height, width = 1 }) => {
    const style = useAnimatedStyle(() => ({
        opacity: active.get(),
        transform: [{ translateX: x.get() - width / 2 }],
    }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.line, style, { height, width, backgroundColor: color }]}
        />
    );
};

const styles = StyleSheet.create({
    // A TextInput brings its own padding and a minimum height on both
    // platforms; neither belongs in a line of chart furniture.
    text: { padding: 0, margin: 0, includeFontPadding: false, textAlignVertical: 'center' },
    line: { position: 'absolute', left: 0, top: 0 },
});

/** A dot that rides the line, for charts that have a curve to put it on. */
export const ScrubDot: React.FC<{
    x: SharedValue<number>;
    y: SharedValue<number>;
    active: SharedValue<number>;
    color: string;
    ring: string;
    size?: number;
}> = ({ x, y, active, color, ring, size = 11 }) => {
    const style = useAnimatedStyle(() => ({
        opacity: active.get(),
        transform: [
            { translateX: x.get() - size / 2 },
            { translateY: y.get() - size / 2 },
            { scale: 0.6 + active.get() * 0.4 },
        ],
    }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.line, style, {
                width: size, height: size, borderRadius: size / 2,
                backgroundColor: color, borderWidth: 2, borderColor: ring,
            }]}
        />
    );
};

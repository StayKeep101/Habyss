import React, { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { hexToHsv, hsvToHex, normalizeHex } from '@/lib/goalColors';

const SIZE = 168, RADIUS = 80, CENTER = SIZE / 2;
/** The thumb, and the travel it costs. */
const THUMB = 18;
const WheelArtwork = memo(function WheelArtwork() {
    return <Svg width={SIZE} height={SIZE}>
        <Defs><RadialGradient id="wheel-saturation" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="white" stopOpacity="1" />
            <Stop offset="1" stopColor="white" stopOpacity="0" />
        </RadialGradient></Defs>
        {Array.from({ length: 72 }, (_, index) => {
            const start = index * 5 * Math.PI / 180, end = (index * 5 + 5.5) * Math.PI / 180;
            const path = `M ${CENTER} ${CENTER} L ${CENTER + RADIUS * Math.cos(start)} ${CENTER + RADIUS * Math.sin(start)} A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER + RADIUS * Math.cos(end)} ${CENTER + RADIUS * Math.sin(end)} Z`;
            return <Path key={index} d={path} fill={hsvToHex(index * 5, 1, 1)} />;
        })}
        <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#wheel-saturation)" />
    </Svg>;
});

export function GoalColorWheel({ value, onChange, accent }: { value: string; onChange: (color: string) => void; accent: string }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const initial = hexToHsv(value);
    const h = useSharedValue(initial.h), s = useSharedValue(initial.s), v = useSharedValue(initial.v);
    const [hexDraft, setHexDraft] = useState<{ source: string; text: string } | null>(null);
    const hex = hexDraft?.source === value ? hexDraft.text : value.toUpperCase();
    const setHex = (text: string) => setHexDraft({ source: value, text });
    useEffect(() => {
        const next = hexToHsv(value);
        // Keep hue/saturation while brightness is zero; black alone cannot encode them.
        if (value.toUpperCase() !== hsvToHex(h.get(), s.get(), v.get())) {
            h.set(next.h); s.set(next.s); v.set(next.v);
        }
    }, [value, h, s, v]);
    const commit = (hue: number, saturation: number, brightness: number) => onChange(hsvToHex(hue, saturation, brightness));

    /**
     * How wide the brightness track actually is.
     *
     * It used to be a constant 160, laid out inside a row that is as wide as
     * the sheet — so on any phone wider than that the bar stopped part way
     * across with black beside it, which is not a slider that ran out, it is a
     * slider that was never measured. A shared value rather than state: the
     * gesture reads it on the UI thread.
     */
    const width = useSharedValue(0);
    const position = (x: number, y: number) => {
        'worklet';
        const dx = x - CENTER, dy = y - CENTER;
        h.set((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);
        s.set(Math.min(1, Math.sqrt(dx * dx + dy * dy) / RADIUS));
    };
    const wheel = Gesture.Pan().minDistance(0)
        .onBegin(event => position(event.x, event.y))
        .onUpdate(event => position(event.x, event.y))
        .onFinalize(() => runOnJS(commit)(h.get(), s.get(), v.get()));
    /**
     * Where along the track a touch falls, in 0–1.
     *
     * Measured from the thumb's centre at each end rather than from the edges,
     * so dragging fully left gives 0 and fully right gives 1 — with the old
     * edge-to-edge mapping the thumb's own width made both ends unreachable,
     * and half of it hung off the bar at each extreme.
     */
    const along = (x: number) => {
        'worklet';
        const travel = Math.max(1, width.get() - THUMB);
        return Math.max(0, Math.min(1, (x - THUMB / 2) / travel));
    };
    const brightness = Gesture.Pan().minDistance(0)
        .onBegin(event => { v.set(along(event.x)); })
        .onUpdate(event => { v.set(along(event.x)); })
        .onFinalize(() => runOnJS(commit)(h.get(), s.get(), v.get()));
    const marker = useAnimatedStyle(() => ({ transform: [
        { translateX: Math.cos(h.get() * Math.PI / 180) * s.get() * RADIUS },
        { translateY: Math.sin(h.get() * Math.PI / 180) * s.get() * RADIUS },
    ], backgroundColor: hsvToHex(h.get(), s.get(), v.get()) }));
    const preview = useAnimatedStyle(() => ({ backgroundColor: hsvToHex(h.get(), s.get(), v.get()) }));
    const track = useAnimatedStyle(() => ({ backgroundColor: hsvToHex(h.get(), s.get(), 1) }));
    const thumb = useAnimatedStyle(() => ({
        transform: [{ translateX: v.get() * Math.max(0, width.get() - THUMB) }],
    }));
    const shade = useAnimatedStyle(() => ({ opacity: 1 - v.get() }));
    const valid = normalizeHex(hex);
    return <View style={styles.content}>
        <View style={styles.top}>
            <GestureDetector gesture={wheel}>
                <View accessibilityLabel="Color wheel. Drag to choose hue and saturation, or enter a hex color below." style={styles.wheel}>
                    <WheelArtwork />
                    <Animated.View pointerEvents="none" style={[styles.shade, shade]} />
                    <Animated.View pointerEvents="none" style={[styles.marker, marker]} />
                </View>
            </GestureDetector>
            <View style={styles.previewColumn}>
                <Animated.View style={[styles.preview, preview]} />
            </View>
        </View>
        <View style={styles.brightness}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Brightness</Text>
            <GestureDetector gesture={brightness}>
                <View style={styles.trackTouch}
                    onLayout={event => { width.set(event.nativeEvent.layout.width); }}
                    accessible accessibilityRole="adjustable" accessibilityLabel="Color brightness"
                    accessibilityValue={{ min: 0, max: 100, now: Math.round(initial.v * 100) }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={event => commit(h.get(), s.get(), Math.max(0, Math.min(1, v.get() + (event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}>
                    <Animated.View style={[styles.track, track]}>
                        <LinearGradient colors={['#000000', '#00000000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    </Animated.View>
                    <Animated.View pointerEvents="none" style={[styles.thumb, thumb]} />
                </View>
            </GestureDetector>
        </View>
        <View style={styles.hexRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Hex</Text>
            <MatteInput accessibilityLabel="Exact hex color" value={hex} onChangeText={setHex} autoCapitalize="characters"
                autoCorrect={false} maxLength={7} returnKeyType="done" onSubmitEditing={() => { if (valid) onChange(valid); }}
                style={[styles.hex, { color: colors.textPrimary, borderColor: colors.border }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Apply hex color" disabled={!valid}
                accessibilityState={{ disabled: !valid }} onPress={() => { if (valid) onChange(valid); }} style={styles.apply}>
                <Text style={[styles.label, { color: valid ? accent : colors.textTertiary }]}>Apply</Text>
            </Pressable>
        </View>
        {!valid ? <Text style={[styles.hint, { color: colors.textSecondary }]}>Not a colour</Text> : null}
    </View>;
}

const styles = StyleSheet.create({
    content: { gap: 6 }, top: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    wheel: { width: SIZE, height: SIZE },
    shade: { position: 'absolute', left: 4, top: 4, width: RADIUS * 2, height: RADIUS * 2, borderRadius: RADIUS, backgroundColor: '#000000' },
    marker: { position: 'absolute', left: CENTER - 9, top: CENTER - 9, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ffffff', shadowColor: '#000000', shadowOpacity: 0.4, shadowRadius: 2 },
    previewColumn: { flex: 1, alignItems: 'center', gap: 10 },
    preview: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: '#888888' },
    hint: { fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
    brightness: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    label: { fontSize: 13, fontFamily: FontFamily.medium },
    // `flex: 1` rather than a fixed width: the track is however much room the
    // row has left after the label, on whatever phone this is.
    trackTouch: { flex: 1, height: 44, justifyContent: 'center' },
    track: { height: 14, borderRadius: 7, overflow: 'hidden' },
    // Travels from the left edge to `width - THUMB`, so it sits fully on the
    // bar at both ends rather than half off it.
    thumb: { position: 'absolute', left: 0, top: 13, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#777777' },
    hexRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    hex: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontFamily: FontFamily.medium, fontSize: 14 },
    apply: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
});

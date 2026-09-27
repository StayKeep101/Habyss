import React, { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { hexToHsv, hsvToHex, normalizeHex } from '@/lib/goalColors';

const SIZE = 168, RADIUS = 80, CENTER = SIZE / 2, TRACK = 160;
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
    const brightness = Gesture.Pan().minDistance(0)
        .onBegin(event => { v.set(Math.max(0, Math.min(1, event.x / TRACK))); })
        .onUpdate(event => { v.set(Math.max(0, Math.min(1, event.x / TRACK))); })
        .onFinalize(() => runOnJS(commit)(h.get(), s.get(), v.get()));
    const marker = useAnimatedStyle(() => ({ transform: [
        { translateX: Math.cos(h.get() * Math.PI / 180) * s.get() * RADIUS },
        { translateY: Math.sin(h.get() * Math.PI / 180) * s.get() * RADIUS },
    ], backgroundColor: hsvToHex(h.get(), s.get(), v.get()) }));
    const preview = useAnimatedStyle(() => ({ backgroundColor: hsvToHex(h.get(), s.get(), v.get()) }));
    const track = useAnimatedStyle(() => ({ backgroundColor: hsvToHex(h.get(), s.get(), 1) }));
    const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: v.get() * TRACK }] }));
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
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Drag to find your color</Text>
            </View>
        </View>
        <View style={styles.brightness}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Brightness</Text>
            <GestureDetector gesture={brightness}>
                <View style={styles.trackTouch} accessible accessibilityRole="adjustable" accessibilityLabel="Color brightness"
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
            <TextInput accessibilityLabel="Exact hex color" value={hex} onChangeText={setHex} autoCapitalize="characters"
                autoCorrect={false} maxLength={7} returnKeyType="done" onSubmitEditing={() => { if (valid) onChange(valid); }}
                style={[styles.hex, { color: colors.textPrimary, borderColor: colors.border }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Apply hex color" disabled={!valid}
                accessibilityState={{ disabled: !valid }} onPress={() => { if (valid) onChange(valid); }} style={styles.apply}>
                <Text style={[styles.label, { color: valid ? accent : colors.textTertiary }]}>Apply</Text>
            </Pressable>
        </View>
        {!valid ? <Text style={[styles.hint, { color: colors.textSecondary }]}>Use 3 or 6 hex digits, like #6B8AF5.</Text> : null}
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
    trackTouch: { width: TRACK, height: 44, justifyContent: 'center' },
    track: { height: 14, borderRadius: 7, overflow: 'hidden' },
    thumb: { position: 'absolute', left: -9, top: 13, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#777777' },
    hexRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    hex: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontFamily: FontFamily.medium, fontSize: 14 },
    apply: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
});

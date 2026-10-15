import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, surfaceFor } from '@/theme/designSystem';
import { LinearGradient } from 'expo-linear-gradient';
import { MatteSurface } from './MatteSurface';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

export interface SwitcherOption<T extends string> {
    id: T;
    label: string;
    icon: IconName;
}

const SPRING = { damping: 19, stiffness: 230, mass: 0.6, reduceMotion: ReduceMotion.System };

/**
 * The control that changes what a detail page is showing.
 *
 * One capsule rather than a button in each corner: two buttons that both read
 * "Today" when you are looking at something else never said which one you were
 * on, while a segment that slides does. It sits on an opaque surface, because
 * a control floating over a scrolling page has to stay readable while the page
 * moves underneath it — a translucent pill lets the content show through and
 * turns into noise exactly when it is being used.
 */
export function ViewSwitcher<T extends string>({ options, value, onChange, accent }: {
    options: SwitcherOption<T>[];
    value: T;
    onChange: (id: T) => void;
    accent: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);

    const index = Math.max(0, options.findIndex(option => option.id === value));
    const position = useSharedValue(index);
    useEffect(() => { position.value = withSpring(index, SPRING); }, [index, position]);

    const slot = width ? (width - 8) / options.length : 0;
    const pill = useAnimatedStyle(() => ({ width: slot, transform: [{ translateX: position.value * slot }] }));

    return (
        <View accessibilityRole="tablist" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <MatteSurface radius={24} elevation="floating" style={styles.bar}>
            {slot > 0 ? (
                // A solid pill, not a tinted outline of one. The selected half
                // used to be a wash of the accent behind a brighter edge, which
                // reads as a hole cut in the bar rather than a thing on top of it.
                // The selected pill: a lighter step of the same matte material,
                // lit from the top, so it reads as raised inside the bar.
                <Animated.View style={[styles.pill, pill, { backgroundColor: tone.raised }]}>
                    <LinearGradient colors={theme === 'light' ? ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
                        style={StyleSheet.absoluteFill} />
                </Animated.View>
            ) : null}

            {options.map(option => {
                const selected = option.id === value;
                return (
                    <Pressable
                        key={option.id}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={option.label}
                        onPress={() => { if (!selected) selectionFeedback(); onChange(option.id); }}
                        style={styles.segment}
                    >
                        <AppIcon filled name={option.icon} size={15} color={selected ? accent : colors.textTertiary} />
                        <Text numberOfLines={1} style={[styles.label, { color: selected ? colors.textPrimary : colors.textSecondary }]}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </MatteSurface>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
        height: 48, padding: 4,
    },
    pill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 20, overflow: 'hidden' },
    segment: {
        flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: '100%',
    },
    label: { fontSize: 13, fontFamily: FontFamily.medium },
});

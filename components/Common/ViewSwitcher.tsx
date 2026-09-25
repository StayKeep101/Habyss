import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AppIcon, type IconName } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
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
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);

    const index = Math.max(0, options.findIndex(option => option.id === value));
    const position = useSharedValue(index);
    useEffect(() => { position.value = withSpring(index, SPRING); }, [index, position]);

    const slot = width ? (width - 8) / options.length : 0;
    const pill = useAnimatedStyle(() => ({ width: slot, transform: [{ translateX: position.value * slot }] }));

    return (
        <View
            accessibilityRole="tablist"
            onLayout={event => setWidth(event.nativeEvent.layout.width)}
            style={[styles.bar, {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: theme === 'light' ? '#0F172A' : '#000',
            }]}
        >
            {slot > 0 ? (
                <Animated.View style={[styles.pill, pill, { backgroundColor: accent + '24', borderColor: accent + '55' }]} />
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
                        <AppIcon name={option.icon} size={15} color={selected ? accent : colors.textTertiary} />
                        <Text numberOfLines={1} style={[styles.label, { color: selected ? colors.textPrimary : colors.textSecondary }]}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
        height: 48, padding: 4, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth,
        shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    pill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 20, borderWidth: 1 },
    segment: {
        flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: '100%',
    },
    label: { fontSize: 13, fontFamily: FontFamily.medium },
});

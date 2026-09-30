import React, { useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, ReduceMotion, useAnimatedProps, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { PulsePerson } from '@/lib/feed';

export type { PulsePerson };

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE = { duration: 620, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * Everybody, at a glance, along the top of the feed.
 *
 * The feed below shows about one and a half cards on a phone screen, so with a
 * dozen friends the answer to "who is about today" costs a dozen scrolls. The
 * rail answers it in one look, and tapping a face takes the feed to that
 * person — which makes it a control rather than decoration, and is the only
 * thing that earns the vertical space it costs.
 *
 * Ordered by who needs you, not by who is doing best. Somebody waiting on your
 * half of a shared habit is the one fact here you can actually act on, and a
 * rail sorted by achievement would bury them behind whoever tracks the most
 * undemanding things. You are always last: this is a list of other people.
 */
export const Pulse: React.FC<{
    people: PulsePerson[];
    onPick: (id: string) => void;
}> = ({ people, onPick }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();

    if (people.length < 2) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            // A rail of faces is a list of people, and it is read as one.
            accessibilityRole="list"
        >
            {people.map((person, index) => (
                <Face
                    key={person.card.id}
                    person={person}
                    index={index}
                    colors={colors}
                    isLight={isLight}
                    accent={primary}
                    onPress={() => { selectionFeedback(); onPick(person.card.id); }}
                />
            ))}
        </ScrollView>
    );
};

const Face: React.FC<{
    person: PulsePerson;
    index: number;
    colors: (typeof Colors)['abyss'];
    isLight: boolean;
    accent: string;
    onPress: () => void;
}> = ({ person, index, colors, isLight, accent, onPress }) => {
    const { card, waitingOnYou } = person;
    const size = s(50);
    const stroke = s(2.5);
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    const filled = useSharedValue(0);
    useEffect(() => {
        // Staggered, so the rail draws itself left to right rather than
        // snapping into place all at once — it is the one moment this screen
        // gets to look alive, and it costs nothing.
        filled.value = withDelay(index * 45, withTiming(card.share, EASE));
    }, [card.share, index, filled]);
    const ring = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - filled.value) }));

    const tint = card.complete ? colors.success : accent;
    const label = card.isYou ? 'You' : card.username;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={
                waitingOnYou
                    ? `${label}. ${card.line}. Waiting on you.`
                    : `${label}. ${card.line}`
            }
            hitSlop={4}
            onPress={onPress}
            style={styles.face}
        >
            <View style={{ width: size, height: size }}>
                <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                    <Circle
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke={isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.12)'}
                        strokeWidth={stroke} fill="none"
                        opacity={card.total > 0 ? 1 : 0}
                    />
                    <AnimatedCircle
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke={tint} strokeWidth={stroke} strokeLinecap="round" fill="none"
                        strokeDasharray={`${circumference} ${circumference}`}
                        animatedProps={ring}
                        rotation={-90} origin={`${size / 2}, ${size / 2}`}
                    />
                </Svg>
                <View style={[styles.photoWrap, {
                    width: size - stroke * 2 - s(3), height: size - stroke * 2 - s(3),
                    borderRadius: (size - stroke * 2 - s(3)) / 2,
                    margin: stroke + s(1.5), backgroundColor: colors.background,
                }]}>
                    {card.avatarUrl ? (
                        <Image source={{ uri: card.avatarUrl }} style={styles.photo} />
                    ) : (
                        <Text style={[styles.initial, { color: accent }]}>
                            {label.slice(0, 1).toUpperCase()}
                        </Text>
                    )}
                </View>

                {/* The one badge worth putting here. Not a streak and not a
                    score: those say how somebody is doing, and this says there
                    is something only you can do. */}
                {waitingOnYou ? (
                    <View style={[styles.waiting, { backgroundColor: accent, borderColor: colors.background }]} />
                ) : null}
            </View>
            <Text numberOfLines={1} style={[styles.name, {
                color: waitingOnYou ? colors.textPrimary : colors.textTertiary,
                fontFamily: waitingOnYou ? FontFamily.semibold : FontFamily.regular,
            }]}>
                {label}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    rail: { gap: s(14), paddingVertical: vs(2), paddingRight: s(4) },
    face: { alignItems: 'center', gap: vs(5), width: s(58) },
    photoWrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    initial: { fontSize: ms(18), fontFamily: FontFamily.bold },
    waiting: {
        position: 'absolute', right: -s(1), bottom: -s(1),
        width: s(13), height: s(13), borderRadius: s(6.5), borderWidth: s(2),
    },
    name: { maxWidth: s(58), fontSize: ms(10) },
});

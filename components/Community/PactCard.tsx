import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { FontFamily, surfaceFor } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { formatEmbers } from '@/lib/ember';
import { daysLeft, isOver, lineFor, outcomeOf, type Pact, type PactSide } from '@/lib/pact';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/**
 * One promise, and who is holding up their end of it.
 *
 * Built around the two faces rather than the number, because the number is not
 * what makes anybody get up. Both sides are always shown, done or not, so the
 * card answers the only question worth asking at a glance: is it me they are
 * waiting on.
 */
export const PactCard: React.FC<{
    pact: Pact;
    today: string;
    busy?: boolean;
    onAccept?: () => void;
    onDecline?: () => void;
    onOpen?: () => void;
}> = ({ pact, today, busy, onAccept, onDecline, onOpen }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary: accent } = useAccentGradient();

    const over = pact.status === 'settled' || isOver(pact, today);
    const outcome = outcomeOf(pact);
    const waitingOnYou = pact.status === 'live' && !over && !pact.mine.kept;

    const tint = over
        ? (outcome === 'both' ? colors.success : outcome === 'mine' ? colors.success : outcome === 'theirs' ? colors.error : colors.textTertiary)
        : waitingOnYou ? colors.warning : accent;

    const left = daysLeft(pact, today);

    return (
        <Animated.View entering={FadeIn.duration(200)} layout={MORPH}>
            <VoidCard matte style={styles.card}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Pact on ${pact.itemName}. ${lineFor(pact, today)}`} onPress={onOpen} disabled={!onOpen}>
                    <View style={styles.head}>
                        <View style={styles.faces}>
                            <Face side={pact.mine} tone={tone.raised} tint={tint} colors={colors} />
                            <View style={[styles.versus, { backgroundColor: tone.raised }]}>
                                <Ionicons name="flame" size={s(11)} color={tint} />
                            </View>
                            <Face side={pact.theirs} tone={tone.raised} tint={tint} colors={colors} />
                        </View>

                        <View style={styles.text}>
                            <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{pact.itemName}</Text>
                            <Text numberOfLines={1} style={[styles.line, { color: tint }]}>{lineFor(pact, today)}</Text>
                        </View>

                        <View style={styles.stake}>
                            <Text style={[styles.stakeValue, { color: colors.textPrimary }]}>
                                {formatEmbers(pact.mine.stake + pact.theirs.stake)}
                            </Text>
                            <Text style={[styles.stakeLabel, { color: colors.textTertiary }]}>
                                {over ? 'was on it' : 'on it'}
                            </Text>
                        </View>
                    </View>
                </Pressable>

                {pact.status === 'offered' && onAccept ? (
                    <View style={styles.actions}>
                        <Pressable
                            accessibilityRole="button" accessibilityLabel="Decline the pact"
                            disabled={busy} onPress={onDecline}
                            style={[styles.action, { backgroundColor: tone.raised }]}
                        >
                            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Decline</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button" accessibilityLabel={`Accept and stake ${pact.mine.stake}`}
                            disabled={busy} onPress={onAccept}
                            style={[styles.action, { backgroundColor: accent }]}
                        >
                            {busy
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={[styles.actionText, { color: '#fff' }]}>{`Stake ${pact.mine.stake}`}</Text>}
                        </Pressable>
                    </View>
                ) : pact.status === 'offered' ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Withdraw the pact" disabled={busy} onPress={onDecline} style={styles.withdraw}>
                        <Text style={[styles.withdrawText, { color: colors.textTertiary }]}>Withdraw</Text>
                    </Pressable>
                ) : !over ? (
                    <View style={[styles.foot, { borderTopColor: tone.line }]}>
                        <Ionicons name="time-outline" size={s(12)} color={colors.textTertiary} />
                        <Text style={[styles.footText, { color: colors.textTertiary }]}>
                            {left === 0 ? 'Ends tonight' : left === 1 ? 'One day left' : `${left} days left`}
                        </Text>
                    </View>
                ) : null}
            </VoidCard>
        </Animated.View>
    );
};

/** One person, and whether they have done it. */
const Face: React.FC<{ side: PactSide; tone: string; tint: string; colors: typeof Colors.light }> = ({ side, tone, tint, colors }) => (
    <View style={styles.face}>
        <View style={[styles.avatar, { backgroundColor: tone, borderColor: side.kept ? tint : 'transparent' }]}>
            {side.avatarUrl ? (
                <Image source={{ uri: side.avatarUrl }} style={styles.photo} />
            ) : (
                <Text style={[styles.initial, { color: colors.textSecondary }]}>{side.username.slice(0, 1).toUpperCase()}</Text>
            )}
        </View>
        {side.kept ? (
            <View style={[styles.tick, { backgroundColor: tint }]}>
                <Ionicons name="checkmark" size={s(9)} color="#fff" />
            </View>
        ) : null}
    </View>
);

const styles = StyleSheet.create({
    card: { padding: s(14), gap: vs(10) },
    head: { flexDirection: 'row', alignItems: 'center', gap: s(11) },
    faces: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
    face: { width: s(34), height: s(34) },
    avatar: { width: '100%', height: '100%', borderRadius: s(17), borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    initial: { fontSize: ms(13), fontFamily: FontFamily.bold },
    tick: { position: 'absolute', right: -2, bottom: -2, width: s(14), height: s(14), borderRadius: s(7), alignItems: 'center', justifyContent: 'center' },
    versus: { width: s(18), height: s(18), borderRadius: s(9), alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, gap: vs(2) },
    name: { fontSize: ms(14), fontFamily: FontFamily.semibold },
    line: { fontSize: ms(12), fontFamily: FontFamily.medium },
    stake: { alignItems: 'flex-end' },
    stakeValue: { fontSize: ms(16), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    stakeLabel: { fontSize: ms(9), fontFamily: FontFamily.regular },
    actions: { flexDirection: 'row', gap: s(8) },
    action: { flex: 1, minHeight: 40, borderRadius: s(12), alignItems: 'center', justifyContent: 'center' },
    actionText: { fontSize: ms(13), fontFamily: FontFamily.semibold },
    withdraw: { alignSelf: 'flex-start', minHeight: 30, justifyContent: 'center' },
    withdrawText: { fontSize: ms(12), fontFamily: FontFamily.medium },
    foot: { flexDirection: 'row', alignItems: 'center', gap: s(5), borderTopWidth: StyleSheet.hairlineWidth, paddingTop: vs(9) },
    footText: { fontSize: ms(11), fontFamily: FontFamily.regular },
});

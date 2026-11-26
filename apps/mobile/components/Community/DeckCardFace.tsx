import React from 'react';
import { Image, Text as RNText, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon, MatteSurface } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { Colors } from '@/theme/colors';
import { Radius, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import type { DeckCard } from '@/lib/dayDeck';

/**
 * One card of a friend's day (lib/dayDeck.ts). With a photo: the photo, edge
 * to edge, and the words over a dark fade at its foot. Without: what counted
 * it, large in the middle (6,240 / 10,000 steps, 45 min focused), or a big
 * tick. Always: Habit or Task, the name, planned against what it took (and
 * whether that was under or over), and when it was done.
 */
export function DeckCardFace({ card, width, height }: { card: DeckCard; width: number; height: number }) {
    const t = useTokens();
    const white = Colors.common.white;
    const onPhoto = !!card.photo;
    const ink = onPhoto ? white : t.color.textPrimary;
    const muted = onPhoto ? `${white}CC` : t.color.textMuted;
    const verdictColor = card.verdict?.tone === 'good' ? t.color.success : card.verdict?.tone === 'over' ? t.color.warning : t.color.textMuted;

    const info = (
        <View style={styles.info}>
            {card.kind ? (
                <View style={[styles.kind, { backgroundColor: onPhoto ? `${Colors.common.black}66` : t.color.border }]}>
                    <AppIcon name={card.kind === 'habit' ? 'repeat' : 'checkbox'} size={Spacing.md} color={ink} />
                    <RNText style={[t.type.caption, { color: ink }]}>{card.kind === 'habit' ? 'Habit' : 'Task'}</RNText>
                </View>
            ) : null}
            <RNText numberOfLines={2} style={[t.type.screenTitle, { color: ink }]}>{card.title}</RNText>
            {card.planned || card.took ? (
                <View style={styles.times}>
                    {card.planned ? <Fact label="Planned" value={card.planned} ink={ink} muted={muted} /> : null}
                    {card.took ? <Fact label="Took" value={card.took} ink={ink} muted={muted} /> : null}
                    {card.verdict ? (
                        <View style={[styles.verdict, { backgroundColor: verdictColor }]}>
                            <RNText style={[t.type.caption, { color: textOn(verdictColor) }]}>{card.verdict.text}</RNText>
                        </View>
                    ) : null}
                </View>
            ) : null}
            {card.when ? <RNText style={[t.type.caption, { color: muted }]}>{card.when}</RNText> : null}
        </View>
    );

    if (onPhoto) {
        return (
            <View style={[styles.card, { width, height, backgroundColor: Colors.common.black }]}>
                <Image source={{ uri: card.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                <LinearGradient colors={[`${Colors.common.black}00`, `${Colors.common.black}D9`]} style={styles.fade} />
                <View style={styles.foot}>{info}</View>
            </View>
        );
    }
    return (
        <MatteSurface radius={Radius.card} elevation="floating" style={{ width, height }}>
            <View style={styles.face}>
                <View style={styles.centre}>
                    {card.figure ? (
                        <>
                            <View style={styles.figureRow}>
                                <RNText style={[t.type.screenTitle, styles.big, { color: t.color.textPrimary }]}>{card.figure.value}</RNText>
                                {card.figure.of ? <RNText style={[t.type.title, { color: t.color.textMuted }]}>{`/ ${card.figure.of}`}</RNText> : null}
                            </View>
                            <RNText style={[t.type.body, { color: t.color.textMuted }]}>
                                {[card.figure.unit, card.figure.source ? (card.figure.source === 'focused' ? 'focused' : `from ${card.figure.source}`) : null].filter(Boolean).join(' · ')}
                            </RNText>
                        </>
                    ) : (
                        <View style={[styles.tick, { backgroundColor: t.color.accent }]}>
                            <AppIcon name="checkmark" size={Spacing.section + Spacing.sm} color={textOn(t.color.accent)} />
                        </View>
                    )}
                </View>
                {info}
            </View>
        </MatteSurface>
    );
}

function Fact({ label, value, ink, muted }: { label: string; value: string; ink: string; muted: string }) {
    const t = useTokens();
    return (
        <View>
            <RNText style={[t.type.caption, { color: muted }]}>{label}</RNText>
            <RNText style={[t.type.heading, { color: ink }]}>{value}</RNText>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { borderRadius: Radius.card, overflow: 'hidden' },
    fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    foot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.xl },
    face: { flex: 1, padding: Spacing.xl, justifyContent: 'space-between' },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
    figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    big: { fontSize: 44, lineHeight: 52 },
    tick: { width: Spacing.section * 3, height: Spacing.section * 3, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    info: { gap: Spacing.sm },
    kind: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
    times: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xl },
    verdict: { marginLeft: 'auto', paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
});

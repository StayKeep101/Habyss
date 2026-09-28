import React, { useEffect, useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
    Easing, FadeIn, LinearTransition, ReduceMotion, useAnimatedProps, useAnimatedStyle,
    useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { LOOK, describeDay } from '@/lib/proof';
import { NOTE_LIMIT, type DayNote } from '@/lib/dayNotes';
import type { DayCard as Card } from '@/lib/feed';
import type { ReactionType } from '@/lib/friendsService';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE = { duration: 640, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
/** Timed, never sprung: the card grows a composer and a spring would bounce it. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);

export const REACTIONS: { id: ReactionType; glyph: string; label: string }[] = [
    { id: 'fire', glyph: '🔥', label: 'Fire' },
    { id: 'clap', glyph: '👏', label: 'Respect' },
    { id: 'muscle', glyph: '💪', label: 'Strong' },
    { id: 'heart', glyph: '❤️', label: 'Love' },
    { id: 'star', glyph: '⭐', label: 'Star' },
];

/**
 * One person's day.
 *
 * This is what replaced the leaderboard. A ranked table answers "who is
 * winning", which is the wrong question about habits — it rewards whoever
 * tracks the least demanding things, and it makes a bad week public. A card
 * answers "what did they do today", which is the thing you would actually ask,
 * and it lets a quiet day be quiet rather than last.
 *
 * The ring is the day itself, drawn the same way as the profile ring on Home,
 * so the shape means the same thing wherever it appears. It turns green the
 * moment the day closes.
 */
export const DayCard: React.FC<{
    card: Card;
    reaction?: ReactionType;
    onReact: (reaction: ReactionType) => void;
    onOpen: () => void;
    /** Notes already on this day, oldest first. */
    notes?: DayNote[];
    onComment?: (text: string) => void;
    onDeleteNote?: (id: string) => void;
}> = ({ card, reaction, onReact, onOpen, notes = [], onComment, onDeleteNote }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();

    const size = s(52);
    const stroke = s(3);
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    const filled = useSharedValue(0);
    useEffect(() => { filled.value = withTiming(card.share, EASE); }, [card.share, filled]);
    const ring = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - filled.value) }));

    const look = LOOK[card.evidence];
    const tint = card.complete ? colors.success : primary;
    const [writing, setWriting] = useState(false);
    const [draft, setDraft] = useState('');

    const send = () => {
        if (!draft.trim()) { setWriting(false); Keyboard.dismiss(); return; }
        onComment?.(draft);
        setDraft('');
        Keyboard.dismiss();
    };

    return (
        <Animated.View layout={MORPH}>
        <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={[styles.card, isLight && { backgroundColor: colors.surfaceSecondary }]}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${card.username}. ${card.line}`}
                onPress={onOpen}
                style={styles.top}
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
                    <View style={[styles.avatar, {
                        width: size - stroke * 2 - s(3), height: size - stroke * 2 - s(3),
                        borderRadius: (size - stroke * 2 - s(3)) / 2,
                        margin: stroke + s(1.5), backgroundColor: colors.background,
                    }]}>
                        {card.avatarUrl ? (
                            <Image source={{ uri: card.avatarUrl }} style={styles.photo} />
                        ) : (
                            <Text style={[styles.initial, { color: primary }]}>
                                {card.username.slice(0, 1).toUpperCase()}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.who}>
                    <View style={styles.nameRow}>
                        <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>
                            {card.isYou ? 'You' : card.username}
                        </Text>
                        {card.streak > 1 ? (
                            <View style={styles.streak}>
                                <Ionicons name="flame" size={s(11)} color="#F59E0B" />
                                <Text style={[styles.streakText, { color: '#F59E0B' }]}>{card.streak}</Text>
                            </View>
                        ) : null}
                    </View>
                    <Text numberOfLines={1} style={[styles.line, { color: colors.textSecondary }]}>{card.line}</Text>
                </View>

                {/* What kind of claim this day is. Quiet by design: most days
                    are taken on someone's word, and that is fine. */}
                {card.done > 0 ? (
                    <View style={[styles.proof, {
                        borderColor: card.evidence === 'self' ? colors.border : tint + '55',
                        backgroundColor: card.evidence === 'self' ? 'transparent' : tint + '14',
                    }]}>
                        <Ionicons
                            name={look.icon}
                            size={s(11)}
                            color={card.evidence === 'self' ? colors.textTertiary : tint}
                        />
                        <Text style={[styles.proofText, { color: card.evidence === 'self' ? colors.textTertiary : tint }]}>
                            {/* Counted, not crowned: one verified run among nine
                                ticks is a different day from nine verified runs,
                                and a single badge reads the same for both. */}
                            {describeDay(card.evidenceAll)}
                        </Text>
                    </View>
                ) : null}
            </Pressable>

            {/* Reacting is the whole interaction. It has to be one tap, and it
                has to be visible that it landed. */}
            <View style={[styles.reactions, { borderTopColor: colors.border }]}>
                {REACTIONS.map(item => (
                    <Reaction
                        key={item.id}
                        glyph={item.glyph}
                        label={item.label}
                        chosen={reaction === item.id}
                        accent={primary}
                        onPress={() => { selectionFeedback(); onReact(item.id); }}
                    />
                ))}
                {/* The other half of it. Five emoji cannot ask "how was the
                    long run" — a word can, so the row ends with one. */}
                {onComment ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={notes.length ? `Say something · ${notes.length} already said` : 'Say something'}
                        accessibilityState={{ expanded: writing }}
                        hitSlop={6}
                        onPress={() => { selectionFeedback(); setWriting(!writing); }}
                        style={styles.reactionPress}
                    >
                        <Ionicons name={writing ? 'chatbubble' : 'chatbubble-outline'} size={ms(17)}
                            color={writing || notes.length ? primary : colors.textTertiary} />
                        {notes.length ? (
                            <Text style={[styles.noteCount, { color: primary }]}>{notes.length}</Text>
                        ) : null}
                    </Pressable>
                ) : null}
            </View>

            {notes.length ? (
                <Animated.View layout={MORPH} style={[styles.notes, { borderTopColor: colors.border }]}>
                    {notes.map(note => (
                        <Animated.View key={note.id} entering={FadeIn.duration(160)} layout={MORPH} style={styles.note}>
                            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                                <Text style={{ color: colors.textPrimary, fontFamily: FontFamily.semibold }}>
                                    {/* A note on your own day was written by a
                                        friend, so the name comes with it. */}
                                    {note.mine ? 'You' : (note.authorName ?? card.username)}
                                </Text>
                                {`  ${note.text}`}
                                {/* Said, but not yet arrived. Quiet: it will. */}
                                {note.pending ? (
                                    <Text style={{ color: colors.textTertiary }}>  · sending</Text>
                                ) : null}
                            </Text>
                            {note.mine && onDeleteNote ? (
                                <Pressable accessibilityRole="button" accessibilityLabel="Take that back" hitSlop={8}
                                    onPress={() => onDeleteNote(note.id)}>
                                    <Ionicons name="close" size={ms(12)} color={colors.textTertiary} />
                                </Pressable>
                            ) : null}
                        </Animated.View>
                    ))}
                </Animated.View>
            ) : null}

            {writing && onComment ? (
                <Animated.View layout={MORPH} entering={FadeIn.duration(160)}
                    style={[styles.composer, { borderTopColor: colors.border }]}>
                    <TextInput
                        autoFocus
                        value={draft}
                        onChangeText={setDraft}
                        placeholder={card.isYou ? 'A note for your own day' : `Say something to ${card.username}`}
                        placeholderTextColor={colors.textTertiary}
                        maxLength={NOTE_LIMIT}
                        returnKeyType="send"
                        onSubmitEditing={send}
                        accessibilityLabel="Your note"
                        style={[styles.input, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                        }]}
                    />
                    <Pressable accessibilityRole="button" accessibilityLabel="Send the note"
                        disabled={!draft.trim()} onPress={send}
                        style={[styles.send, { backgroundColor: draft.trim() ? primary : 'transparent', borderColor: colors.border }]}>
                        <Ionicons name="arrow-up" size={ms(15)} color={draft.trim() ? '#fff' : colors.textTertiary} />
                    </Pressable>
                </Animated.View>
            ) : null}
        </VoidCard>
        </Animated.View>
    );
};

/** One emoji, which springs when it is the one you picked. */
const Reaction: React.FC<{
    glyph: string; label: string; chosen: boolean; accent: string; onPress: () => void;
}> = ({ glyph, label, chosen, accent, onPress }) => {
    const pop = useSharedValue(chosen ? 1 : 0);
    useEffect(() => {
        pop.value = chosen
            ? withSpring(1, { damping: 11, stiffness: 240, reduceMotion: ReduceMotion.System })
            : withTiming(0, { duration: 160, reduceMotion: ReduceMotion.System });
    }, [chosen, pop]);

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: 1 + pop.value * 0.22 }],
        opacity: 0.55 + pop.value * 0.45,
    }));
    const halo = useAnimatedStyle(() => ({ opacity: pop.value }));

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            accessibilityLabel={label}
            hitSlop={6}
            onPress={onPress}
            style={styles.reactionPress}
        >
            <Animated.View style={[styles.halo, halo, { backgroundColor: accent + '22' }]} />
            <Animated.Text style={[styles.glyph, style]}>{glyph}</Animated.Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    card: { padding: 0, overflow: 'hidden' },
    top: { flexDirection: 'row', alignItems: 'center', gap: s(13), padding: s(15) },
    avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    initial: { fontSize: ms(20), fontFamily: FontFamily.bold },
    who: { flex: 1, gap: vs(2) },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: s(7) },
    name: { flexShrink: 1, fontSize: ms(16), fontFamily: FontFamily.semibold },
    streak: { flexDirection: 'row', alignItems: 'center', gap: s(2) },
    streakText: { fontSize: ms(11), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    line: { fontSize: ms(12), fontFamily: FontFamily.regular },
    proof: {
        flexDirection: 'row', alignItems: 'center', gap: s(4),
        paddingHorizontal: s(8), paddingVertical: vs(4),
        borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
    },
    proofText: { fontSize: ms(10), fontFamily: FontFamily.medium },
    reactions: {
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: vs(8),
    },
    reactionPress: { paddingHorizontal: s(10), paddingVertical: vs(4), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: s(3) },
    noteCount: { fontSize: ms(11), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    notes: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: s(15), paddingVertical: vs(8), gap: vs(6) },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: s(8) },
    noteText: { flex: 1, fontSize: ms(12), lineHeight: ms(17), fontFamily: FontFamily.regular },
    composer: { flexDirection: 'row', alignItems: 'center', gap: s(8), borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: s(15), paddingVertical: vs(9) },
    input: { flex: 1, minHeight: vs(38), borderWidth: StyleSheet.hairlineWidth, borderRadius: s(12), paddingHorizontal: s(12), fontSize: ms(13), fontFamily: FontFamily.regular },
    send: { width: s(38), height: s(38), borderRadius: s(19), borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: s(34), height: s(34), borderRadius: s(17) },
    glyph: { fontSize: ms(20) },
});

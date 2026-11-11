import React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { CountUp, PopIn } from '@/components/ui/Motion';
import { LevelCard } from './LevelCard';
import { MarksBackdrop } from './MarksBackdrop';
import { StatusBadge } from '@/components/Community/StatusBadge';
import { STATUS_LABEL, type FriendStatus } from '@/lib/presence';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useCachedImage } from '@/hooks/useCachedImage';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { IconTile } from '@/components/ui/IconTile';
import { textOn, tint } from '@/theme/tokens';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';

/** A bio is a line or two, not an essay. */
const BIO_MAX = 120;

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/** The numbers every profile shows, yours and a friend's alike. */
export interface ProfileNumbers {
    streak: number;
    bestStreak: number;
    goalsCompleted: number;
}

/**
 * A profile, whoever it belongs to.
 *
 * The same page for you and for a friend, which is the point: what you see of
 * yourself should be what they see of you, or the page is quietly lying about
 * one of the two. The only difference is whether the fields can be typed in.
 *
 * Read-only is not a disabled version of the editable one — the placeholders,
 * the camera badges and the cover button all belong to the person whose profile
 * it is, and showing a friend a greyed-out "Add a cover image" would be
 * offering them something they cannot have.
 */
export const ProfileView: React.FC<{
    name: string;
    bio: string;
    meta: string;
    avatar?: string | null;
    initials: string;
    /** Their status, as a mark at the corner of their photo. */
    status?: FriendStatus;
    /** A line under the name and handle (a friend's status). */
    subline?: React.ReactNode;
    /** Absent when they keep their progress private. */
    numbers?: ProfileNumbers;
    /** What to say in place of the numbers when they are not shown. */
    hiddenNote?: string;
    /** Their Marks: shown as their level, above the numbers. */
    marks?: number;
    /** Their Marks (XP) over time, only ever climbing: the backdrop when there is no cover photo. */
    marksSeries?: number[];
    /** Absent for a friend's page: theirs is not yours to edit. */
    edit?: {
        onName: (value: string) => void;
        onNameDone: () => void;
        onBio: (value: string) => void;
        onBioDone: () => void;
        onPick: (which: 'avatar' | 'cover') => void;
        /** Hold a photo to take it off. */
        onRemove?: (which: 'avatar' | 'cover') => void;
    };
    /** Room to leave at the top for the status bar, on a full-screen page. */
    topInset?: number;
    /** Tapping "Goals done" opens the goals reached; without it the number is plain. */
    onGoalsDone?: () => void;
    /** Tapping a streak opens the Streak page (yours only). */
    onStreak?: () => void;
    /** Anything the page wants under the numbers. */
    children?: React.ReactNode;
}> = ({ name, bio, meta, avatar, initials, status, subline, numbers, hiddenNote, marks, marksSeries, edit, topInset = 0, onGoalsDone, onStreak, children }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    // The banner, plus the half of the avatar that overlaps it.
    const coverHeight = topInset + vs(150) + s(48);
    // The photo from the phone's own copy, at once (lib/imageCache.ts).
    const avatarShown = useCachedImage(avatar);
    const [bioFocused, setBioFocused] = React.useState(false);


    return (
        <>
            <Animated.View entering={FadeIn.duration(220)} layout={MORPH} style={styles.head}>
                {/* The backdrop: the person's Marks over time, a line that only climbs (or a wash in
                    the accent colours before there is a history), fading into
                    the page. */}
                {/* It also reaches a full screen above the top, in the same
                    colour, so pulling the page down never shows an edge. */}
                <View pointerEvents="none" style={[styles.backdrop, { top: -screenHeight, height: screenHeight + coverHeight }]}>
                    {/* One wash in the accent, the same above the page and below its top,
                        so there is never an edge; the Marks line sits on it once there
                        is a history. */}
                    <View style={[styles.above, { height: screenHeight }]}>
                        <LinearGradient colors={[primary + '40', primary + '40']} style={StyleSheet.absoluteFill} />
                    </View>
                    <View style={[styles.below, { top: screenHeight }]}>
                        <LinearGradient colors={[primary + '40', primary + '10', 'transparent']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
                    </View>
                    {marksSeries && marksSeries.length > 1 ? (
                        <View style={[styles.graph, { top: screenHeight, height: coverHeight }]}>
                            <MarksBackdrop series={marksSeries} width={screenWidth} height={coverHeight} color={primary} />
                        </View>
                    ) : null}
                    {/* Fades into the page under the photo or graph — late, so the
                        graph above the avatar stays clear. */}
                    <View style={[styles.below, { top: screenHeight }]}>
                        <LinearGradient colors={['transparent', colors.background + '99', colors.background]}
                            locations={[0.7, 0.88, 1]} style={StyleSheet.absoluteFill} />
                    </View>
                </View>

                {/* The space the Marks chart shows through. */}
                <View style={[styles.banner, { height: topInset + vs(150) }]} />

                <Pressable
                    accessibilityRole={edit ? 'button' : 'image'}
                    accessibilityLabel={edit ? (avatar ? 'Change your picture' : 'Add a picture') : `${name}'s picture`}
                    disabled={!edit}
                    onPress={() => edit?.onPick('avatar')}
                    onLongPress={avatar && edit?.onRemove ? () => edit.onRemove?.('avatar') : undefined}
                    accessibilityHint={edit && avatar ? 'Hold to remove it' : undefined}
                    style={styles.avatarPress}
                >
                    {/* The ring is the page's own background, so the avatar
                        reads as sitting on the banner rather than in it. */}
                    <View style={[styles.avatar, { borderColor: colors.background, backgroundColor: colors.surfaceSecondary }]}>
                        {avatar ? (
                            <Image source={{ uri: avatarShown ?? avatar }} style={styles.photo} fadeDuration={0} />
                        ) : initials ? (
                            <Text style={[styles.initials, { color: primary }]}>{initials}</Text>
                        ) : (
                            <Ionicons name="person" size={s(34)} color={primary} />
                        )}
                    </View>
                    {edit ? (
                        // Outside the clipped circle, so it is never cut off.
                        <View style={[styles.camera, { backgroundColor: primary, borderColor: colors.background }]}>
                            <Ionicons name="camera" size={s(12)} color="#fff" />
                        </View>
                    ) : status ? (
                        // What they are doing now, at the corner of their photo.
                        <View style={[styles.status, { borderColor: colors.background, backgroundColor: colors.background }]}
                            accessible accessibilityLabel={STATUS_LABEL[status]}>
                            <StatusBadge status={status} size={s(26)} />
                        </View>
                    ) : null}
                </Pressable>

                <View style={styles.identityText}>
                    {edit ? (
                        <TextInput
                            value={name}
                            onChangeText={edit.onName}
                            onEndEditing={edit.onNameDone}
                            placeholder="Your name"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="Your name"
                            style={[styles.name, { color: colors.textPrimary }]}
                        />
                    ) : (
                        <Text style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
                    )}

                    {meta ? <Text style={[styles.meta, { color: colors.textTertiary }]}>{meta}</Text> : null}
                    {subline}

                    {edit ? (
                        // A sentence while you read it; a soft field behind it while
                        // you write it (drawn beside it, so the text never loses focus).
                        <View style={styles.bioWrap}>
                            {bioFocused ? (
                                <Animated.View entering={FadeIn.duration(150)} pointerEvents="none" style={StyleSheet.absoluteFill}>
                                    <MatteSurface radius={Radius.control} level="control" edge={primary} style={StyleSheet.absoluteFill} />
                                </Animated.View>
                            ) : null}
                            <TextInput
                                value={bio}
                                onChangeText={edit.onBio}
                                onFocus={() => setBioFocused(true)}
                                onBlur={() => setBioFocused(false)}
                                onEndEditing={edit.onBioDone}
                                placeholder="A line about what you are working on"
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                maxLength={BIO_MAX}
                                returnKeyType="done"
                                submitBehavior="blurAndSubmit"
                                accessibilityLabel="About you"
                                style={[styles.bio, styles.bioInput, { color: bioFocused ? colors.textPrimary : colors.textSecondary }]}
                            />
                            {bioFocused ? (
                                <Text style={[styles.bioCount, { color: colors.textTertiary }]}>{`${bio.length}/${BIO_MAX}`}</Text>
                            ) : null}
                        </View>
                    ) : bio ? (
                        <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text>
                    ) : null}
                </View>
            </Animated.View>

            {/* The rank on its own card, then three tiles of things to be proud
                of: the run going now, the best run, the goals reached. */}
            <View style={styles.statsBlock}>
                {marks !== undefined ? (
                    <VoidCard style={styles.card}>
                        <LevelCard marks={marks} />
                    </VoidCard>
                ) : null}
                {numbers ? (
                    <View style={styles.tiles}>
                        {[
                            { key: 'streak', label: 'Day streak', value: numbers.streak, icon: 'flame', color: colors.warning, lit: numbers.streak > 0, onPress: onStreak,
                                note: numbers.streak > 0 && numbers.streak >= numbers.bestStreak ? 'Best yet' : undefined },
                            { key: 'best', label: 'Best streak', value: numbers.bestStreak, icon: 'trophy', color: primary, lit: numbers.bestStreak > 0, onPress: onStreak },
                            { key: 'goals', label: 'Goals done', value: numbers.goalsCompleted, icon: 'flag', color: colors.success, lit: numbers.goalsCompleted > 0, onPress: onGoalsDone },
                        ].map((stat, index) => (
                            <PopIn key={stat.key} index={index} style={styles.tileSlot}>
                                <Pressable disabled={!stat.onPress} onPress={stat.onPress} style={({ pressed }) => [styles.tilePress, pressed && styles.pressed]}
                                    accessibilityRole={stat.onPress ? 'button' : undefined}
                                    accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()}${stat.note ? `, ${stat.note.toLowerCase()}` : ''}`}>
                                    <MatteSurface radius={Radius.card} tint={stat.key === 'streak' && stat.lit ? tint(stat.color, 'subtle') : undefined} style={styles.tile}>
                                        <IconTile icon={stat.icon} color={stat.color} size={s(30)} muted={!stat.lit} />
                                        <CountUp style={[styles.tileValue, { color: colors.textPrimary }]} value={stat.value} />
                                        <View style={styles.statLabelRow}>
                                            <Text numberOfLines={1} style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                                            {stat.onPress ? <Ionicons name="chevron-forward" size={s(11)} color={colors.textTertiary} /> : null}
                                        </View>
                                        {stat.note ? (
                                            <View style={[styles.note, { backgroundColor: stat.color }]}>
                                                <Text style={[styles.noteText, { color: textOn(stat.color) }]}>{stat.note}</Text>
                                            </View>
                                        ) : null}
                                    </MatteSurface>
                                </Pressable>
                            </PopIn>
                        ))}
                    </View>
                ) : (
                    <Text style={[styles.private, { color: colors.textTertiary }]}>{hiddenNote ?? 'Progress is private'}</Text>
                )}
            </View>

            {children}
        </>
    );
};

const styles = StyleSheet.create({
    // The banner runs to both edges, so the page's padding cannot apply to it.
    head: { alignItems: 'center', marginBottom: vs(4) },
    backdrop: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
    above: { position: 'absolute', top: 0, left: 0, right: 0 },
    below: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    banner: { width: '100%', justifyContent: 'flex-end', alignItems: 'flex-end' },
    graph: { position: 'absolute', left: 0, right: 0 },
    // Half on the banner, half off it: the overlap is what makes it a profile
    // rather than a photograph with a card under it.
    avatarPress: { width: s(96), height: s(96), marginTop: -s(48) },
    // The photo fills the circle; a thin edge in the page's own colour lifts it off the chart.
    avatar: { width: s(96), height: s(96), borderRadius: s(48), borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%', resizeMode: 'cover' },
    initials: { fontSize: ms(30), fontFamily: FontFamily.bold },
    status: { position: 'absolute', right: s(2), bottom: s(2), borderRadius: 999, borderWidth: 3, alignItems: 'center', justifyContent: 'center', minWidth: s(26), minHeight: s(26) },
    camera: { position: 'absolute', right: 0, bottom: 0, width: s(28), height: s(28), borderRadius: s(14), borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    identityText: { alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: s(24), gap: vs(2) },
    name: { fontSize: ms(24), fontFamily: FontFamily.bold, paddingVertical: 0, textAlign: 'center', alignSelf: 'stretch' },
    meta: { fontSize: ms(12), fontFamily: FontFamily.regular },
    // No box: a bio reads as a sentence about someone, not as a filled field.
    bio: { alignSelf: 'stretch', fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.regular, textAlign: 'center', paddingTop: vs(6) },
    bioWrap: { alignSelf: 'stretch', marginTop: vs(6) },
    bioInput: { paddingTop: vs(10), paddingBottom: vs(10), paddingHorizontal: s(14) },
    bioCount: { position: 'absolute', right: s(12), bottom: -vs(18), fontSize: ms(11), fontFamily: FontFamily.regular, fontVariant: ['tabular-nums'] },
    statsBlock: { marginHorizontal: s(20), marginTop: vs(16), gap: vs(12) },
    card: { padding: s(20) },
    tiles: { flexDirection: 'row', gap: s(10) },
    tileSlot: { flex: 1 },
    tilePress: { flex: 1 },
    pressed: { opacity: 0.7 },
    tile: { flex: 1, padding: s(14), gap: vs(6), minHeight: 44 },
    tileValue: { fontSize: ms(28), lineHeight: ms(34), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], marginTop: vs(4) },
    statLabel: { fontSize: ms(12), fontFamily: FontFamily.medium, flexShrink: 1 },
    statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: s(2) },
    note: { position: 'absolute', top: s(12), right: s(10), borderRadius: 999, paddingHorizontal: s(6), paddingVertical: 1 },
    noteText: { fontSize: ms(11), fontFamily: FontFamily.bold },
    private: { fontSize: ms(13), fontFamily: FontFamily.regular, textAlign: 'center', paddingVertical: vs(12) },
});

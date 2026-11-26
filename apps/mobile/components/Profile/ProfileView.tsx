import React from 'react';
import { HomeStatCard } from '@/components/Home/HomeStatCard';
import { Image, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { MarksBackdrop } from './MarksBackdrop';
import { StatusBadge } from '@/components/Community/StatusBadge';
import { STATUS_LABEL, type FriendStatus } from '@/lib/presence';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useCachedImage } from '@/hooks/useCachedImage';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
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
    /** Tapping a streak opens the Streak page (yours only). */
    onStreak?: () => void;
    /** Streak freezes held (yours only): a small snowflake on the streak tile that opens them. */
    freezes?: { count: number; onPress: () => void };
    /** Under the name and bio: Following and Followers (yours). */
    social?: React.ReactNode;
    /** Anything the page wants under the numbers. */
    children?: React.ReactNode;
}> = ({ name, bio, meta, avatar, initials, status, subline, numbers, hiddenNote, marks, marksSeries, edit, topInset = 0, onStreak, freezes, social, children }) => {
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
                    {/* The run going now, as on Home: the flame and the number beside it
                        (tap for the Streak page); your freezes the same way beside it. */}
                    <View style={styles.statsBlock}>
                        {numbers ? (
                            <View style={styles.stats}>
                                <HomeStatCard icon="flame" tint={numbers.streak > 0 ? colors.warning : colors.textTertiary} value={numbers.streak}
                                    onPress={onStreak ?? (() => undefined)}
                                    accessibilityLabel={`${numbers.streak} day streak${numbers.streak > 0 && numbers.streak >= numbers.bestStreak ? ', your best yet' : ''}${onStreak ? '. Open your streak.' : ''}`} />
                                {freezes ? (
                                    <HomeStatCard icon="snow" tint={primary} value={freezes.count} onPress={freezes.onPress}
                                        accessibilityLabel={`${freezes.count} streak freeze${freezes.count === 1 ? '' : 's'}`} />
                                ) : null}
                            </View>
                        ) : (
                            <Text style={[styles.private, { color: colors.textTertiary }]}>{hiddenNote ?? 'Progress is private'}</Text>
                        )}
                    </View>
                    {social}
                </View>
            </Animated.View>

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
    // Between the name and Following · Followers.
    statsBlock: { marginTop: Spacing.sm, alignSelf: 'stretch' },
    // Centred under the profile, spaced like Home's header stats.
    stats: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl },
    card: { padding: s(20) },
    private: { fontSize: ms(13), fontFamily: FontFamily.regular, textAlign: 'center', paddingVertical: vs(12) },
});

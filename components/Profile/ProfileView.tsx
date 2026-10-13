import React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

export interface ProfileStat {
    label: string;
    value: string;
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
    cover?: string | null;
    initials: string;
    stats: ProfileStat[];
    /** Absent for a friend's page: theirs is not yours to edit. */
    edit?: {
        onName: (value: string) => void;
        onNameDone: () => void;
        onBio: (value: string) => void;
        onBioDone: () => void;
        onPick: (which: 'avatar' | 'cover') => void;
    };
    /** Anything the page wants under the numbers. */
    children?: React.ReactNode;
}> = ({ name, bio, meta, avatar, cover, initials, stats, edit, children }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary, secondary } = useAccentGradient();

    const surface = { glass: !isTrueDark, intensity: isLight ? 20 : 80 };
    const tint = isLight ? { backgroundColor: colors.surfaceSecondary } : null;

    const Cover = edit ? Pressable : View;

    return (
        <>
            <Animated.View entering={FadeIn.duration(220)} layout={MORPH} style={styles.head}>
                <Cover
                    {...(edit ? {
                        accessibilityRole: 'button' as const,
                        accessibilityLabel: cover ? 'Change your cover image' : 'Add a cover image',
                        onPress: () => edit.onPick('cover'),
                    } : {})}
                    style={styles.banner}
                >
                    {cover ? (
                        <Image source={{ uri: cover }} style={styles.bannerImage} />
                    ) : (
                        // No cover: the accent wash the rest of the app is drawn
                        // with, rather than an empty grey rectangle.
                        <LinearGradient
                            colors={[primary + 'CC', secondary + '55', 'transparent']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    )}
                    {edit ? (
                        <View style={[styles.coverBadge, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                            <Ionicons name="image-outline" size={s(12)} color="#fff" />
                            <Text style={styles.coverBadgeText}>{cover ? 'Change' : 'Add cover'}</Text>
                        </View>
                    ) : null}
                </Cover>

                <Pressable
                    accessibilityRole={edit ? 'button' : 'image'}
                    accessibilityLabel={edit ? (avatar ? 'Change your picture' : 'Add a picture') : `${name}'s picture`}
                    disabled={!edit}
                    onPress={() => edit?.onPick('avatar')}
                    style={styles.avatarPress}
                >
                    {/* The ring is the page's own background, so the avatar
                        reads as sitting on the banner rather than in it. */}
                    <View style={[styles.avatar, { borderColor: colors.background, backgroundColor: isLight ? colors.surfaceSecondary : '#101218' }]}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.photo} />
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

                    <Text style={[styles.meta, { color: colors.textTertiary }]}>{meta}</Text>

                    {edit ? (
                        <TextInput
                            value={bio}
                            onChangeText={edit.onBio}
                            onEndEditing={edit.onBioDone}
                            placeholder="A line about what you are working on"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            accessibilityLabel="About you"
                            style={[styles.bio, { color: colors.textSecondary }]}
                        />
                    ) : bio ? (
                        <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text>
                    ) : null}
                </View>
            </Animated.View>

            <Text style={[styles.section, { color: colors.textTertiary }]}>WHAT YOU HAVE BUILT</Text>
            {/* Three to a row, whichever numbers the page has to show. */}
            {Array.from({ length: Math.ceil(stats.length / 3) }, (_, row) => (
                <View key={row} style={styles.stats}>
                    {stats.slice(row * 3, row * 3 + 3).map(stat => (
                        <VoidCard key={stat.label} {...surface} style={[styles.stat, tint]}>
                            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{stat.label}</Text>
                        </VoidCard>
                    ))}
                </View>
            ))}

            {children}
        </>
    );
};

const styles = StyleSheet.create({
    // The banner runs to both edges, so the page's padding cannot apply to it.
    head: { alignItems: 'center', marginBottom: vs(4) },
    banner: { width: '100%', height: vs(124), overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'flex-end' },
    bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    coverBadge: { flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(9), paddingVertical: vs(4), borderRadius: 999, margin: s(10) },
    coverBadgeText: { color: '#fff', fontSize: ms(10), fontFamily: FontFamily.medium },
    // Half on the banner, half off it: the overlap is what makes it a profile
    // rather than a photograph with a card under it.
    avatarPress: { width: s(96), height: s(96), marginTop: -s(48) },
    avatar: { width: s(96), height: s(96), borderRadius: s(48), borderWidth: s(4), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    initials: { fontSize: ms(30), fontFamily: FontFamily.bold },
    camera: { position: 'absolute', right: 0, bottom: 0, width: s(28), height: s(28), borderRadius: s(14), borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    identityText: { alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: s(24), gap: vs(2) },
    name: { fontSize: ms(24), fontFamily: FontFamily.bold, paddingVertical: 0, textAlign: 'center', alignSelf: 'stretch' },
    meta: { fontSize: ms(12), fontFamily: FontFamily.regular },
    // No box: a bio reads as a sentence about someone, not as a filled field.
    bio: { alignSelf: 'stretch', fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.regular, textAlign: 'center', paddingTop: vs(6) },
    section: { fontSize: ms(11), letterSpacing: 1.5, fontFamily: FontFamily.bold, marginTop: vs(10), marginHorizontal: s(20) },
    stats: { flexDirection: 'row', gap: s(10), marginHorizontal: s(20), marginTop: vs(8) },
    stat: { flex: 1, padding: s(14), alignItems: 'center', gap: vs(3) },
    statValue: { fontSize: ms(22), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: ms(10), fontFamily: FontFamily.medium, textAlign: 'center' },
});

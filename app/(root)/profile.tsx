import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptics } from '@/hooks/useHaptics';
import { useHistory } from '@/hooks/useHistory';
import { useTasks } from '@/hooks/useTasks';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { momentum } from '@/lib/momentum';
import { streakFrom } from '@/lib/dayComplete';
import { localDateKey } from '@/lib/habitSchedule';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { recovery } from '@/lib/recovery';
import { EMPTY_PROFILE, ageFrom, getProfile, initials, saveProfile, type Profile } from '@/lib/profile';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/** Loaded lazily: a build without the picker should still show the page. */
let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch { ImagePicker = null; }

/**
 * You, as the rest of the app has you.
 *
 * The pieces existed behind a Save button in Settings, which is the wrong
 * shape for something people change one field at a time and want to look at
 * more than they want to edit. Here the page *is* the profile: it shows what a
 * friend would see, and every part of it is editable where it sits.
 *
 * Nothing has to be saved. A field writes when you finish with it, because a
 * profile is not a form and a name you typed should not be lost to a back
 * button.
 */
export default function ProfileScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary, secondary } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();

    const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let alive = true;
        getProfile().then(found => { if (alive) { setProfile(found); setLoaded(true); } });
        return () => { alive = false; };
    }, []);

    /** Optimistic: the field shows what you typed and writes behind you. */
    const change = useCallback((patch: Partial<Profile>) => {
        setProfile(current => ({ ...current, ...patch }));
        void saveProfile(patch);
    }, []);

    const [habits, setHabits] = useState<Habit[]>([]);
    useEffect(() => {
        let stop: (() => void) | undefined;
        subscribeToHabits(setHabits).then(unsubscribe => { stop = unsubscribe; }).catch(() => undefined);
        return () => stop?.();
    }, []);

    const tasks = useTasks();
    const target = useDailyTarget();
    const { rows: history } = useHistory(90);
    // The same streak the home screen and the day card show — one definition.
    const streak = React.useMemo(() => {
        const today = localDateKey(new Date());
        const done: Record<string, string[]> = {};
        const skips: Record<string, string[]> = {};
        for (const row of history) {
            done[row.date] = row.completedIds;
            if (row.skippedIds?.length) skips[row.date] = row.skippedIds;
        }
        return streakFrom(habits, tasks, done, skips, today, 70, target).streak;
    }, [habits, tasks, history, target]);

    const trend = React.useMemo(() => momentum(habits, history, {}, 30), [habits, history]);
    const bounce = React.useMemo(() => recovery(habits, history, {}, 90), [habits, history]);

    const surface = { glass: !isTrueDark, intensity: isLight ? 20 : 80 };
    const tint = isLight ? { backgroundColor: colors.surfaceSecondary } : null;

    /** One picker for both images; the crop is what tells them apart. */
    const pickPhoto = async (which: 'avatar' | 'cover') => {
        if (!ImagePicker) { Alert.alert('Not available', 'Photos need the full app build.'); return; }
        lightFeedback();
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Photos are off', 'Habyss needs access to your photos to set a picture.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'], allowsEditing: true,
                aspect: which === 'cover' ? [16, 9] : [1, 1], quality: 0.7,
            });
            if (!result.canceled && result.assets?.[0]?.uri) change({ [which]: result.assets[0].uri });
        } catch {
            Alert.alert('Could not open your photos', 'Please try again.');
        }
    };

    const removePhoto = (which: 'avatar' | 'cover') => {
        selectionFeedback();
        change({ [which]: null });
    };

    const age = profile.birthday ? ageFrom(profile.birthday) : null;
    const finished = tasks.filter(task => task.status === 'done').length;
    const tracked = habits.filter(habit => !habit.isGoal && !habit.isArchived).length;

    return (
        <SheetScreen title="Profile" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* A banner, the avatar across its edge, the name under it.
                    A profile is a thing people look at before they read it, so
                    the picture leads and the fields sit where a friend's eye
                    already goes. Everything is still editable in place. */}
                <Animated.View entering={FadeIn.duration(220)} layout={MORPH} style={styles.head}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={profile.cover ? 'Change your cover image' : 'Add a cover image'}
                        onPress={() => void pickPhoto('cover')}
                        style={styles.banner}
                    >
                        {profile.cover ? (
                            <Image source={{ uri: profile.cover }} style={styles.bannerImage} />
                        ) : (
                            // No cover: the accent wash the rest of the app is
                            // drawn with, rather than an empty grey rectangle.
                            <LinearGradient
                                colors={[primary + 'CC', secondary + '55', 'transparent']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                        )}
                        <View style={[styles.coverBadge, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                            <Ionicons name="image-outline" size={s(12)} color="#fff" />
                            <Text style={styles.coverBadgeText}>{profile.cover ? 'Change' : 'Add cover'}</Text>
                        </View>
                    </Pressable>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={profile.avatar ? 'Change your picture' : 'Add a picture'}
                        onPress={() => void pickPhoto('avatar')}
                        style={styles.avatarPress}
                    >
                        {/* The ring is the page's own background, so the avatar
                            reads as sitting on the banner rather than in it. */}
                        <View style={[styles.avatar, { borderColor: colors.background, backgroundColor: isLight ? colors.surfaceSecondary : '#101218' }]}>
                            {profile.avatar ? (
                                <Image source={{ uri: profile.avatar }} style={styles.photo} />
                            ) : initials(profile) ? (
                                <Text style={[styles.initials, { color: primary }]}>{initials(profile)}</Text>
                            ) : (
                                <Ionicons name="person" size={s(34)} color={primary} />
                            )}
                        </View>
                        {/* Outside the clipped circle, so it is never cut off. */}
                        <View style={[styles.camera, { backgroundColor: primary, borderColor: colors.background }]}>
                            <Ionicons name="camera" size={s(12)} color="#fff" />
                        </View>
                    </Pressable>

                    <View style={styles.identityText}>
                        <TextInput
                            value={profile.name}
                            onChangeText={name => setProfile(current => ({ ...current, name }))}
                            onEndEditing={() => change({ name: profile.name.trim() })}
                            placeholder="Your name"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="Your name"
                            style={[styles.name, { color: colors.textPrimary }]}
                        />
                        <Text style={[styles.meta, { color: colors.textTertiary }]}>
                            {[tracked ? `${tracked} habit${tracked === 1 ? '' : 's'}` : null, age ? `${age}` : null]
                                .filter(Boolean).join(' · ') || 'Nothing tracked yet'}
                        </Text>
                        <TextInput
                            value={profile.bio}
                            onChangeText={bio => setProfile(current => ({ ...current, bio }))}
                            onEndEditing={() => change({ bio: profile.bio.trim() })}
                            placeholder="A line about what you are working on"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            accessibilityLabel="About you"
                            style={[styles.bio, { color: colors.textSecondary }]}
                        />
                        {profile.avatar || profile.cover ? (
                            <View style={styles.removeRow}>
                                {profile.avatar ? (
                                    <Pressable accessibilityRole="button" onPress={() => removePhoto('avatar')}>
                                        <Text style={[styles.removeText, { color: colors.textTertiary }]}>Remove picture</Text>
                                    </Pressable>
                                ) : null}
                                {profile.cover ? (
                                    <Pressable accessibilityRole="button" onPress={() => removePhoto('cover')}>
                                        <Text style={[styles.removeText, { color: colors.textTertiary }]}>Remove cover</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        ) : null}
                    </View>
                </Animated.View>

                {/* The numbers a friend would be shown, read from the same
                    place the home screen reads them. */}
                {/* What a friend would be shown. The streak leads because it
                    is the number people actually ask each other about. */}
                <Text style={[styles.section, { color: colors.textTertiary }]}>WHAT YOU HAVE BUILT</Text>
                <View style={styles.stats}>
                    <Stat label="Day streak" value={`${streak}`} colors={colors} surface={surface} tint={tint} />
                    <Stat label="Momentum" value={`${trend.rate}%`} colors={colors} surface={surface} tint={tint} />
                    <Stat
                        label="Recovery"
                        value={bounce.rate === null ? '—' : `${bounce.rate}%`}
                        colors={colors} surface={surface} tint={tint}
                    />
                </View>
                <View style={styles.stats}>
                    <Stat label="Habits" value={`${tracked}`} colors={colors} surface={surface} tint={tint} />
                    <Stat label="Finished" value={`${finished}`} colors={colors} surface={surface} tint={tint} />
                    <Stat label="Best run" value={`${bounce.recovered}`} colors={colors} surface={surface} tint={tint} />
                </View>

                {!loaded ? null : (
                    <Text style={[styles.footnote, { color: colors.textTertiary }]}>
                        This is what a friend sees. Settings live in the Settings tab.
                    </Text>
                )}
            </ScrollView>
        </SheetScreen>
    );
}

const Stat = ({ label, value, colors, surface, tint }: {
    label: string; value: string; colors: typeof Colors.light; surface: object; tint: object | null;
}) => (
    <VoidCard {...surface} style={[styles.stat, tint]}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </VoidCard>
);

const styles = StyleSheet.create({
    // The banner runs to both edges, so the page's padding cannot apply to it.
    content: { paddingBottom: vs(40), gap: vs(12) },
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
    removeRow: { flexDirection: 'row', gap: s(16), paddingTop: vs(4) },
    removeText: { fontSize: ms(12), fontFamily: FontFamily.medium },
    section: { fontSize: ms(11), letterSpacing: 1.5, fontFamily: FontFamily.bold, marginTop: vs(10), marginHorizontal: s(20) },
    stats: { flexDirection: 'row', gap: s(10), marginHorizontal: s(20) },
    stat: { flex: 1, padding: s(14), alignItems: 'center', gap: vs(3) },
    statValue: { fontSize: ms(22), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: ms(10), fontFamily: FontFamily.medium },
    links: { padding: 0, gap: 0 },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: s(46) },
    datePicker: { alignItems: 'center', paddingBottom: vs(6) },
    link: { flexDirection: 'row', alignItems: 'center', gap: s(12), paddingHorizontal: s(16), paddingVertical: vs(14) },
    linkText: { flex: 1, gap: vs(1) },
    linkLabel: { fontSize: ms(15), fontFamily: FontFamily.regular },
    linkDetail: { fontSize: ms(11), fontFamily: FontFamily.regular },
    footnote: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular, textAlign: 'center', marginTop: vs(8), marginHorizontal: s(20) },
});

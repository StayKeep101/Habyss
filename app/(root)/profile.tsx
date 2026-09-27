import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useHaptics } from '@/hooks/useHaptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChipPicker } from '@/components/Common/ChipPicker';
import { useHistory } from '@/hooks/useHistory';
import { useTasks } from '@/hooks/useTasks';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { momentum } from '@/lib/momentum';
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
    const { primary } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();

    const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
    const [loaded, setLoaded] = useState(false);
    const [pickingBirthday, setPickingBirthday] = useState(false);

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
    const { rows: history } = useHistory(90);
    const trend = React.useMemo(() => momentum(habits, history, {}, 30), [habits, history]);
    const bounce = React.useMemo(() => recovery(habits, history, {}, 90), [habits, history]);

    const surface = { glass: !isTrueDark, intensity: isLight ? 20 : 80 };
    const tint = isLight ? { backgroundColor: colors.surfaceSecondary } : null;

    const pickPhoto = async () => {
        if (!ImagePicker) { Alert.alert('Not available', 'Photos need the full app build.'); return; }
        lightFeedback();
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Photos are off', 'Habyss needs access to your photos to set a picture.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
            });
            if (!result.canceled && result.assets?.[0]?.uri) change({ avatar: result.assets[0].uri });
        } catch {
            Alert.alert('Could not open your photos', 'Please try again.');
        }
    };

    const removePhoto = () => {
        selectionFeedback();
        change({ avatar: null });
    };

    const age = profile.birthday ? ageFrom(profile.birthday) : null;
    const finished = tasks.filter(task => task.status === 'done').length;
    const tracked = habits.filter(habit => !habit.isGoal && !habit.isArchived).length;

    return (
        <SheetScreen title="Profile" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* What a friend sees. Everything here is editable in place. */}
                <Animated.View entering={FadeIn.duration(220)} layout={MORPH}>
                    <VoidCard {...surface} style={[styles.card, tint]}>
                        <View style={styles.identity}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={profile.avatar ? 'Change your picture' : 'Add a picture'}
                                onPress={() => void pickPhoto()}
                                style={styles.avatarPress}
                            >
                                <View style={[styles.avatar, { borderColor: primary + '55', backgroundColor: primary + '18' }]}>
                                    {profile.avatar ? (
                                        <Image source={{ uri: profile.avatar }} style={styles.photo} />
                                    ) : initials(profile) ? (
                                        <Text style={[styles.initials, { color: primary }]}>{initials(profile)}</Text>
                                    ) : (
                                        <Ionicons name="person" size={s(30)} color={primary} />
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
                            </View>
                        </View>

                        <TextInput
                            value={profile.bio}
                            onChangeText={bio => setProfile(current => ({ ...current, bio }))}
                            onEndEditing={() => change({ bio: profile.bio.trim() })}
                            placeholder="A line about what you are working on"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            accessibilityLabel="About you"
                            style={[styles.bio, {
                                color: colors.textSecondary, borderColor: colors.border,
                                backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                            }]}
                        />

                        {profile.avatar ? (
                            <Pressable accessibilityRole="button" onPress={removePhoto} style={styles.remove}>
                                <Text style={[styles.removeText, { color: colors.textTertiary }]}>Remove picture</Text>
                            </Pressable>
                        ) : null}
                    </VoidCard>
                </Animated.View>

                {/* The numbers a friend would be shown, read from the same
                    place the home screen reads them. */}
                <Text style={[styles.section, { color: colors.textTertiary }]}>WHAT YOU HAVE BUILT</Text>
                <View style={styles.stats}>
                    <Stat label="Momentum" value={`${trend.rate}%`} colors={colors} surface={surface} tint={tint} />
                    <Stat
                        label="Recovery"
                        value={bounce.rate === null ? '—' : `${bounce.rate}%`}
                        colors={colors} surface={surface} tint={tint}
                    />
                    <Stat label="Finished" value={`${finished}`} colors={colors} surface={surface} tint={tint} />
                </View>

                {/* The rest of who you are. Optional, and never asked for
                    twice — this is the only place it is edited. */}
                <Text style={[styles.section, { color: colors.textTertiary }]}>DETAILS</Text>
                <VoidCard {...surface} style={[styles.card, tint, styles.links]}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={profile.birthday ? `Birthday, ${profile.birthday}` : 'Add your birthday'}
                        onPress={() => { lightFeedback(); setPickingBirthday(!pickingBirthday); }}
                        style={styles.link}
                    >
                        <Ionicons name="gift-outline" size={s(18)} color={colors.textTertiary} />
                        <Text style={[styles.linkLabel, styles.linkText, { color: colors.textPrimary }]}>Birthday</Text>
                        <Text style={[styles.linkDetail, { color: pickingBirthday ? primary : colors.textTertiary }]}>
                            {profile.birthday ?? 'Not set'}
                        </Text>
                    </Pressable>
                    {pickingBirthday ? (
                        <Animated.View layout={MORPH} style={styles.datePicker}>
                            <DateTimePicker
                                value={profile.birthday ? new Date(`${profile.birthday}T12:00:00`) : new Date(2000, 0, 1, 12)}
                                mode="date"
                                maximumDate={new Date()}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                themeVariant={isLight ? 'light' : 'dark'}
                                onChange={(_event, picked) => {
                                    if (Platform.OS !== 'ios') setPickingBirthday(false);
                                    if (!picked) return;
                                    const key = `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, '0')}-${String(picked.getDate()).padStart(2, '0')}`;
                                    change({ birthday: key });
                                }}
                            />
                        </Animated.View>
                    ) : null}

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <ChipPicker
                        options={[
                            { id: 'Male', label: 'Male' },
                            { id: 'Female', label: 'Female' },
                            { id: 'Other', label: 'Other' },
                            { id: 'Prefer not to say', label: 'Rather not say' },
                        ]}
                        value={profile.gender ?? 'Prefer not to say'}
                        onChange={gender => change({ gender })}
                        accent={primary}
                    />
                </VoidCard>

                <Text style={[styles.section, { color: colors.textTertiary }]}>MAKE IT YOURS</Text>
                <VoidCard {...surface} style={[styles.card, tint, styles.links]}>
                    <Link icon="color-palette-outline" label="Appearance" detail="Theme, accent and card size" onPress={() => router.push('/(root)/appearance')} colors={colors} />
                    <Link icon="sparkles-outline" label="Echo" detail="How the app talks to you" onPress={() => router.push('/(root)/ai-settings')} colors={colors} />
                    <Link icon="person-circle-outline" label="Account" detail="Sign in, backup and privacy" onPress={() => router.push('/(root)/account')} colors={colors} />
                </VoidCard>

                {!loaded ? null : (
                    <Text style={[styles.footnote, { color: colors.textTertiary }]}>
                        Your profile stays on this phone until you share it with a friend.
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

const Link = ({ icon, label, detail, onPress, colors }: {
    icon: never | string; label: string; detail: string; onPress: () => void; colors: typeof Colors.light;
}) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.link}>
        <Ionicons name={icon as never} size={s(18)} color={colors.textTertiary} />
        <View style={styles.linkText}>
            <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>{label}</Text>
            <Text style={[styles.linkDetail, { color: colors.textTertiary }]}>{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={s(16)} color={colors.textTertiary} />
    </Pressable>
);

const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(12) },
    card: { padding: s(18), gap: vs(14) },
    identity: { flexDirection: 'row', alignItems: 'center', gap: s(14) },
    avatarPress: { width: s(76), height: s(76) },
    avatar: { width: s(76), height: s(76), borderRadius: s(38), borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    initials: { fontSize: ms(26), fontFamily: FontFamily.bold },
    camera: { position: 'absolute', right: -2, bottom: -2, width: s(24), height: s(24), borderRadius: s(12), borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    identityText: { flex: 1, gap: vs(2) },
    name: { fontSize: ms(22), fontFamily: FontFamily.bold, paddingVertical: 0 },
    meta: { fontSize: ms(12), fontFamily: FontFamily.regular },
    bio: { minHeight: vs(56), borderWidth: StyleSheet.hairlineWidth, borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: vs(10), fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    remove: { alignSelf: 'flex-start' },
    removeText: { fontSize: ms(12), fontFamily: FontFamily.medium },
    section: { fontSize: ms(11), letterSpacing: 1.5, fontFamily: FontFamily.bold, marginTop: vs(10) },
    stats: { flexDirection: 'row', gap: s(10) },
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
    footnote: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular, textAlign: 'center', marginTop: vs(8) },
});

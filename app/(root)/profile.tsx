import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
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
import { ProfileView } from '@/components/Profile/ProfileView';


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
                {/* The same component a friend's profile uses. What you see
                    of yourself should be what they see of you, or the page is
                    quietly lying about one of the two. */}
                <ProfileView
                    name={profile.name}
                    bio={profile.bio}
                    meta={[tracked ? `${tracked} habit${tracked === 1 ? '' : 's'}` : null, age ? `${age}` : null]
                        .filter(Boolean).join(' · ') || 'Nothing tracked yet'}
                    avatar={profile.avatar}
                    cover={profile.cover}
                    initials={initials(profile)}
                    stats={[
                        { label: 'Day streak', value: `${streak}` },
                        { label: 'Momentum', value: `${trend.rate}%` },
                        { label: 'Recovery', value: bounce.rate === null ? '—' : `${bounce.rate}%` },
                        { label: 'Habits', value: `${tracked}` },
                        { label: 'Finished', value: `${finished}` },
                        { label: 'Best run', value: `${bounce.recovered}` },
                    ]}
                    edit={{
                        onName: name => setProfile(current => ({ ...current, name })),
                        onNameDone: () => change({ name: profile.name.trim() }),
                        onBio: bio => setProfile(current => ({ ...current, bio })),
                        onBioDone: () => change({ bio: profile.bio.trim() }),
                        onPick: which => void pickPhoto(which),
                    }}
                >
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
                </ProfileView>

                {!loaded ? null : (
                    <Text style={[styles.footnote, { color: colors.textTertiary }]}>
                        This is what a friend sees. Settings live in the Settings tab.
                    </Text>
                )}
            </ScrollView>
        </SheetScreen>
    );
}

const styles = StyleSheet.create({
    // The banner runs to both edges, so the page's padding cannot apply to it.
    content: { paddingBottom: vs(40), gap: vs(12) },
    // Half on the banner, half off it: the overlap is what makes it a profile
    // rather than a photograph with a card under it.
    // No box: a bio reads as a sentence about someone, not as a filled field.
    removeRow: { flexDirection: 'row', gap: s(16), paddingTop: vs(4) },
    removeText: { fontSize: ms(12), fontFamily: FontFamily.medium },
    footnote: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular, textAlign: 'center', marginTop: vs(8), marginHorizontal: s(20) },
});

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VoidShell } from '@/components/ui/VoidShell';
import { IconButton } from '@/components/ui/IconButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useHistory } from '@/hooks/useHistory';
import { useTasks } from '@/hooks/useTasks';
import { useData } from '@/hooks/useData';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { momentum } from '@/lib/momentum';
import { streakFrom } from '@/lib/dayComplete';
import { localDateKey } from '@/lib/habitSchedule';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { recovery } from '@/lib/recovery';
import { EMPTY_PROFILE, ageFrom, getProfile, initials, saveProfile, type Profile } from '@/lib/profile';
import { ProfileView } from '@/components/Profile/ProfileView';
import { styles } from '@/styles/screens/profile.styles';


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

    const insets = useSafeAreaInsets();
    const [habits, setHabits] = useState<Habit[]>([]);
    useEffect(() => {
        let stop: (() => void) | undefined;
        subscribeToHabits(setHabits).then(unsubscribe => { stop = unsubscribe; }).catch(() => undefined);
        return () => stop?.();
    }, []);

    const tasks = useTasks();
    const target = useDailyTarget();
    const { rows: history } = useHistory(90);
    const data = useData();
    // The same streak the home screen and the day card show — one definition,
    // over the whole shared history.
    const streak = React.useMemo(
        () => streakFrom(habits, tasks, data.history, data.skips, localDateKey(new Date()), undefined, target).streak,
        [habits, tasks, data.history, data.skips, target],
    );

    const trend = React.useMemo(() => momentum(habits, history, {}, 30), [habits, history]);
    const bounce = React.useMemo(() => recovery(habits, history, {}, 90), [habits, history]);


    /** One picker for both images; the crop is what tells them apart. */
    const pickPhoto = async (which: 'avatar' | 'cover') => {
        if (!ImagePicker) { Alert.alert('Not available', 'Photos need the full app build.'); return; }
        lightFeedback();
        try {
            // Straight to the system picker. It needs no library permission
            // (only the photo chosen is shared), and without a crop step iOS
            // opens its modern picker, which appears at once; the circle and
            // the backdrop crop the photo anyway.
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'], allowsEditing: false, quality: 0.7,
                preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
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
        <VoidShell>
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
                    topInset={insets.top}
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

            </ScrollView>
            {/* Floats over the backdrop, below the status bar: this is a
                full-screen page, not a sheet, so it clears the clock itself. */}
            <View style={[styles.back, { top: insets.top + 8 }]}>
                <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} diameter={40} size={24} />
            </View>
        </VoidShell>
    );
}

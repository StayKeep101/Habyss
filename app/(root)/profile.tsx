import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VoidShell } from '@/components/ui/VoidShell';
import { IconButton } from '@/components/ui/IconButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useData } from '@/hooks/useData';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { bestStreakFrom, streakFrom } from '@/lib/dayComplete';
import { localDateKey } from '@/lib/habitSchedule';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useMarks } from '@/hooks/useMarks';
import { useWallet } from '@/hooks/useWallet';
import { profileLine } from '@/lib/shards';
import { ageFrom, initials, saveProfile, type Profile } from '@/lib/profile';
import { useMyProfile } from '@/hooks/useMyProfile';
import { ProfileView } from '@/components/Profile/ProfileView';
import { FreezeCard } from '@/components/Profile/FreezeCard';
import { GoalsDoneSheet } from '@/components/Profile/GoalsDoneSheet';
import { UsernameCard, UsernameInline, UsernamePill } from '@/components/Profile/UsernameCard';
import { FeedService } from '@/lib/feedService';
import { getMyUsername } from '@/lib/friendsService';
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
    const { lightFeedback, selectionFeedback } = useHaptics();

    // The one profile store; only what is being typed right now is held here.
    const stored = useMyProfile();
    const [draft, setDraft] = useState<{ name?: string; bio?: string }>({});
    const profile: Profile = { ...stored, ...draft };

    /** Saved to the store (every screen updates at once), then the draft is dropped. */
    const change = useCallback((patch: Partial<Profile>) => {
        void saveProfile(patch).then(() => setDraft({}));
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
    const data = useData();
    // The same streak the home screen and the day card show — one definition,
    // over the whole shared history.
    const run = React.useMemo(
        () => streakFrom(habits, tasks, data.history, data.skips, localDateKey(new Date()), undefined, target),
        [habits, tasks, data.history, data.skips, target],
    );
    const streak = run.streak;
    const bestStreak = React.useMemo(() => bestStreakFrom(run.completedDates), [run.completedDates]);

    // The same Marks Home shows and friends see, as your level.
    const goalsData = useGoalsInsights();
    const marks = useMarks(goalsData);
    // Your wallet over the last sixty days: your profile's backdrop, as friends see it.
    const wallet = useWallet(marks);
    const walletSeries = React.useMemo(() => profileLine(wallet.timeline), [wallet.timeline]);
    // Goals finished: the trophies.
    const goalsCompleted = goalsData.finished.length;
    const [goalsOpen, setGoalsOpen] = useState(false);


    /** One picker for both images; the crop is what tells them apart. */
    const pickPhoto = async (which: 'avatar' | 'cover') => {
        if (!ImagePicker) { Alert.alert('Not available', 'Photos need the full app build.'); return; }
        lightFeedback();
        try {
            // A profile photo is framed in a square crop step, so it fills
            // its circle exactly and comes back as a real JPEG; without it the
            // whole photo (any shape, often HEIC) was used and could show bars.
            // A cover keeps the whole photo: it is framed to the top of the page.
            const result = await ImagePicker.launchImageLibraryAsync(which === 'avatar'
                ? { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 }
                : {
                    mediaTypes: ['images'], allowsEditing: false, quality: 0.8,
                    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
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
    const [myId, setMyId] = useState<string | null>(null);
    useEffect(() => { void FeedService.me().then(setMyId); }, []);
    // undefined while loading; null when there is none yet — then it is asked for.
    const [handle, setHandle] = useState<string | null | undefined>(undefined);
    const [editingHandle, setEditingHandle] = useState(false);
    useEffect(() => { void getMyUsername().then(found => setHandle(found ?? null)).catch(() => undefined); }, []);

    return (
        <VoidShell>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* The same component a friend's profile uses. What you see
                    of yourself should be what they see of you, or the page is
                    quietly lying about one of the two. */}
                <ProfileView
                    name={profile.name}
                    bio={profile.bio}
                    meta={age ? `${age}` : ''}
                    subline={handle === undefined ? null : (handle && editingHandle) ? (
                        <UsernameInline current={handle} onSaved={name => { setHandle(name); setEditingHandle(false); }} onCancel={() => setEditingHandle(false)} />
                    ) : handle === null ? (
                        <UsernameCard
                            flush
                            current={handle}
                            signedIn={!!myId}
                            onSaved={name => { setHandle(name); setEditingHandle(false); }}
                            onCancel={handle ? () => setEditingHandle(false) : undefined}
                            onSignIn={() => router.push('/(root)/account')}
                        />
                    ) : (
                        <UsernamePill username={handle} onEdit={() => { selectionFeedback(); setEditingHandle(true); }} />
                    )}
                    avatar={profile.avatar}
                    initials={initials(profile)}
                    topInset={insets.top}
                    marks={marks.total}
                    walletSeries={walletSeries ?? undefined}
                    numbers={{ streak, bestStreak, goalsCompleted }}
                    onGoalsDone={() => { selectionFeedback(); setGoalsOpen(true); }}
                    edit={{
                        onName: name => setDraft(current => ({ ...current, name })),
                        onNameDone: () => change({ name: profile.name.trim() }),
                        onBio: bio => setDraft(current => ({ ...current, bio })),
                        onBioDone: () => change({ bio: profile.bio.trim() }),
                        onPick: which => void pickPhoto(which),
                        onRemove: which => Alert.alert(which === 'avatar' ? 'Remove your picture?' : 'Remove your cover?', undefined, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => removePhoto(which) },
                        ]),
                    }}
                >
                    {/* Yours alone: friends' view of your profile never shows it. */}
                    <FreezeCard />
                </ProfileView>

            </ScrollView>
            <GoalsDoneSheet visible={goalsOpen} finished={goalsData.finished} onClose={() => setGoalsOpen(false)}
                onOpen={goalId => { setGoalsOpen(false); router.push({ pathname: '/goal-detail', params: { goalId } }); }} />
            {/* Floats over the backdrop, below the status bar: this is a
                full-screen page, not a sheet, so it clears the clock itself. */}
            <View style={[styles.back, { top: insets.top + 8 }]}>
                <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} diameter={40} size={24} />
            </View>
        </VoidShell>
    );
}

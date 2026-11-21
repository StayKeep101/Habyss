import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VoidShell } from '@/components/ui/VoidShell';
import { IconButton } from '@/components/ui/IconButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHaptics } from '@/hooks/useHaptics';
import { useStreak } from '@/hooks/useStreak';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useMarks } from '@/hooks/useMarks';
import { seriesForProfile } from '@/lib/marksSync';
import { ageFrom, initials, type Profile } from '@/lib/profile';
import { useMyProfile } from '@/hooks/useMyProfile';
import { ProfileView } from '@/components/Profile/ProfileView';
import { FreezeCard } from '@/components/Profile/FreezeCard';
import { FollowCounts } from '@/components/Profile/FollowCounts';
import { YearHeatmap } from '@/components/Profile/YearHeatmap';
import { HourglassAwards } from '@/components/Profile/HourglassAwards';
import { SleepCard } from '@/components/Home/SleepCard';
import { ActivityCard } from '@/components/Home/ActivityCard';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { useFreezes } from '@/hooks/useCheckIns';
import { yearDays } from '@/lib/progressMonth';
import { useAccentGradient } from '@/context/AccentContext';
import { GoalsDoneSheet } from '@/components/Profile/GoalsDoneSheet';
import { FeedService } from '@/lib/feedService';
import { styles } from '@/styles/screens/profile.styles';



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
    const { selectionFeedback } = useHaptics();

    // Shown, never edited here: Settings → Account is where it changes.
    const profile: Profile = useMyProfile();

    const insets = useSafeAreaInsets();

    // The same Marks Home shows and friends see, as your level.
    const goalsData = useGoalsInsights();
    // A year of days for the heatmap, from the same summary the Streak page uses.
    const year = React.useMemo(() => (goalsData.loaded ? yearDays({ habits: goalsData.habits, tasks: goalsData.tasks, history: goalsData.history, skips: goalsData.skips, today: goalsData.today }) : []),
        [goalsData.loaded, goalsData.habits, goalsData.tasks, goalsData.history, goalsData.skips, goalsData.today]);
    const { primary } = useAccentGradient();
    const freezes = useFreezes();
    const [freezesOpen, setFreezesOpen] = useState(false);
    const marks = useMarks(goalsData);
    // The same streak Home and the Streak page show (hooks/useStreak.ts).
    const { streak, bestStreak } = useStreak(goalsData);
    // Goals finished: the trophies.
    const goalsCompleted = goalsData.finished.length;
    const [goalsOpen, setGoalsOpen] = useState(false);


    const age = profile.birthday ? ageFrom(profile.birthday) : null;
    const [myId, setMyId] = useState<string | null>(null);
    useEffect(() => { void FeedService.me().then(setMyId); }, []);

    return (
        <VoidShell look="sheet">
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
                {/* The same component a friend's profile uses. What you see
                    of yourself should be what they see of you, or the page is
                    quietly lying about one of the two. */}
                <ProfileView
                    name={profile.name}
                    bio=""
                    meta={[profile.occupation?.trim(), age ? `${age}` : null].filter(Boolean).join(' · ')}
                    avatar={profile.avatar}
                    initials={initials(profile)}
                    topInset={insets.top}
                    marks={marks.total}
                    marksSeries={seriesForProfile(marks.series)}
                    numbers={{ streak, bestStreak, goalsCompleted }}
                    onGoalsDone={() => { selectionFeedback(); setGoalsOpen(true); }}
                    onStreak={() => { selectionFeedback(); router.push('/(root)/progress' as never); }}
                    freezes={{ count: freezes.count, onPress: () => { selectionFeedback(); setFreezesOpen(true); } }}
                    // Following and followers, then the year of days right under them.
                    social={(
                        <>
                            {myId ? <FollowCounts /> : null}
                            <View style={styles.year}>
                                <YearHeatmap days={year} color={primary} today={goalsData.today} />
                            </View>
                        </>
                    )}
               >
                    {/* Sleep and workouts, as on Home; then the hourglasses earned, as awards. */}
                    <View style={styles.more}>
                        <SleepCard />
                        <ActivityCard />
                        <HourglassAwards marks={marks.total} />
                    </View>
                </ProfileView>

            </ScrollView>
            {/* The freezes, opened from the snowflake on the streak. Yours alone. */}
            <VoidSheet visible={freezesOpen} onClose={() => setFreezesOpen(false)} title="Streak freezes">
                <View style={styles.freezeSheet}><FreezeCard /></View>
            </VoidSheet>
            <GoalsDoneSheet visible={goalsOpen} finished={goalsData.finished} onClose={() => setGoalsOpen(false)}
                onOpen={goalId => { setGoalsOpen(false); router.push({ pathname: '/goal-detail', params: { goalId } }); }} />
            {/* Floats over the backdrop, below the status bar: this is a
                full-screen page, not a sheet, so it clears the clock itself. */}
            <View style={[styles.back, { top: insets.top + 8 }]}>
                <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} diameter={40} size={24} />
            </View>
            {/* Settings, in the top-right corner: everything about you is changed from there (Account). */}
            <View style={[styles.settings, { top: insets.top + 8 }]}>
                <IconButton icon="settings-outline" label="Settings" onPress={() => { selectionFeedback(); router.push('/(root)/settings' as never); }} diameter={40} size={22} />
            </View>
        </VoidShell>
    );
}

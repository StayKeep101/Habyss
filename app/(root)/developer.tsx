import React from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { localDateKey } from '@/lib/habitSchedule';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { emit } from '@/lib/appEvents';
import { TimelineDebug } from '@/components/Settings/TimelineDebug';
import { DayCardPreview } from '@/components/Community/DayCardPreview';
import { styles } from '@/styles/screens/developer.styles';
import { useAppSettings } from '@/context/AppSettingsContext';
import { normalizeAIPersonality } from '@/lib/aiAgentService';
import { getNotificationPrefs } from '@/lib/notificationPrefs';
import { endLiveActivities, notificationSamples, sampleLiveActivity, sendSample, type NotificationSample } from '@/lib/notificationSamples';
import { currentRankLook, previewRankLook } from '@/lib/rankLook';
import { RANK_ORDER, rankGradient } from '@/theme/rankLooks';
import { mixHex } from '@/lib/colorContrast';

/**
 * Tools for trying the app out: the UI catalogue, onboarding from the start
 * (saving nothing), and the big moments on demand. Shown in development and
 * preview builds only, never in the App Store build.
 */
export default function DeveloperScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    // The moments live on Home: go back there, then play them.
    const play = (fire: () => void) => { router.back(); setTimeout(fire, 350); };
    // One of each notification, in five seconds, in your Echo voice (lib/notificationSamples.ts).
    const { aiPersonality } = useAppSettings();
    const send = async (sample: NotificationSample) => {
        const prefs = await getNotificationPrefs().catch(() => null);
        const result = await sendSample(sample, normalizeAIPersonality(aiPersonality), prefs?.echoVoice !== false).catch(() => 'failed' as const);
        if (result === 'not-allowed') Alert.alert('Notifications are off', 'Allow them in Settings → Notifications first.');
        else if (result === 'failed') Alert.alert('Not sent', 'The notification could not be booked.');
    };
    // Your accountability card as it stands now, shown here on command (components/Community/DayCardPreview.tsx).
    const [cardShown, setCardShown] = React.useState(false);
    const live = async (kind: 'task' | 'gate') => {
        if (!(await sampleLiveActivity(kind).catch(() => false))) Alert.alert('No Live Activity', 'This build cannot show one, or Live Activities are off for Habyss.');
    };

    // The app dressed for any rank, this session only (lib/rankLook.ts): your rank is not touched.
    const [previewing, setPreviewing] = React.useState<string | null>(() => currentRankLook().preview);
    const preview = (name: string | null) => { previewRankLook(name); setPreviewing(name); };

    return (
        <SheetScreen title="Developer" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Rank looks">
                    {RANK_ORDER.map(name => {
                        const [from, to] = rankGradient(name);
                        return (
                            <SettingsRow key={name} icon="diamond" color={mixHex(from, to)} label={name}
                                value={previewing === name ? 'Showing' : undefined} onPress={() => preview(name)} />
                        );
                    })}
                    {previewing ? <SettingsRow icon="arrow-undo" color="#8A8A94" label="Back to my rank" onPress={() => preview(null)} /> : null}
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>Dresses the whole app in that rank's look until you go back or close Habyss. Your Marks and rank stay as they are.</Text>

                <SettingsGroup title="Screens">
                    <SettingsRow icon="grid" color="#8A8A94" label="UI catalogue" onPress={() => router.push('/(root)/ui-catalog')} />
                    <SettingsRow icon="play" color="#30D158" label="Test onboarding" onPress={() => router.push({ pathname: '/(auth)/onboarding', params: { preview: '1' } } as never)} />
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>Test onboarding runs the whole flow from the start and saves nothing.</Text>

                <SettingsGroup title="Moments">
                    <SettingsRow icon="trophy" color="#FFD60A" label="Rank up: Beginner (league unlocked)" onPress={() => play(() => emit('preview_climb', { rank: 'Beginner' }))} />
                    <SettingsRow icon="trophy" color="#FF9F0A" label="Rank up: Master" onPress={() => play(() => emit('preview_climb', { rank: 'Master' }))} />
                    <SettingsRow icon="happy" color="#FF375F" label="Quick question: mood" onPress={() => play(() => emit('preview_question', { kind: 'mood' }))} />
                    <SettingsRow icon="happy-outline" color="#FF375F" label="Mood check-in" onPress={() => play(() => emit('show_check_in', { kind: 'mood' }))} />
                    <SettingsRow icon="battery-half" color="#30D158" label="Energy check-in" onPress={() => play(() => emit('show_check_in', { kind: 'energy' }))} />
                    <SettingsRow icon="snow" color="#64D2FF" label="Echo asks: save a friend's streak" onPress={() => play(() => emit('show_freeze_ask', { id: 'preview', name: 'Sam Rivera', streak: 23 }))} />
                    <SettingsRow icon="flame" color="#FF9F0A" label="Streak (day complete)" onPress={() => play(() => emit('day_complete', {
                        tally: { done: 6, total: 6, habits: 4, tasks: 2 }, streak: 5,
                        completedDates: Array.from({ length: 5 }, (_, back) => localDateKey(new Date(Date.now() - back * 86400000))),
                    }))} />
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>These only play the moment; your Marks, rank and data stay as they are.</Text>

                <SettingsGroup title="Accountability card">
                    <SettingsRow icon="people" color="#5E5CE6" label={cardShown ? 'Hide my card' : 'Show my card now'}
                        value={cardShown ? 'Live' : undefined} onPress={() => setCardShown(shown => !shown)} />
                </SettingsGroup>
                {cardShown ? <DayCardPreview /> : null}
                <Text style={[styles.note, { color: colors.textTertiary }]}>Today's card as your friends will see it at your sharing time, kept up to date as you tick things. Nothing is posted.</Text>

                <SettingsGroup title="Test notifications">
                    {notificationSamples().map(sample => (
                        <SettingsRow key={sample.id} icon={sample.category ? 'checkmark-done' : sample.urgent ? 'notifications' : 'chatbubble'} color={sample.category ? '#30D158' : sample.urgent ? '#FF9F0A' : '#5E5CE6'}
                            label={sample.label} onPress={() => void send(sample)} />
                    ))}
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>Each arrives in 5 seconds: lock the phone or leave the app to see it as it really comes. Its buttons do nothing.</Text>

                <SettingsGroup title="Test Live Activities">
                    <SettingsRow icon="timer" color="#64D2FF" label="A task under way (2 min)" onPress={() => void live('task')} />
                    <SettingsRow icon="lock-open" color="#64D2FF" label="Apps open for an hour (2 min)" onPress={() => void live('gate')} />
                    <SettingsRow icon="close-circle" color="#8A8A94" label="End all Live Activities" onPress={() => void endLiveActivities()} />
                </SettingsGroup>

                <SettingsGroup title="Today's timeline, as the app sees it">
                    <TimelineDebug />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

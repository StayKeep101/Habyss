import React from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { emit } from '@/lib/appEvents';
import { TimelineDebug } from '@/components/Settings/TimelineDebug';
import { styles } from '@/styles/screens/developer.styles';
import { useAppSettings } from '@/context/AppSettingsContext';
import { normalizeAIPersonality } from '@/lib/aiAgentService';
import { getNotificationPrefs } from '@/lib/notificationPrefs';
import { endLiveActivities, notificationSamples, sampleLiveActivity, sendSample, type NotificationSample } from '@/lib/notificationSamples';

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
    const live = async (kind: 'task' | 'gate') => {
        if (!(await sampleLiveActivity(kind).catch(() => false))) Alert.alert('No Live Activity', 'This build cannot show one, or Live Activities are off for Habyss.');
    };

    return (
        <SheetScreen title="Developer" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Screens">
                    <SettingsRow icon="grid" color="#8A8A94" label="UI catalogue" onPress={() => router.push('/(root)/ui-catalog')} />
                    <SettingsRow icon="play" color="#30D158" label="Test onboarding" onPress={() => router.push({ pathname: '/(auth)/onboarding', params: { preview: '1' } } as never)} />
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>Test onboarding runs the whole flow from the start and saves nothing.</Text>

                <SettingsGroup title="Moments">
                    <SettingsRow icon="trophy" color="#FFD60A" label="Rank up: Beginner (league unlocked)" onPress={() => play(() => emit('preview_climb', { rank: 'Beginner' }))} />
                    <SettingsRow icon="trophy" color="#FF9F0A" label="Rank up: Master" onPress={() => play(() => emit('preview_climb', { rank: 'Master' }))} />
                    <SettingsRow icon="happy" color="#FF375F" label="Quick question: mood" onPress={() => play(() => emit('preview_question', { kind: 'mood' }))} />
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>These only play the moment; your Marks, rank and data stay as they are.</Text>

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

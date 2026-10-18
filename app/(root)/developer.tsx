import React from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { emit } from '@/lib/appEvents';
import { styles } from '@/styles/screens/developer.styles';

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
                    <SettingsRow icon="snow" color="#64D2FF" label="Easter egg: help a friend" onPress={() => play(() => emit('preview_egg', { egg: 'help_friend' }))} />
                    <SettingsRow icon="key" color="#BF5AF2" label="Easter egg: the vault" onPress={() => play(() => emit('preview_egg', { egg: 'vault' }))} />
                    <SettingsRow icon="happy" color="#FF375F" label="Quick question: mood" onPress={() => play(() => emit('preview_question', { kind: 'mood' }))} />
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>These only play the moment; your Marks, rank and data stay as they are.</Text>
            </ScrollView>
        </SheetScreen>
    );
}

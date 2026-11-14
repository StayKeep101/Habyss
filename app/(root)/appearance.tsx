import React, { useEffect, useSyncExternalStore } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useAppSettings, type RoadMapCardSize } from '@/context/AppSettingsContext';
import { useTokens } from '@/hooks/useTokens';
import { currentThemeChoice, loadThemeChoice, setThemeChoice, subscribeThemeChoice, type ThemeChoice } from '@/lib/themeChoice';
import { styles } from '@/styles/screens/appearance.styles';

/**
 * How the app looks and feels, on one screen (always dark): the theme, card size,
 * sound, music and touch as rows you can change in place. Theme: Default is
 * Habyss's original palette; Hourglass wears the palette of the hourglass in
 * use (theme/palettes.ts), chosen by tapping the hourglass on Home.
 */
export default function Appearance() {
    const { cardSize, setCardSize, soundsEnabled, setSoundsEnabled, musicEnabled, setMusicEnabled, hapticsEnabled, setHapticsEnabled } = useAppSettings();
    const t = useTokens();
    useEffect(() => { void loadThemeChoice(); }, []);
    const theme = useSyncExternalStore(subscribeThemeChoice, currentThemeChoice, currentThemeChoice);

    return (
        <SheetScreen title="Appearance" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup>
                    <SettingsRow icon="color-palette" color={t.color.accent} label="Theme" keywords="palette colour color hourglass"
                        choices={[{ id: 'default', label: 'Default' }, { id: 'hourglass', label: 'Hourglass' }]}
                        chosen={theme} onChoose={id => setThemeChoice(id as ThemeChoice)} />
                    <SettingsRow icon="albums" color="#FF9F0A" label="Cards"
                        choices={[{ id: 'small', label: 'S' }, { id: 'standard', label: 'M' }, { id: 'big', label: 'L' }]}
                        chosen={cardSize} onChoose={id => setCardSize(id as RoadMapCardSize)} />
                    <SettingsRow icon="volume-high" color="#FF453A" label="Sound" toggle={soundsEnabled} onToggle={setSoundsEnabled} />
                    <SettingsRow icon="musical-notes" color={t.color.accent} label="Music" toggle={musicEnabled} onToggle={setMusicEnabled} />
                    <SettingsRow icon="pulse" color="#30D158" label="Vibration" toggle={hapticsEnabled} onToggle={setHapticsEnabled} />
                </SettingsGroup>

            </ScrollView>
        </SheetScreen>
    );
}

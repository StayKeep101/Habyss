import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useAppSettings, type RoadMapCardSize } from '@/context/AppSettingsContext';
import { useTokens } from '@/hooks/useTokens';
import { styles } from '@/styles/screens/appearance.styles';

/**
 * How the app looks and feels, on one screen (always dark): card size, sound, music
 * and touch as rows you can change in place. The colour is your rank's
 * (theme/rankLooks.ts), so there is nothing to pick.
 */
export default function Appearance() {
    const { cardSize, setCardSize, soundsEnabled, setSoundsEnabled, musicEnabled, setMusicEnabled, hapticsEnabled, setHapticsEnabled } = useAppSettings();
    const t = useTokens();

    return (
        <SheetScreen title="Appearance" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup>
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

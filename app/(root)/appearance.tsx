import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { AppIcon } from '@/components/ui/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings, type RoadMapCardSize } from '@/context/AppSettingsContext';
import { useAccent, ACCENT_GRADIENTS } from '@/context/AccentContext';
import { styles } from '@/styles/screens/appearance.styles';

/**
 * How the app looks and feels, on one screen (always dark): card size, sound and
 * touch as rows you can change in place, and the colour as a row of circles.
 */
export default function Appearance() {
    const { cardSize, setCardSize, soundsEnabled, setSoundsEnabled, hapticsEnabled, setHapticsEnabled } = useAppSettings();
    const { chosenGradient, setAccentGradientId, followRank, setFollowRank } = useAccent();
    const { selectionFeedback } = useHaptics();

    return (
        <SheetScreen title="Appearance" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup>
                    <SettingsRow icon="albums" color="#FF9F0A" label="Cards"
                        choices={[{ id: 'small', label: 'S' }, { id: 'standard', label: 'M' }, { id: 'big', label: 'L' }]}
                        chosen={cardSize} onChoose={id => setCardSize(id as RoadMapCardSize)} />
                    <SettingsRow icon="volume-high" color="#FF453A" label="Sound" toggle={soundsEnabled} onToggle={setSoundsEnabled} />
                    <SettingsRow icon="pulse" color="#30D158" label="Vibration" toggle={hapticsEnabled} onToggle={setHapticsEnabled} />
                </SettingsGroup>

                {/* Your rank dresses the app: its colour climbs as you do (theme/rankLooks.ts). */}
                <SettingsGroup>
                    <SettingsRow icon="diamond" color="#5E5CE6" label="Colour follows my rank" toggle={followRank}
                        onToggle={value => { selectionFeedback(); setFollowRank(value); }} />
                </SettingsGroup>

                {/* Or your own colour: tap one (it stops following your rank). */}
                <View style={[styles.swatches, followRank && styles.dimmed]} accessibilityRole="radiogroup" accessibilityLabel="App colour">
                    {ACCENT_GRADIENTS.map(gradient => {
                        const on = !followRank && chosenGradient.id === gradient.id;
                        return (
                            <Pressable key={gradient.id} accessibilityRole="radio" accessibilityLabel={gradient.name} accessibilityState={{ selected: on }}
                                onPress={() => { selectionFeedback(); setAccentGradientId(gradient.id); setFollowRank(false); }}
                                style={[styles.swatchRing, on && styles.swatchRingOn]}>
                                <LinearGradient colors={gradient.colors as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch}>
                                    {on ? <AppIcon name="checkmark" size={16} color="#FFFFFF" /> : null}
                                </LinearGradient>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>
        </SheetScreen>
    );
}

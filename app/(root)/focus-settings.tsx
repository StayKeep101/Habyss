import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup } from '@/components/ui/SettingsList';
import { FocusBackgroundRow, FocusClockRow, FocusMusicGroup } from '@/components/Focus/FocusSheets';
import { styles } from '@/styles/screens/focus-settings.styles';

/**
 * How a Focus session looks and sounds: the clock, Habyss's sounds and your
 * own music, the same as on the focus page. Focus always blocks the apps
 * chosen on App blocking; there is nothing to switch here.
 */
export default function FocusSettingsScreen() {
    return (
        <SheetScreen title="Focus" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Clock">
                    <FocusClockRow label="Clock style" />
                    <FocusBackgroundRow />
                </SettingsGroup>
                <FocusMusicGroup />
            </ScrollView>
        </SheetScreen>
    );
}

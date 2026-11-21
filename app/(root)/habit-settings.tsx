import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useHaptics } from '@/hooks/useHaptics';
import { setTickPhotoOn, useTickPhotoOn } from '@/lib/tickPhotos';
import { FriendsSeeRow } from '@/components/Settings/FriendsSeeRow';
import { useTokens } from '@/hooks/useTokens';
import { styles } from '@/styles/screens/habit-settings.styles';

/** Everything about habits in one place: the photo when you tick one, and what friends see of them. */
export default function HabitSettingsScreen() {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const photoOn = useTickPhotoOn();
    return (
        <SheetScreen title="Habits" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Ticking">
                    <SettingsRow icon="camera" color={t.color.accent} label="Photo when you tick" toggle={photoOn}
                        onToggle={value => { lightFeedback(); void setTickPhotoOn(value); }} />
                </SettingsGroup>
                <SettingsGroup title="Friends see">
                    <FriendsSeeRow what="habits" icon="repeat" color={t.color.warning} label="Shared habit names" />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

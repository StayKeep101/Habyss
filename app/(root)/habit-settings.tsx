import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup } from '@/components/ui/SettingsList';
import { FriendsSeeRow } from '@/components/Settings/FriendsSeeRow';
import { useTokens } from '@/hooks/useTokens';
import { styles } from '@/styles/screens/habit-settings.styles';

/** Everything about habits in one place. For now: what friends see of them. */
export default function HabitSettingsScreen() {
    const t = useTokens();
    return (
        <SheetScreen title="Habits" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Friends see">
                    <FriendsSeeRow what="habits" icon="repeat" color={t.color.warning} label="Shared habit names" />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

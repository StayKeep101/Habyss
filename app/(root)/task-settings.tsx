import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { FriendsSeeRow } from '@/components/Settings/FriendsSeeRow';
import { useTokens } from '@/hooks/useTokens';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { saveDailyTarget } from '@/lib/dailyFocus';
import { styles } from '@/styles/screens/task-settings.styles';

/** Everything about tasks in one place: how many a day, and whether friends see them. */
export default function TaskSettingsScreen() {
    const t = useTokens();
    const dailyTarget = useDailyTarget();
    return (
        <SheetScreen title="Tasks" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Planning">
                    <SettingsRow icon="checkmark-done" color={t.color.warning} label="Tasks a day" keywords="daily target three five"
                        choices={[{ id: '3', label: '3' }, { id: '5', label: '5' }]}
                        chosen={String(dailyTarget)} onChoose={id => void saveDailyTarget(Number(id) as 3 | 5)} />
                </SettingsGroup>
                <SettingsGroup title="Friends see">
                    <FriendsSeeRow what="tasks" icon="checkmark-done" color={t.color.danger} label="Today's tasks" />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

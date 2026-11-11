import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useClockStyle } from '@/hooks/useClockStyle';
import { CLOCK_STYLES, setClockStyle, type ClockStyle } from '@/lib/focusClock';
import { setFocusBlocking, useFocusBlocking } from '@/lib/focusBlocking';
import { styles } from '@/styles/screens/focus-settings.styles';

/**
 * How a Focus session looks and what it does: the clock, and whether it
 * blocks your apps while it runs. Which apps, and the other ways of blocking
 * them, are on App blocking.
 */
export default function FocusSettingsScreen() {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const clockStyle = useClockStyle();
    const blocking = useFocusBlocking();
    return (
        <SheetScreen title="Focus" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Clock">
                    <SettingsRow icon="timer" color={t.color.accent} label="Clock style"
                        choices={CLOCK_STYLES} chosen={clockStyle} onChoose={id => void setClockStyle(id as ClockStyle)} />
                </SettingsGroup>
                <SettingsGroup title="While focusing">
                    {/* Focus blocks the apps on App blocking until it ends or is paused. */}
                    <SettingsRow icon="hand-left" color={t.color.danger} label="Block my apps"
                        toggle={blocking} onToggle={value => { lightFeedback(); void setFocusBlocking(value); }} />
                    <SettingsRow icon="apps" color={t.color.danger} label="Which apps" value="App blocking"
                        onPress={() => router.push('/(root)/app-blocking' as never)} />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

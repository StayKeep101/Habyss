import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconTile } from '@/components/ui/IconTile';
import { IconButton } from '@/components/ui/IconButton';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { useTokens } from '@/hooks/useTokens';
import { useCalendarOn } from '@/hooks/useCalendarEvents';
import { calendarAvailable, explainCalendarRefused, setCalendarOn } from '@/lib/calendarEvents';
import { FontFamily } from '@/theme/designSystem';

const DISMISSED = 'habyss_calendar_prompt_dismissed';

/**
 * Until the calendar is connected, one small card above the timeline offers
 * it: Apple Calendar, and any Google or Outlook account on the iPhone, come
 * in as fixed blocks the day is planned around. One tap connects (iOS asks
 * once); the × puts it away for good.
 */
export function CalendarPrompt() {
    const t = useTokens();
    const on = useCalendarOn();
    const [hidden, setHidden] = useState(true);
    useEffect(() => {
        void AsyncStorage.getItem(DISMISSED).then(value => setHidden(value === '1')).catch(() => setHidden(false));
    }, []);
    if (on || hidden || !calendarAvailable()) return null;
    const dismiss = () => { setHidden(true); void AsyncStorage.setItem(DISMISSED, '1').catch(() => undefined); };
    const connect = async () => { if (!(await setCalendarOn(true))) explainCalendarRefused(); };
    return (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={{ marginBottom: t.space.md }}>
            <VoidCard style={[styles.card, { padding: t.space.md, gap: t.space.md }]}>
                <IconTile icon="calendar" color={t.color.danger} size={34} shape="square" />
                <View style={[styles.text, { gap: t.space.xs }]}>
                    <Text style={[t.type.bodySmall, styles.title, { color: t.color.textPrimary }]}>Bring in your calendar</Text>
                    <Text style={[t.type.caption, { color: t.color.textMuted }]}>Apple and Google Calendar events become fixed blocks; habits and tasks are planned around them.</Text>
                    <View style={styles.actions}>
                        <ChoicePill label="Connect" icon="link" on color={t.color.accent} role="button" onPress={() => void connect()} accessibilityLabel="Connect your calendar" />
                    </View>
                </View>
                <IconButton icon="close" label="Not now" onPress={dismiss} />
            </VoidCard>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'flex-start' },
    text: { flex: 1 },
    title: { fontFamily: FontFamily.semibold },
    actions: { flexDirection: 'row' },
});

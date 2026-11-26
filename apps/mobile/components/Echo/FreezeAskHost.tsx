import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PopupCard } from '@/components/ui/PopupCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { Avatar } from '@/components/ui/Avatar';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { on, type AppEvents } from '@/lib/appEvents';
import { giftFreeze } from '@/lib/streakFreeze';
import { FontFamily, Spacing } from '@/theme/designSystem';

type Ask = AppEvents['show_freeze_ask'];
const STREAK = '#FF9F0A';

/**
 * Echo asking you to save a friend's streak (lib/freezeAsk.ts): their face on
 * the card's edge, their streak with its flame, and one button to send a
 * streak freeze. The only place a freeze is sent from. Mounted once over the app.
 */
export function FreezeAskHost() {
    const t = useTokens();
    const { successFeedback, lightFeedback } = useHaptics();
    const [ask, setAsk] = useState<Ask | null>(null);
    const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>('idle');
    useEffect(() => {
        const sub = on('show_freeze_ask', next => { setAsk(next); setState('idle'); });
        return () => sub.remove();
    }, []);

    const first = ask?.name.split(' ')[0] ?? '';
    const send = async () => {
        if (!ask || state === 'sending') return;
        setState('sending');
        const result = await giftFreeze(ask.id);
        if (result === 'sent') { successFeedback(); setState('sent'); setTimeout(() => setAsk(null), 1200); return; }
        const why: Record<string, string> = {
            too_soon: `You already sent ${first} one this week.`,
            full: `${first} already has five, the most anyone can hold.`,
            not_friends: `Only friends can send ${first} one.`,
            signed_out: 'Sign in first: freezes go through your account.',
            offline: 'It could not be sent. Check your connection.',
        };
        setState(why[result] ?? why.offline);
    };

    return (
        <PopupCard visible={!!ask} onClose={() => setAsk(null)} icon="snow" iconColor={STREAK}
            badge={ask ? <Avatar name={ask.name} uri={ask.avatarUrl} size={96} ring={STREAK} /> : undefined}
            title={`${first} is about to lose it`}
            body={`Nothing done today yet. A streak freeze covers the day, so ${first}'s run survives it.`}>
            {ask ? (
                <View style={styles.streak} accessible accessibilityLabel={`${ask.streak} day streak`}>
                    <AppIcon name="flame" filled size={30} color={STREAK} />
                    <Text style={[styles.count, { color: t.color.textPrimary }]}>{ask.streak}</Text>
                    <Text style={[styles.unit, { color: t.color.textMuted }]}>{ask.streak === 1 ? 'day' : 'days'}</Text>
                </View>
            ) : null}
            {state !== 'idle' && state !== 'sending' && state !== 'sent'
                ? <Text style={[styles.note, { color: t.color.textMuted }]}>{state}</Text> : null}
            <AppButton label={state === 'sent' ? 'Streak freeze sent' : 'Send a streak freeze'} icon={state === 'sent' ? 'checkmark' : 'snow'}
                variant="primary" loading={state === 'sending'} disabled={state === 'sent'} onPress={() => void send()} />
            <AppButton label="Not now" variant="ghost" onPress={() => { lightFeedback(); setAsk(null); }} />
        </PopupCard>
    );
}

const styles = StyleSheet.create({
    streak: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
    count: { fontSize: 34, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    unit: { fontSize: 15, fontFamily: FontFamily.medium, marginLeft: Spacing.xs },
    note: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});

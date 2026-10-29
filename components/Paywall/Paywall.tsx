import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, HoldButton, IconButton, MatteInput, StatTile, Text, VoidCard } from '@/components/ui';
import { Control, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccess } from '@/hooks/useAccess';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useMarks } from '@/hooks/useMarks';
import { FRIENDS_NEEDED, PRODUCTS, TRIAL_DAYS, buy, challengeDay, friendPrice, restore, startTrial } from '@/lib/access';
import { challengeReport } from '@/lib/challengeReport';
import { priceInviteMessage } from '@/lib/referrals';

type Mode = 'start' | 'ended' | 'open';
type Prices = { full: string; friend: string };

/**
 * Paying for Habyss: the 14-day challenge, then one payment to keep it for life.
 *
 * - start: before the challenge, saying plainly how long it lasts, what locks
 *   after it and what it costs then (Guideline 3.1.1).
 * - ended: the fourteen days are up and the whole app is locked until it is
 *   bought. First what they did (the proof, in their own numbers), then the
 *   price and a button held to commit; what they built comes back the moment
 *   they do.
 * - open: from Settings, closable: the day of the challenge, or that it is theirs.
 *
 * Everyone in an invite pays half: each friend who joins with it, and you
 * once one has; the invite is shared from here.
 */
export function Paywall({ mode, onClose }: { mode: Mode; onClose?: () => void }) {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { successFeedback, lightFeedback } = useHaptics();
    const { access, referral } = useAccess();
    const half = friendPrice(referral);
    const [prices, setPrices] = useState<Prices>({ full: '$9.99', friend: '$4.99' });
    const [busy, setBusy] = useState<'trial' | 'buy' | 'restore' | null>(null);
    const [note, setNote] = useState<string | null>(null);
    // What the fourteen days came to, from the record the Marks keep.
    const goalsData = useGoalsInsights();
    const marks = useMarks(goalsData);
    const report = useMemo(() => challengeReport(marks.ledger, goalsData.today, TRIAL_DAYS), [marks.ledger, goalsData.today]);

    // The store's own prices, in the person's currency.
    useEffect(() => {
        const service = (require('@/lib/RevenueCat') as typeof import('@/lib/RevenueCat')).default;
        void Promise.all([service.getOneOff(PRODUCTS.full), service.getOneOff(PRODUCTS.friend)]).then(([full, friend]) => {
            setPrices(current => ({ full: full?.priceString ?? current.full, friend: friend?.priceString ?? current.friend }));
        });
    }, []);

    const price = half ? prices.friend : prices.full;
    const day = challengeDay(access);
    const begin = async () => {
        setBusy('trial'); setNote(null);
        const result = await startTrial();
        setBusy(null);
        if (result === 'started') successFeedback();
    };
    const purchase = async () => {
        setBusy('buy'); setNote(null);
        const result = await buy(half ? 'friend' : 'full');
        setBusy(null);
        if (result === 'bought') onClose?.();
        if (result === 'failed') setNote('The App Store could not be reached. Nothing was charged. Try again in a moment.');
    };
    const bringBack = async () => {
        setBusy('restore'); setNote(null);
        const found = await restore();
        setBusy(null);
        if (found) { successFeedback(); onClose?.(); } else setNote('No earlier purchase was found for this Apple ID.');
    };

    const owned = access.kind === 'owned';
    const title = mode === 'start' ? 'The 14-day challenge'
        : mode === 'ended' ? 'Your 14 days are up'
        : owned ? 'Habyss is yours'
        : day ? `Day ${day} of ${TRIAL_DAYS}` : 'Unlock Habyss';
    const body = mode === 'start'
        ? `Use everything in Habyss free for ${TRIAL_DAYS} days. Motivation fades. Systems don’t. On day ${TRIAL_DAYS + 1} you’ll see what you built, then keep Habyss for life for ${prices.full}, once. No subscription. If you don’t, the app locks, and everything you built waits for you.`
        : mode === 'ended' ? 'Motivation got you started. Here’s what you built while it faded.'
        : owned ? 'Bought once, yours for life. Thank you.'
        : `${TRIAL_DAYS - (day ?? TRIAL_DAYS)} ${TRIAL_DAYS - (day ?? TRIAL_DAYS) === 1 ? 'day' : 'days'} left in your challenge. Commit now and keep everything for life, one payment, no subscription.`;
    // Said after the numbers, in their measure.
    const verdict = report.daysShownUp >= 10 ? 'You built a system. Keep it.'
        : report.daysShownUp >= 5 ? 'You started something real. Don’t let it stop here.'
        : 'This is where a system takes over from motivation. Start it now.';

    return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.color.background }]}>
            {onClose ? (
                <View style={[styles.close, { top: insets.top + Spacing.sm }]}>
                    <IconButton icon="close" label="Close" onPress={onClose} />
                </View>
            ) : null}
            <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.lg }]} showsVerticalScrollIndicator={false}>
                <Image source={require('@/assets/images/habyss-mark.png')} style={styles.mark} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text variant="screenTitle" align="center" accessibilityRole="header">{title}</Text>
                <Text variant="body" tone="muted" align="center">{body}</Text>

                {/* Day 15: the proof first, in their own numbers. */}
                {mode === 'ended' ? (
                    <>
                        <VoidCard style={styles.report}>
                            <View style={styles.row}>
                                <StatTile value={`${report.daysShownUp}/${report.days}`} label="Days you showed up" />
                                <StatTile value={String(report.bestRun)} label="Best run" />
                            </View>
                            <View style={styles.row}>
                                <StatTile value={String(report.habitsKept)} label="Habits kept" />
                                <StatTile value={String(report.tasksDone)} label="Tasks done" />
                                <StatTile value={String(report.goalsReached)} label="Goals reached" />
                            </View>
                            <View style={styles.row}>
                                <StatTile value={`+${report.marksEarned.toLocaleString()}`} label="Marks earned" tone="accent" />
                            </View>
                        </VoidCard>
                        <Text variant="title" align="center">{verdict}</Text>
                    </>
                ) : null}

                {mode !== 'start' && !owned ? (
                    <VoidCard style={styles.price}>
                        <Text variant="caption" tone="muted">{half ? 'Friend price' : 'Unlock Habyss for life'}</Text>
                        <View style={styles.priceRow}>
                            <Text variant="display" numeric>{price}</Text>
                            {half ? <Text variant="heading" tone="muted" accessibilityLabel={`instead of ${prices.full}`}>{prices.full}</Text> : null}
                        </View>
                        <Text variant="caption" tone="muted">Once. Yours for life. No subscription.</Text>
                    </VoidCard>
                ) : null}

                {mode === 'start'
                    ? <AppButton label="Start the challenge" icon="flag" loading={busy === 'trial'} onPress={begin} />
                    : !owned
                        ? <HoldButton label={`Commit · ${price}`} icon="lock-open" hint="Touch and hold to commit" loading={busy === 'buy'} disabled={!!busy && busy !== 'buy'} onComplete={() => { void purchase(); }} />
                        : null}

                {!owned ? <InviteCard referral={referral} /> : null}

                {note ? <Text variant="bodySmall" tone="muted" align="center" accessibilityLiveRegion="polite">{note}</Text> : null}
                {!owned ? (
                    <AppButton label="Restore purchase" variant="ghost" loading={busy === 'restore'} disabled={!!busy} onPress={() => { lightFeedback(); void bringBack(); }} />
                ) : null}
            </ScrollView>
        </View>
    );
}

/** Half price with friends: everyone in an invite pays half, the one who sent it too. */
function InviteCard({ referral }: { referral: { invitedBy: string | null; joined: number } | null }) {
    const t = useTokens();
    const { lightFeedback, successFeedback } = useHaptics();
    const [username, setUsername] = useState<string | null | undefined>(undefined);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const { getMyUsername } = require('@/lib/friendsService') as typeof import('@/lib/friendsService');
        void getMyUsername().then(setUsername).catch(() => setUsername(null));
    }, []);
    // Signed out (no account on this phone): invites cannot be counted, so none are offered.
    if (referral === null && username === null) return null;
    const joined = Math.min(FRIENDS_NEEDED, referral?.joined ?? 0);

    const invite = async () => {
        if (!username) return;
        lightFeedback();
        await Share.share({ message: priceInviteMessage(username) });
    };
    const choose = async () => {
        const { setMyUsername, normaliseUsername } = require('@/lib/friendsService') as typeof import('@/lib/friendsService');
        const result = await setMyUsername(draft);
        if (result.ok) { successFeedback(); setUsername(normaliseUsername(draft)); setError(null); } else setError(result.error);
    };

    return (
        <VoidCard style={styles.invite}>
            <Text variant="heading">Half price with friends</Text>
            <Text variant="bodySmall" tone="muted">
                {referral?.invitedBy
                    ? `@${referral.invitedBy} invited you, so yours is half price. Every friend you invite gets it half price too.`
                    : joined >= FRIENDS_NEEDED
                    ? 'A friend joined with your invite, so yours is half price. Every friend you invite pays half too.'
                    : 'Invite a friend and you both pay half. Invite three and all four of you do.'}
            </Text>
            {(referral?.joined ?? 0) > 0 ? (
                <View style={styles.dots}>
                    <View style={[styles.dot, { backgroundColor: t.color.accent }]} />
                    <Text variant="caption" tone="muted">{referral!.joined === 1 ? '1 friend joined' : `${referral!.joined} friends joined`}</Text>
                </View>
            ) : null}
            {username ? (
                <AppButton label="Invite friends" icon="share-outline" variant="ghost" onPress={() => { void invite(); }} />
            ) : username === null ? (
                <>
                    <Text variant="bodySmall" tone="muted">Friends find you by your username. Pick one first.</Text>
                    <MatteInput value={draft} onChangeText={setDraft} placeholder="username" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Your username" />
                    {error ? <Text variant="bodySmall" tone="danger">{error}</Text> : null}
                    <AppButton label="Save username" variant="ghost" disabled={draft.trim().length < 3} onPress={() => { void choose(); }} />
                </>
            ) : null}
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    close: { position: 'absolute', right: Spacing.lg, zIndex: 1 },
    page: { paddingHorizontal: Spacing.xl, gap: Spacing.lg, alignItems: 'stretch' },
    mark: { width: Control.hitTarget * 1.6, height: Control.hitTarget * 1.6, alignSelf: 'center' },
    report: { paddingVertical: Spacing.lg, gap: Spacing.lg },
    row: { flexDirection: 'row' },
    price: { padding: Spacing.lg, gap: Spacing.xs, alignItems: 'center' },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    invite: { padding: Spacing.lg, gap: Spacing.sm },
    dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    dot: { width: Spacing.sm, height: Spacing.sm, borderRadius: Spacing.xs },
});

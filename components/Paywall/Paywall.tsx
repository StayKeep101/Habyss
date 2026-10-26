import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppButton } from '@/components/ui/AppButton';
import { IconButton } from '@/components/ui/IconButton';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccess } from '@/hooks/useAccess';
import { FRIENDS_NEEDED, PRODUCTS, TRIAL_DAYS, buy, friendPrice, restore, startTrial } from '@/lib/access';
import { priceInviteMessage } from '@/lib/referrals';

type Mode = 'start' | 'ended' | 'open';
type Prices = { full: string; friend: string };

/**
 * Paying for Habyss: a free week, then one payment to keep it for good.
 *
 * - start: before the free week, saying plainly how long it lasts, what
 *   locks after it and what it costs then (Guideline 3.1.1).
 * - ended: the week is over and the app is locked until it is bought; what
 *   you built is kept and comes back the moment you do.
 * - open: from Settings, closable.
 *
 * Friends who join with your invite pay half, and when three have joined so
 * do you; the invite is shared from here.
 */
export function Paywall({ mode, onClose }: { mode: Mode; onClose?: () => void }) {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { successFeedback, lightFeedback } = useHaptics();
    const { access, referral } = useAccess();
    const half = friendPrice(referral);
    const [prices, setPrices] = useState<Prices>({ full: '$19.99', friend: '$9.99' });
    const [busy, setBusy] = useState<'trial' | 'buy' | 'restore' | null>(null);
    const [note, setNote] = useState<string | null>(null);

    // The store's own prices, in the person's currency.
    useEffect(() => {
        const service = (require('@/lib/RevenueCat') as typeof import('@/lib/RevenueCat')).default;
        void Promise.all([service.getOneOff(PRODUCTS.full), service.getOneOff(PRODUCTS.friend)]).then(([full, friend]) => {
            setPrices(current => ({ full: full?.priceString ?? current.full, friend: friend?.priceString ?? current.friend }));
        });
    }, []);

    const price = half ? prices.friend : prices.full;
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
        if (result === 'bought') { successFeedback(); onClose?.(); }
        if (result === 'failed') setNote('The App Store could not be reached. Nothing was charged. Try again in a moment.');
    };
    const bringBack = async () => {
        setBusy('restore'); setNote(null);
        const found = await restore();
        setBusy(null);
        if (found) { successFeedback(); onClose?.(); } else setNote('No earlier purchase was found for this Apple ID.');
    };

    const title = mode === 'start' ? `Try Habyss free for ${TRIAL_DAYS} days`
        : mode === 'ended' ? 'Your free week is over'
        : access.kind === 'owned' ? 'Habyss is yours' : 'Keep Habyss for good';
    const body = mode === 'start'
        ? `Everything is open for ${TRIAL_DAYS} days. After that, Habyss is ${prices.full} once, not a subscription. If you don’t buy it, the app locks, and your habits and goals wait for you.`
        : access.kind === 'owned' ? 'Bought once, yours for good. Thank you.'
        : access.kind === 'trial' ? `${access.daysLeft} ${access.daysLeft === 1 ? 'day' : 'days'} left of your free week. Keep everything you build with one payment, not a subscription.`
        : 'Keep everything you’ve built with one payment, not a subscription. It all comes back the moment you do.';

    return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.color.background }]}>
            {onClose ? (
                <View style={[styles.close, { top: insets.top + Spacing.sm }]}>
                    <IconButton icon="close" label="Close" onPress={onClose} />
                </View>
            ) : null}
            <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.lg }]} showsVerticalScrollIndicator={false}>
                <Image source={require('@/assets/images/habyss-mark.png')} style={styles.mark} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text style={[styles.title, { color: t.color.textPrimary }]} accessibilityRole="header">{title}</Text>
                <Text style={[styles.body, { color: t.color.textMuted }]}>{body}</Text>

                {mode !== 'start' && access.kind !== 'owned' ? (
                    <MatteSurface radius={20} style={styles.price}>
                        <Text style={[styles.priceLabel, { color: t.color.textMuted }]}>{half ? 'Friend price' : 'One payment'}</Text>
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceValue, { color: t.color.textPrimary }]}>{price}</Text>
                            {half ? <Text style={[styles.priceWas, { color: t.color.textMuted }]} accessibilityLabel={`instead of ${prices.full}`}>{prices.full}</Text> : null}
                        </View>
                        <Text style={[styles.priceNote, { color: t.color.textMuted }]}>Yours for good. No subscription.</Text>
                    </MatteSurface>
                ) : null}

                {mode === 'start'
                    ? <AppButton label={`Start ${TRIAL_DAYS} free days`} loading={busy === 'trial'} onPress={begin} />
                    : access.kind !== 'owned'
                        ? <AppButton label={`Buy for ${price}`} loading={busy === 'buy'} disabled={!!busy} onPress={purchase} />
                        : null}

                {access.kind !== 'owned' ? <InviteCard referral={referral} /> : null}

                {note ? <Text style={[styles.note, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">{note}</Text> : null}
                {access.kind !== 'owned' ? (
                    <AppButton label="Restore purchase" variant="ghost" loading={busy === 'restore'} disabled={!!busy} onPress={() => { lightFeedback(); void bringBack(); }} />
                ) : null}
            </ScrollView>
        </View>
    );
}

/** Half price with friends: share your invite, and see how many have joined. */
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
        <MatteSurface radius={20} style={styles.invite}>
            <Text style={[styles.inviteTitle, { color: t.color.textPrimary }]}>Half price with friends</Text>
            <Text style={[styles.body, styles.left, { color: t.color.textMuted }]}>
                {referral?.invitedBy
                    ? `@${referral.invitedBy} invited you, so yours is half price. Invite ${FRIENDS_NEEDED} friends and they get it half price too.`
                    : `Friends who join with your invite pay half. When ${FRIENDS_NEEDED} have joined, so do you.`}
            </Text>
            <View style={styles.dots} accessible accessibilityLabel={`${joined} of ${FRIENDS_NEEDED} friends joined`}>
                {Array.from({ length: FRIENDS_NEEDED }, (_, index) => (
                    <View key={index} style={[styles.dot, { backgroundColor: index < joined ? t.color.accent : t.color.border }]} />
                ))}
                <Text style={[styles.dotsText, { color: t.color.textMuted }]}>{`${joined} of ${FRIENDS_NEEDED} joined`}</Text>
            </View>
            {username ? (
                <AppButton label="Invite friends" icon="share-outline" variant="ghost" onPress={() => { void invite(); }} />
            ) : username === null ? (
                <>
                    <Text style={[styles.body, styles.left, { color: t.color.textMuted }]}>Friends find you by your username. Pick one first.</Text>
                    <MatteInput value={draft} onChangeText={setDraft} placeholder="username" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Your username" />
                    {error ? <Text style={[styles.note, { color: t.color.textMuted }]}>{error}</Text> : null}
                    <AppButton label="Save username" variant="ghost" disabled={draft.trim().length < 3} onPress={() => { void choose(); }} />
                </>
            ) : null}
        </MatteSurface>
    );
}

const styles = StyleSheet.create({
    close: { position: 'absolute', right: Spacing.lg, zIndex: 1 },
    page: { paddingHorizontal: Spacing.xl, gap: Spacing.lg, alignItems: 'stretch' },
    mark: { width: 72, height: 72, alignSelf: 'center' },
    title: { fontSize: 28, fontFamily: FontFamily.bold, textAlign: 'center' },
    body: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.regular, textAlign: 'center' },
    left: { textAlign: 'left' },
    price: { padding: Spacing.lg, gap: Spacing.xs, alignItems: 'center' },
    priceLabel: { fontSize: 13, fontFamily: FontFamily.semibold },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    priceValue: { fontSize: 34, fontFamily: FontFamily.bold },
    priceWas: { fontSize: 17, fontFamily: FontFamily.medium, textDecorationLine: 'line-through' },
    priceNote: { fontSize: 13, fontFamily: FontFamily.regular },
    invite: { padding: Spacing.lg, gap: Spacing.sm },
    inviteTitle: { fontSize: 17, fontFamily: FontFamily.semibold },
    dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    dot: { width: 10, height: 10, borderRadius: 5 },
    dotsText: { fontSize: 13, fontFamily: FontFamily.medium, marginLeft: Spacing.xs },
    note: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.regular, textAlign: 'center' },
});

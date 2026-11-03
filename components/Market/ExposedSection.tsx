import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, AppIcon, AppTextField, Avatar, GameCard, IconButton, IconTile, ListItem, SectionTitle, Text, VoidSheet, type BadgeProps } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { actOnExposed, createExposed, exposedActions, exposedFeed, type ExposedAction, type ExposedChallenge, type ExposedStatus } from '@/lib/exposed';
import { Control, Spacing } from '@/theme/designSystem';

/** Where a challenge stands, as the pill on its card. */
const STATUS: Record<ExposedStatus, BadgeProps> = {
    proposed: { label: 'Waiting', tone: 'neutral', dot: true },
    active: { label: 'Live', tone: 'cobalt', dot: true },
    claimed: { label: 'Claimed', tone: 'silver', icon: 'checkmark' },
    exposed: { label: 'Called out', tone: 'silver', icon: 'eye' },
    submitted: { label: 'In review', tone: 'silver', icon: 'time' },
    verified: { label: 'Verified', tone: 'cobalt', icon: 'checkmark-done' },
    lost: { label: 'Lost', tone: 'silver', icon: 'close' },
};
const ACTION: Record<ExposedAction, string> = {
    accept: 'Be their reviewer', claim: 'I did it', expose: 'Call their bluff', submit: 'Send proof', verify: 'Verify', reject: 'Ask for better proof', concede: 'Take the loss',
};
/** The one action that moves it forward is drawn solid; the rest are quiet. */
const PRIMARY: ExposedAction[] = ['accept', 'claim', 'submit', 'verify'];

export function ExposedSection() {
    const t = useTokens();
    const [feed, setFeed] = useState<Awaited<ReturnType<typeof exposedFeed>> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [sheet, setSheet] = useState<'create' | ExposedChallenge | null>(null);
    const [title, setTitle] = useState('');
    const [method, setMethod] = useState('');
    const [proof, setProof] = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try { setFeed(await exposedFeed()); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not load challenges.'); }
        finally { setLoading(false); }
    }, []);
    useFocusEffect(useCallback(() => { void load(); }, [load]));
    const act = async (challenge: ExposedChallenge, action: ExposedAction) => {
        setBusy(true);
        try { await actOnExposed(challenge.id, action); await load(); }
        catch (e) { Alert.alert('Challenge not updated', e instanceof Error ? e.message : 'Please try again.'); }
        finally { setBusy(false); }
    };
    const save = async () => {
        setBusy(true); setSaveError(null);
        try {
            if (sheet === 'create') await createExposed(title, method);
            else if (sheet) await actOnExposed(sheet.id, 'submit', proof);
            setSheet(null); setTitle(''); setMethod(''); setProof(''); await load();
        } catch (e) { setSaveError(e instanceof Error ? e.message : 'Could not save. Try again.'); }
        finally { setBusy(false); }
    };
    const make = () => { setSaveError(null); setSheet('create'); };
    return <View style={styles.section}>
        <SectionTitle right={<IconButton icon="add" label="Make a commitment" onPress={make} />}>Exposed</SectionTitle>
        {loading && !feed ? null : error ? <View style={styles.gap}><Text tone="danger">{error}</Text><AppButton label="Try again" variant="ghost" onPress={() => void load()} /></View> : <>
            {!feed?.challenges.length ? (
                <GameCard onPress={make} title="Make a big claim" subtitle="A friend checks the proof"
                    lead={<IconTile icon="eye" color={t.color.silver} size={Control.hitTarget} />} badge={{ label: 'No Shards', tone: 'neutral' }} />
            ) : null}
            {feed?.challenges.map(challenge => {
                const mine = challenge.owner_id === feed.me;
                const owner = challenge.ownerName ?? 'Friend';
                const actions = exposedActions(challenge, feed.me);
                return <ListItem key={challenge.id}><GameCard
                    lead={<Avatar name={mine ? 'You' : owner} size={Control.hitTarget} />}
                    title={challenge.title}
                    subtitle={challenge.reviewerName ? `${mine ? 'You' : owner} · checked by ${challenge.reviewer_id === feed.me ? 'you' : challenge.reviewerName}` : mine ? 'You' : owner}
                    badge={STATUS[challenge.status]}
                    footer={actions.length ? <View style={styles.actions}>{actions.map(action => <View key={action} style={styles.grow}><AppButton label={ACTION[action]} disabled={busy}
                        variant={PRIMARY.includes(action) ? undefined : 'ghost'} onPress={() => {
                            if (action === 'submit') { setProof(challenge.proof ?? ''); setSaveError(null); setSheet(challenge); }
                            else if (action === 'concede') Alert.alert('Take the loss?', 'This closes the challenge as a loss. Your wallet stays unchanged.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Take the loss', style: 'destructive', onPress: () => void act(challenge, action) }]);
                            else void act(challenge, action);
                        }} /></View>)}</View> : null}>
                    <View style={styles.gap}>
                        <View style={styles.proof}>
                            <AppIcon name="shield-checkmark" size={Spacing.lg} color={t.color.textMuted} />
                            <Text variant="bodySmall" tone="muted" grow>{challenge.proof_method}</Text>
                        </View>
                        {challenge.proof ? <Text variant="bodySmall" selectable>{challenge.proof}</Text> : null}
                    </View>
                </GameCard></ListItem>;
            })}
        </>}
        <VoidSheet visible={sheet !== null} onClose={() => { if (!busy) setSheet(null); }} title={sheet === 'create' ? 'Make a commitment' : 'The agreed proof'} scrollable>
            <View style={{ gap: Spacing.lg, padding: Spacing.xl }}>
                {sheet === 'create' ? <>
                    <AppTextField label="Your measurable challenge" placeholder="Finish 6 hours of deep work by Friday" value={title} onChangeText={setTitle} maxLength={160} />
                    <AppTextField label="How you’ll prove it" placeholder="A link to my focus-session summary" value={method} onChangeText={setMethod} maxLength={500} multiline />
                    <Text variant="bodySmall" tone="muted">Your friends can see this commitment. The first friend to agree becomes your reviewer. The challenge starts only after they agree; the proof method cannot change afterward.</Text>
                </> : sheet ? <>
                    <Text>{sheet.proof_method}</Text>
                    <AppTextField label="Your proof" placeholder="Add the agreed summary or evidence link" value={proof} onChangeText={setProof} maxLength={2000} multiline />
                    <Text variant="caption" tone="muted">Friends who can see this challenge can see the proof. Remove private information before sharing.</Text>
                </> : null}
                {saveError ? <Text tone="danger">{saveError}</Text> : null}
                <AppButton label={sheet === 'create' ? 'Share with friends' : 'Send proof for review'} loading={busy} disabled={sheet === 'create' ? title.trim().length < 3 || method.trim().length < 5 : proof.trim().length < 5} onPress={() => void save()} />
            </View>
        </VoidSheet>
    </View>;
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
    gap: { gap: Spacing.sm },
    grow: { flex: 1 },
    proof: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});

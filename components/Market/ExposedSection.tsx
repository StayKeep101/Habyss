import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, AppTextField, SectionTitle, Text, VoidCard, VoidSheet } from '@/components/ui';
import { actOnExposed, createExposed, exposedActions, exposedFeed, type ExposedAction, type ExposedChallenge, type ExposedStatus } from '@/lib/exposed';
import { Spacing } from '@/theme/designSystem';

const STATUS: Record<ExposedStatus, string> = {
    proposed: 'Waiting for a friend to agree', active: 'Proof method agreed · Challenge started',
    claimed: 'Completion claimed', exposed: 'Proof requested', submitted: 'Proof awaiting review', verified: 'Verified', lost: 'Loss accepted',
};
const ACTION: Record<ExposedAction, string> = {
    accept: 'Agree & become reviewer', claim: 'I did it', expose: 'Call their bluff', submit: 'Submit proof', verify: 'Verify proof', reject: 'Request better proof', concede: 'Take the loss',
};

export function ExposedSection() {
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
    return <View style={{ gap: Spacing.md, marginTop: Spacing.section }}>
        <SectionTitle>Exposed</SectionTitle>
        <Text variant="bodySmall" tone="muted">Big claim? Agree on the proof first. A friend can call your bluff after you say it’s done.</Text>
        <Text variant="caption" tone="muted">Visible to friends. Share only proof you choose, such as a summary or a link you control. No access to private data. No currency penalty.</Text>
        {loading ? <Text tone="muted">Loading challenges…</Text> : error ? <View style={{ gap: Spacing.sm }}><Text tone="danger">{error}</Text><AppButton label="Try again" onPress={() => void load()} /></View> : <>
            {!feed?.challenges.length ? <Text tone="muted">Make your first public commitment. A friend must agree to the proof method before it begins.</Text> : null}
            {feed?.challenges.map(challenge => <VoidCard key={challenge.id} style={{ padding: Spacing.lg, gap: Spacing.md }}>
                <Text variant="heading">{challenge.title}</Text>
                <Text variant="caption" tone={challenge.status === 'verified' ? 'success' : 'muted'}>{`${challenge.owner_id === feed.me ? 'Your challenge' : `${challenge.ownerName}’s challenge`} · ${STATUS[challenge.status]}`}</Text>
                <Text variant="bodySmall">{`${challenge.status === 'proposed' ? 'Proposed' : 'Agreed'} proof: ${challenge.proof_method}`}</Text>
                {challenge.reviewerName ? <Text variant="caption" tone="muted">{`Reviewer: ${challenge.reviewer_id === feed.me ? 'You' : challenge.reviewerName}`}</Text> : null}
                {challenge.proof ? <Text variant="bodySmall" selectable>{challenge.proof}</Text> : null}
                {exposedActions(challenge, feed.me).map(action => <AppButton key={action} label={ACTION[action]} disabled={busy} variant="ghost" onPress={() => {
                    if (action === 'submit') { setProof(challenge.proof ?? ''); setSaveError(null); setSheet(challenge); }
                    else if (action === 'concede') Alert.alert('Take the loss?', 'This closes the challenge as a loss. Your wallet stays unchanged.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Take the loss', style: 'destructive', onPress: () => void act(challenge, action) }]);
                    else void act(challenge, action);
                }} />)}
            </VoidCard>)}
            <AppButton label="Make a commitment" icon="flag" onPress={() => { setSaveError(null); setSheet('create'); }} />
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

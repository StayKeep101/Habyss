import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AppButton, AppTextField, ChoicePill, IconButton, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { createChallenge } from '@/lib/challenges';
import { oopsTitle } from '@/lib/voice';
import { Spacing } from '@/theme/designSystem';
import { GroupTitle } from './ChallengeParts';

const LENGTHS = [7, 14, 21, 30, 60, 75] as const;
const MAX_RULES = 8;
type Rule = { name: string; proof: 'photo' | 'tick' };

/**
 * Your own challenge: a name, how many days, and its rules, each proven by a
 * photo taken there and then or on your word. Made, it opens like any other,
 * to start alone or with friends. It pays no Shards: finishing is the prize.
 */
export function CreateChallenge({ onMade, onCancel }: { onMade: (id: string) => void; onCancel: () => void }) {
    const t = useTokens();
    const { selectionFeedback, successFeedback } = useHaptics();
    const [title, setTitle] = useState('');
    const [days, setDays] = useState<number>(30);
    const [rules, setRules] = useState<Rule[]>([{ name: '', proof: 'tick' }]);
    const [busy, setBusy] = useState(false);
    const ready = title.trim().length > 0 && rules.some(rule => rule.name.trim());

    const change = (index: number, patch: Partial<Rule>) => setRules(current => current.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)));
    const make = async () => {
        if (!ready || busy) return;
        setBusy(true);
        try {
            const id = await createChallenge({ title, days, rules, summary: `${days} days. ${rules.filter(rule => rule.name.trim()).length} rules a day. Miss one, and it’s over.` });
            successFeedback();
            onMade(id);
        } catch (failed) {
            Alert.alert(oopsTitle(), failed instanceof Error ? failed.message : 'Try again in a moment.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={styles.body}>
            <AppTextField label="Name" value={title} onChangeText={setTitle} placeholder="No Sugar November, 5 AM Club…" maxLength={60} accessibilityLabel="Challenge name" />

            <View style={styles.section}>
                <GroupTitle>How long</GroupTitle>
                <View style={styles.chips}>
                    {LENGTHS.map(length => (
                        <ChoicePill key={length} label={`${length} days`} on={days === length} color={t.color.accent} onPress={() => { selectionFeedback(); setDays(length); }} />
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <GroupTitle>The rules, every day</GroupTitle>
                {rules.map((rule, index) => (
                    <View key={index} style={styles.rule}>
                        <View style={styles.ruleHead}>
                            <View style={styles.flex}>
                                <AppTextField value={rule.name} onChangeText={name => change(index, { name })} placeholder={index === 0 ? 'No sugar' : 'Another rule'}
                                    maxLength={80} accessibilityLabel={`Rule ${index + 1}`} />
                            </View>
                            {rules.length > 1 ? (
                                <IconButton icon="close" label={`Remove rule ${index + 1}`} diameter={36} size={16}
                                    onPress={() => { selectionFeedback(); setRules(current => current.filter((_, at) => at !== index)); }} />
                            ) : null}
                        </View>
                        <View style={styles.chips}>
                            <ChoicePill label="On my word" icon="hand-right" on={rule.proof === 'tick'} color={t.color.accent} onPress={() => { selectionFeedback(); change(index, { proof: 'tick' }); }} />
                            <ChoicePill label="Photo proof" icon="camera" on={rule.proof === 'photo'} color={t.color.accent} onPress={() => { selectionFeedback(); change(index, { proof: 'photo' }); }} />
                        </View>
                    </View>
                ))}
                {rules.length < MAX_RULES ? (
                    <AppButton label="Add a rule" icon="add" variant="ghost" onPress={() => { selectionFeedback(); setRules(current => [...current, { name: '', proof: 'tick' }]); }} />
                ) : null}
            </View>

            <Text variant="caption" tone="muted">Yours to start, and your friends’ to join. It pays no Shards: finishing is the prize.</Text>
            <AppButton label={busy ? 'Making it…' : 'Make it'} icon="flame" variant="primary" loading={busy} disabled={!ready || busy} onPress={() => void make()} />
            <AppButton label="Back" variant="ghost" onPress={onCancel} />
        </View>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.xl, paddingBottom: Spacing.lg },
    section: { gap: Spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    rule: { gap: Spacing.sm },
    ruleHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    flex: { flex: 1 },
});

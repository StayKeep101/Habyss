import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PopupCard } from '@/components/ui/PopupCard';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { MatteInput } from '@/components/ui/MatteInput';
import { Avatar } from '@/components/ui/Avatar';
import { AppButton } from '@/components/ui/AppButton';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { giftFreeze, type GiftResult } from '@/lib/streakFreeze';
import { tryWord, vaultSize, currentEggs, type EggId } from '@/lib/echoEggs';
import { FeedService } from '@/lib/feedService';

const GIFT_SAYS: Record<GiftResult, string> = {
    sent: 'Sent', too_soon: 'Sent this week', full: 'They have 5 already',
    not_friends: 'Not possible', signed_out: 'Sign in first', offline: 'No connection',
};

/** What an easter egg opens: help a friend, a memory, or the vault. */
export function EggPopup({ egg, memory, onClose }: { egg: EggId | null; memory: string; onClose: () => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback, successFeedback, errorFeedback } = useHaptics();
    const [friends, setFriends] = useState<{ userId: string; name: string; avatarUrl?: string }[]>([]);
    const [sent, setSent] = useState<Record<string, GiftResult>>({});
    const [word, setWord] = useState('');
    const [secret, setSecret] = useState<string | null>(null);
    const [wrong, setWrong] = useState(false);

    useEffect(() => {
        if (egg !== 'help_friend') return;
        let alive = true;
        void FeedService.friendStatuses().then(rows => { if (alive) setFriends(rows.slice(0, 6)); }).catch(() => undefined);
        return () => { alive = false; };
    }, [egg]);

    const send = async (id: string) => {
        selectionFeedback();
        const result = await giftFreeze(id);
        if (result === 'sent') successFeedback(); else errorFeedback();
        setSent(previous => ({ ...previous, [id]: result }));
    };
    const tryIt = async () => {
        const found = await tryWord(word);
        if (found) { successFeedback(); setSecret(found); setWrong(false); setWord(''); }
        else { errorFeedback(); setWrong(true); }
    };

    if (egg === 'help_friend') {
        return (
            <PopupCard visible onClose={onClose} icon="snow" iconColor="#64D2FF" title="Help a friend out" body="Send a streak freeze. If they miss a day, it covers it.">
                {friends.length ? friends.map(friend => {
                    const result = sent[friend.userId];
                    return (
                        <View key={friend.userId} style={styles.friend}>
                            <Avatar name={friend.name} uri={friend.avatarUrl} size={34} />
                            <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{friend.name}</Text>
                            {result ? (
                                <Text style={[styles.result, { color: result === 'sent' ? colors.success : colors.textTertiary }]}>{GIFT_SAYS[result]}</Text>
                            ) : (
                                <Pressable accessibilityRole="button" accessibilityLabel={`Send ${friend.name} a streak freeze`} onPress={() => void send(friend.userId)}>
                                    <MatteSurface radius={Radius.pill} level="control" tint={primary} style={styles.give}>
                                        <Text style={[styles.giveText, { color: textOn(primary) }]}>Send</Text>
                                    </MatteSurface>
                                </Pressable>
                            )}
                        </View>
                    );
                }) : <Text style={[styles.note, { color: colors.textTertiary }]}>Add a friend first, then come back.</Text>}
            </PopupCard>
        );
    }

    if (egg === 'memory') {
        return (
            <PopupCard visible onClose={onClose} icon="sparkles" iconColor={primary} title="Something I noticed" body={memory}>
                <AppButton label="Keep going" onPress={onClose} />
            </PopupCard>
        );
    }

    if (egg === 'vault') {
        const found = currentEggs().words.length;
        return (
            <PopupCard visible onClose={onClose} icon="lock-closed" iconColor={primary} title={secret ? 'Unlocked' : 'The vault'}
                body={secret ?? 'Say the word. Some words open things.'}>
                {secret ? null : (
                    <MatteInput value={word} onChangeText={text => { setWord(text); setWrong(false); }} placeholder="A word…"
                        placeholderTextColor={colors.textTertiary} autoCapitalize="none" autoCorrect={false} returnKeyType="go"
                        onSubmitEditing={() => void tryIt()} invalid={wrong} style={[styles.field, { color: colors.textPrimary }]} accessibilityLabel="Vault word" />
                )}
                {wrong ? <Text style={[styles.note, { color: colors.textTertiary }]}>Not that one.</Text> : null}
                <Text style={[styles.note, { color: colors.textTertiary }]}>Secrets found: {found} of {vaultSize}</Text>
                {secret ? <AppButton label="Close" onPress={onClose} /> : <AppButton label="Try" disabled={!word.trim()} onPress={() => void tryIt()} />}
            </PopupCard>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    friend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
    name: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    give: { paddingHorizontal: Spacing.lg, paddingVertical: 7 },
    giveText: { fontFamily: FontFamily.semibold, fontSize: 13 },
    result: { fontFamily: FontFamily.medium, fontSize: 13 },
    note: { fontFamily: FontFamily.regular, fontSize: 13, textAlign: 'center' },
    field: { fontFamily: FontFamily.medium, fontSize: 16, textAlign: 'center' },
});

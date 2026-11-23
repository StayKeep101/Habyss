import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton, AppIcon, ListItem, MatteSurface, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { on } from '@/lib/appEvents';
import { raceFeed, type Race } from '@/lib/races';
import { Radius, Spacing } from '@/theme/designSystem';
import { RaceCard } from './RaceCard';
import { RaceSheet } from './RaceSheet';

/**
 * Race the clock, at the top of Challenges: with no race of yours running, a
 * card that starts one ("your top tasks in the next hours, Shards on it");
 * then your race and your friends', live, and the ones that ended this week.
 */
export function RaceSection({ style }: { style?: StyleProp<ViewStyle> }) {
    const t = useTokens();
    const router = useRouter();
    const { mediumFeedback } = useHaptics();
    const [races, setRaces] = useState<Race[] | null>(null);
    const [setting, setSetting] = useState(false);
    const load = useCallback(() => { raceFeed().then(setRaces).catch(() => setRaces([])); }, []);
    useFocusEffect(load);
    useEffect(() => { const sub = on('market_changed', load); return () => sub.remove(); }, [load]);
    if (races === null) return null;
    const mineRunning = races.some(race => race.mine && race.status === 'open');
    return (
        <View style={[styles.section, style]}>
            {mineRunning ? null : (
                <MatteSurface radius={Radius.card} style={styles.hero}>
                    <LinearGradient pointerEvents="none" colors={[t.tint('soft', t.color.warning), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    <View style={styles.heroBody}>
                        <View style={styles.heroHead}>
                            <AppIcon name="flash" filled size={Spacing.xxl + Spacing.sm} color={t.color.warning} />
                            <Text variant="title" grow>Race the clock</Text>
                        </View>
                        <Text variant="bodySmall" tone="muted">Your top tasks, a time to beat, and Shards on it. Make it and Habyss matches your stake. Your friends bet for you or against you.</Text>
                        <AppButton label="Start a race" icon="flash" variant="primary" onPress={() => { mediumFeedback(); setSetting(true); }} />
                    </View>
                </MatteSurface>
            )}
            {races.map((race, index) => (
                <ListItem key={race.id} index={index}>
                    <RaceCard race={race} onChanged={load} onOpenPerson={id => router.push({ pathname: '/(root)/friend', params: { id } } as never)} />
                </ListItem>
            ))}
            <RaceSheet visible={setting} onClose={() => setSetting(false)} onStarted={() => { setSetting(false); load(); }} />
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
    hero: { overflow: 'hidden' },
    heroBody: { padding: Spacing.lg, gap: Spacing.md },
    heroHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});

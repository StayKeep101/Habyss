import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ListItem } from '@/components/ui';
import { on } from '@/lib/appEvents';
import { raceFeed, type Race } from '@/lib/races';
import { Spacing } from '@/theme/designSystem';
import { RaceCard } from './RaceCard';

/**
 * Races, at the top of Challenges: yours and your friends', live, and the
 * ones that ended this week. A new one is set from the + (RaceSheet).
 */
export function RaceSection({ style, onShown }: { style?: StyleProp<ViewStyle>; onShown?: (shown: boolean) => void }) {
    const router = useRouter();
    const [races, setRaces] = useState<Race[] | null>(null);
    const load = useCallback(() => { raceFeed().then(setRaces).catch(() => setRaces([])); }, []);
    useFocusEffect(load);
    useEffect(() => { const sub = on('market_changed', load); return () => sub.remove(); }, [load]);
    const shown = !!races?.length;
    useEffect(() => { if (races !== null) onShown?.(shown); }, [races, shown, onShown]);
    if (!races?.length) return null;
    return (
        <View style={[styles.section, style]}>
            {races.map((race, index) => (
                <ListItem key={race.id} index={index}>
                    <RaceCard race={race} onChanged={load} onOpenPerson={id => router.push({ pathname: '/(root)/friend', params: { id } } as never)} />
                </ListItem>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
});

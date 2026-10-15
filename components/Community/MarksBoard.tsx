import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatedFill, CountUp, MOTION } from '@/components/ui/Motion';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { rankFor } from '@/lib/marks';

export interface MarksPerson { id: string; name: string; avatarUrl?: string; marks: number; isYou?: boolean }

/**
 * Everybody's Marks, side by side.
 *
 * Marks are the record of keeping your word over time, so seeing a friend a
 * rank ahead is a reason to keep yours rather than a verdict on a bad day —
 * which is why this shows ranks and totals, highest first, and nothing about
 * what anybody missed.
 */
export const MarksBoard: React.FC<{ people: MarksPerson[]; onPick?: (id: string) => void }> = ({ people, onPick }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const light = theme === 'light';
    const { primary } = useAccentGradient();
    if (people.length === 0) return null;
    const sorted = [...people].sort((a, b) => b.marks - a.marks);
    const top = Math.max(1, sorted[0].marks);

    return (
        <View>
        <SectionTitle first right={<Text style={[styles.sub, { color: colors.textTertiary }]}>Discipline, kept over time</Text>}>Marks</SectionTitle>
        <VoidCard glass={theme !== 'trueDark'} intensity={light ? 20 : 80} style={[styles.card]}>
            {sorted.map((person, index) => {
                const { rank } = rankFor(person.marks);
                return (
                    <Pressable
                        key={person.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${person.isYou ? 'You' : person.name}: ${rank.name}, ${person.marks} Marks`}
                        onPress={() => onPick?.(person.id)}
                        style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                    >
                        <Text style={[styles.place, { color: index === 0 ? primary : colors.textTertiary }]}>{index + 1}</Text>
                        <View style={[styles.avatar, { backgroundColor: light ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.07)' }]}>
                            {person.avatarUrl
                                ? <Image source={{ uri: person.avatarUrl }} style={styles.photo} />
                                : <Text style={[styles.initial, { color: primary }]}>{person.name.slice(0, 1).toUpperCase()}</Text>}
                        </View>
                        <View style={styles.who}>
                            <View style={styles.nameRow}>
                                <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}>
                                    {person.isYou ? 'You' : person.name}
                                </Text>
                                <Text numberOfLines={1} style={[styles.rank, { color: colors.textTertiary }]}>{rank.name}</Text>
                            </View>
                            <View style={[styles.track, { backgroundColor: light ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.07)' }]}>
                                <AnimatedFill progress={Math.max(0.03, person.marks / top)} delay={index * MOTION.stagger} style={[styles.fill, { backgroundColor: person.isYou ? primary : primary + '99' }]} /> {/* ui-allow: decorative */}
                            </View>
                        </View>
                        <CountUp style={[styles.total, { color: colors.textPrimary }]} value={person.marks.toLocaleString()} />
                    </Pressable>
                );
            })}
        </VoidCard>
        </View>
    );
};

const styles = StyleSheet.create({
    card: { paddingHorizontal: s(16), paddingVertical: s(6), borderRadius: s(22), marginBottom: s(16) },
    sub: { fontSize: ms(12), fontFamily: FontFamily.regular, flexShrink: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(10) },
    place: { width: s(16), textAlign: 'center', fontSize: ms(13), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    avatar: { width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    photo: { width: '100%', height: '100%' },
    initial: { fontSize: ms(14), fontFamily: FontFamily.bold },
    who: { flex: 1, gap: s(5) },
    nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: s(8) },
    name: { flexShrink: 1, fontSize: ms(15) },
    rank: { fontSize: ms(12), fontFamily: FontFamily.regular },
    track: { height: s(4), borderRadius: 2, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 2 },
    total: { minWidth: s(48), textAlign: 'right', fontSize: ms(16), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
});

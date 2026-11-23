import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnimatedFill, Avatar, Divider, IconTile, Text } from '@/components/ui';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import type { ChallengeItem, Difficulty, Member } from '@/lib/challenges';
import { Control, Radius, Spacing } from '@/theme/designSystem';

export const PROOF_WORD = { health: 'Apple Health', focus: 'Focus timer', photo: 'Photo', tick: 'On your word' } as const;

/** Each level's colour, always said in words beside it too. */
export function useLevelColor(): Record<Difficulty, string> {
    const t = useTokens();
    return { easy: t.color.success, medium: t.color.warning, hard: t.color.danger };
}

/** A challenge's icon: a soft square in its level's colour. */
export function ChallengeIcon({ icon, difficulty, size = Control.hitTarget }: { icon: string; difficulty: Difficulty; size?: number }) {
    const color = useLevelColor()[difficulty];
    return <IconTile icon={icon} color={color} size={size} shape="square" muted />;
}

/** "250" with the Shard crystal. */
export function Reward({ amount, each }: { amount: number; each?: boolean }) {
    return (
        <View style={styles.reward} accessible accessibilityLabel={`${amount} Shards${each ? ' each' : ''}`}>
            <ShardIcon size={Spacing.lg} />
            <Text variant="heading" numeric>{amount}</Text>
            {each ? <Text variant="bodySmall" tone="muted">each</Text> : null}
        </View>
    );
}

/** A small heading over a group, the way iOS heads an inset list. */
export function GroupTitle({ children }: { children: string }) {
    return <View style={styles.groupTitle}><Text variant="caption" tone="muted">{children.toUpperCase()}</Text></View>;
}

/** Rows on one matte card, hairlines between them (iOS's inset grouped list). */
export function Group({ children }: { children: React.ReactNode }) {
    const rows = React.Children.toArray(children).filter(Boolean);
    return (
        <MatteSurface radius={Radius.card} style={styles.group}>
            {rows.map((row, index) => <React.Fragment key={index}>{index ? <Divider inset /> : null}{row}</React.Fragment>)}
        </MatteSurface>
    );
}

/** What a challenge adds to your plan: its name, how often, and how it is proven. */
export function ItemRow({ item, difficulty }: { item: ChallengeItem; difficulty: Difficulty }) {
    return (
        <View style={styles.row}>
            <ChallengeIcon icon={item.icon ?? 'checkmark'} difficulty={difficulty} size={Control.hitTarget - Spacing.xs} />
            <View style={styles.grow}>
                <Text variant="body" numberOfLines={1}>{item.name}</Text>
                <Text variant="caption" tone="muted">{item.kind === 'task' ? 'Once, by the last day' : 'Every day'} · {PROOF_WORD[item.proof]}</Text>
            </View>
        </View>
    );
}

/** One person: their face, their name, and their days kept as a thin bar. */
export function MemberRow({ member, days, me }: { member: Member; days: number; me?: boolean }) {
    const t = useTokens();
    const invited = member.status === 'invited';
    return (
        <View style={styles.row} accessible accessibilityLabel={`${me ? 'You' : member.name}, ${invited ? 'invited' : `${member.kept} of ${days} days`}`}>
            <Avatar name={member.name} uri={member.avatar} size={Control.hitTarget - Spacing.xs} dim={invited} />
            <View style={styles.grow}>
                <View style={styles.between}>
                    <Text variant="body" numberOfLines={1}>{me ? 'You' : member.name.split(' ')[0]}</Text>
                    <Text variant="bodySmall" tone="muted" numeric>{invited ? 'Invited' : `${member.kept} / ${days}`}</Text>
                </View>
                {invited ? null : (
                    <View style={[styles.track, { backgroundColor: t.color.border }]}>
                        <AnimatedFill progress={member.kept / Math.max(1, days)} style={[styles.fill, { backgroundColor: t.color.accent }]} />
                    </View>
                )}
            </View>
        </View>
    );
}

/** Days as small segments (up to 14), or one bar for a longer run: how many you've kept. */
export function DayStrip({ kept, days }: { kept: number; days: number }) {
    const t = useTokens();
    if (days > 14) {
        return (
            <View style={[styles.track, { backgroundColor: t.color.border }]}>
                <AnimatedFill progress={kept / days} style={[styles.fill, { backgroundColor: t.color.accent }]} />
            </View>
        );
    }
    return (
        <View style={styles.strip} accessible accessibilityLabel={`${kept} of ${days} days kept`}>
            {Array.from({ length: days }, (_, index) => (
                <View key={index} style={[styles.segment, { backgroundColor: index < kept ? t.color.accent : t.color.border }]} />
            ))}
        </View>
    );
}

/** Faces overlapping, the way iOS shows who is in a group. */
export function FaceStack({ members }: { members: Member[] }) {
    const t = useTokens();
    return (
        <View style={styles.stack}>
            {members.slice(0, 4).map((member, index) => (
                <View key={member.id} style={[styles.stackFace, index ? styles.overlap : null, { borderColor: t.color.surface }]}>
                    <Avatar name={member.name} uri={member.avatar} size={Spacing.xxl} dim={member.status === 'invited'} />
                </View>
            ))}
        </View>
    );
}

/** A quiet destructive action at the foot of a sheet, as iOS words it. */
export function DangerLink({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.link}>
            <Text variant="heading" tone="danger" align="center">{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    reward: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    groupTitle: { paddingHorizontal: Spacing.lg, marginBottom: -Spacing.xs },
    group: { paddingHorizontal: Spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.height, paddingVertical: Spacing.sm },
    grow: { flex: 1, gap: Spacing.xs / 2 },
    between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
    track: { height: Spacing.xs + 2, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
    strip: { flexDirection: 'row', gap: Spacing.xs },
    segment: { flex: 1, height: Spacing.sm, borderRadius: Radius.pill },
    stack: { flexDirection: 'row' },
    stackFace: { borderWidth: 2, borderRadius: Radius.pill },
    overlap: { marginLeft: -Spacing.sm },
    link: { minHeight: Control.hitTarget, justifyContent: 'center' },
});

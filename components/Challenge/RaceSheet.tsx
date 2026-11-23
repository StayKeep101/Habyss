import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppButton, AppIcon, ChoicePill, CountUp, StepSlider, Text, VoidCard, VoidSheet } from '@/components/ui';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useTokens } from '@/hooks/useTokens';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { dailyFocus } from '@/lib/dailyFocus';
import { myWallet } from '@/lib/market';
import { MATCH_CAP, RACE_MAX, expectedMinutes, openRace, raceTimes, raceTitle } from '@/lib/races';
import { todayKey } from '@/lib/tasks';
import { oopsTitle } from '@/lib/voice';
import { Control, Radius, Spacing } from '@/theme/designSystem';

/** "45 min", "2 h", "3 h 15 min". */
const timeLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`);
/** Stakes offered under the balance: steps that grow, then All in. */
const STEPS = [25, 50, 100, 250, 500, 1000, 2500, 5000];

/**
 * Setting a race: which tasks (today's most important, already ticked in),
 * how long (30 minutes to 6 hours), and how many Shards on it (or all of
 * them). It says what a win pays (your stake back, matched by Habyss up to
 * 500 on your first race of the day) and what a miss costs, then starts the
 * clock; your friends hear about it and can bet.
 */
export function RaceSheet({ visible, onClose, onStarted }: { visible: boolean; onClose: () => void; onStarted: () => void }) {
    const t = useTokens();
    const { selectionFeedback, successFeedback } = useHaptics();
    const tasks = useTasks();
    const target = useDailyTarget();
    const today = todayKey();
    const open = useMemo(() => tasks.filter(task => task.status !== 'done' && (!task.dueDate || task.dueDate <= today)), [tasks, today]);
    const top = useMemo(() => dailyFocus(tasks, target, today, today).rows.filter(task => task.status !== 'done').map(task => task.id), [tasks, target, today]);
    const [picked, setPicked] = useState<string[]>([]);
    const [minutes, setMinutes] = useState<number>(180);
    const [stake, setStake] = useState(100);
    const [balance, setBalance] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);

    // Opened: today's most important already in, and what you can spend.
    const [shownFor, setShownFor] = useState(false);
    if (visible !== shownFor) {
        setShownFor(visible);
        if (visible) { setPicked(top.length ? top : open.slice(0, 3).map(task => task.id)); setMinutes(RACE_MAX); }
    }
    useEffect(() => {
        if (!visible) return;
        void myWallet().then(wallet => { setBalance(wallet.spendable); if (wallet.spendable !== null) setStake(current => Math.min(current, Math.max(1, wallet.spendable ?? 1))); }).catch(() => setBalance(null));
    }, [visible]);

    // Faster than the tasks should take, never slower: their estimates, 90 minutes each without one.
    const expected = expectedMinutes(picked.map(id => open.find(task => task.id === id) ?? {}));
    const times = raceTimes(expected);
    const chosenTime = Math.min(minutes, times[times.length - 1]);
    const steps = STEPS.filter(step => balance === null || step < balance);
    const allIn = balance !== null && stake === balance;
    const toggle = (id: string) => {
        selectionFeedback();
        setPicked(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= 10 ? current : [...current, id]);
    };
    const start = async () => {
        if (busy || !picked.length) return;
        setBusy(true);
        try {
            await openRace(picked.map(id => ({ key: id, title: open.find(task => task.id === id)?.title ?? 'A task' })), chosenTime, stake);
            successFeedback();
            onStarted();
        } catch (failed) {
            Alert.alert(oopsTitle(), failed instanceof Error ? failed.message : 'Try again in a moment.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <VoidSheet visible={visible} onClose={onClose} title="Race the clock" caption={picked.length ? raceTitle(picked.length, chosenTime) : 'Pick what you will finish'} scrollable maxShare={0.92}
            footer={(
                <View style={styles.foot}>
                    <AppButton label={busy ? 'Starting…' : `Start · ${stake.toLocaleString()} Shards`} icon="flash" variant="primary" loading={busy}
                        disabled={!picked.length || busy || (balance !== null && balance < 1)} onPress={() => void start()} />
                </View>
            )}>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {/* 1 · What you will finish. */}
                <Step number={1} title="What you’ll finish" note={picked.length ? `${picked.length} of ${Math.min(10, open.length)}` : undefined}>
                    {open.length ? open.slice(0, 12).map(task => {
                        const on = picked.includes(task.id);
                        return (
                            <Pressable key={task.id} onPress={() => toggle(task.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                                accessibilityLabel={task.title} style={styles.task}>
                                <AppIcon name={on ? 'checkmark-circle' : 'ellipse-outline'} filled={on} size={Spacing.xl + 2} color={on ? t.color.accent : t.color.textSubtle} />
                                <Text variant="body" grow numberOfLines={1} tone={on ? 'primary' : 'muted'}>{task.title}</Text>
                                {top.includes(task.id) ? <Text variant="caption" tone="accent">Top</Text> : null}
                            </Pressable>
                        );
                    }) : <Text variant="bodySmall" tone="muted">Nothing to race yet: add today’s tasks first.</Text>}
                </Step>

                {/* 2 · How fast: up to what the tasks should take. */}
                {picked.length ? (
                    <Step number={2} title="How fast" note={`They should take ${timeLabel(expected)}`}>
                        <StepSlider label="Beat the clock in" values={times} value={chosenTime} say={timeLabel}
                            onChange={value => { selectionFeedback(); setMinutes(value); }} />
                    </Step>
                ) : null}

                {/* 3 · How many Shards on it. */}
                <Step number={3} title="Your stake" note={balance !== null ? `You have ${balance.toLocaleString()}` : undefined}>
                    <View style={styles.stakeRow}>
                        <ShardIcon size={Control.icon * 2} />
                        <CountUp value={stake.toLocaleString()} style={[t.type.display, { color: t.color.textPrimary }]} />
                    </View>
                    <View style={styles.chips}>
                        {steps.map(step => (
                            <ChoicePill key={step} label={step.toLocaleString()} on={stake === step} color={t.color.accent}
                                onPress={() => { selectionFeedback(); setStake(step); }} />
                        ))}
                        {balance !== null && balance > 0 ? (
                            <ChoicePill label="All in" icon="flame" on={allIn} color={t.color.warning}
                                onPress={() => { selectionFeedback(); setStake(balance); }} accessibilityLabel={`All in, ${balance} Shards`} />
                        ) : null}
                    </View>
                </Step>

                {/* What happens. */}
                <View style={[styles.terms, { backgroundColor: t.color.surfaceRaised }]}>
                    <View style={styles.term}>
                        <AppIcon name="trophy" filled size={Spacing.lg} color={t.color.success} />
                        <Text variant="bodySmall" grow>{`Done in time: your ${stake.toLocaleString()} back, and Habyss matches it (up to ${MATCH_CAP}, your first race of the day).`}</Text>
                    </View>
                    <View style={styles.term}>
                        <AppIcon name="hourglass" filled size={Spacing.lg} color={t.color.danger} />
                        <Text variant="bodySmall" grow>Out of time: your stake goes to friends who bet against you.</Text>
                    </View>
                    <View style={styles.term}>
                        <AppIcon name="people" filled size={Spacing.lg} color={t.color.accentText} />
                        <Text variant="bodySmall" grow>Your friends hear about it and can bet for you or against you.</Text>
                    </View>
                </View>
            </ScrollView>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.lg },
    step: { padding: Spacing.lg, gap: Spacing.sm },
    stepHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    stepNumber: { width: Spacing.xl + 2, height: Spacing.xl + 2, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    task: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.hitTarget },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    stakeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    terms: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.md },
    term: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    foot: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});

/** One step of setting a race: its number and name, a note on the right, then what it holds, on a card. */
function Step({ number, title, note, children }: { number: number; title: string; note?: string; children: React.ReactNode }) {
    const t = useTokens();
    return (
        <VoidCard style={styles.step}>
            <View style={styles.stepHead}>
                <View style={[styles.stepNumber, { backgroundColor: t.color.accent }]}><Text variant="caption" tone="onAccent">{String(number)}</Text></View>
                <Text variant="heading" grow>{title}</Text>
                {note ? <Text variant="caption" tone="muted">{note}</Text> : null}
            </View>
            {children}
        </VoidCard>
    );
}

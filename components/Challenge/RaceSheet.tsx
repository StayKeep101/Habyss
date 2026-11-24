import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppButton, AppIcon, ChoicePill, ModalHeader, StepSlider, Text } from '@/components/ui';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { DetailBar, type DetailItem } from '@/components/Create/DetailBar';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useTokens } from '@/hooks/useTokens';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { on } from '@/lib/appEvents';
import { dailyFocus } from '@/lib/dailyFocus';
import { localDateKey } from '@/lib/habitSchedule';
import { myWallet } from '@/lib/market';
import { RACE_MAX, expectedMinutes, openRace, ownerWin, raceFeed, raceTimes, raceTitle } from '@/lib/races';
import { todayKey } from '@/lib/tasks';
import { oopsTitle } from '@/lib/voice';
import { Control, Spacing } from '@/theme/designSystem';

/** "45 min", "2 h", "3 h 15 min". */
const timeLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`);
/** Stakes offered under the balance: steps that grow, then All in. */
const STEPS = [25, 50, 100, 250, 500, 1000, 2500, 5000];
/** The most tasks one race holds. */
const MOST = 10;

/**
 * Setting a race, from the + on Community: the same card habits and tasks are
 * written in (ComposerModal), under your thumb. Today's open tasks to tick
 * (the most important already in), then Time and Stake as chips, then what a
 * win pays and what a miss costs, as two figures beside Start. Mounted once
 * over the app; opened by `show_race`.
 */
export function RaceSheet() {
    const t = useTokens();
    const { selectionFeedback, successFeedback } = useHaptics();
    const tasks = useTasks();
    const target = useDailyTarget();
    const today = todayKey();
    const open = useMemo(() => tasks.filter(task => task.status !== 'done' && (!task.dueDate || task.dueDate <= today)), [tasks, today]);
    const top = useMemo(() => dailyFocus(tasks, target, today, today).rows.filter(task => task.status !== 'done').map(task => task.id), [tasks, target, today]);
    const [visible, setVisible] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);
    const [minutes, setMinutes] = useState<number>(RACE_MAX);
    const [stake, setStake] = useState(100);
    const [balance, setBalance] = useState<number | null>(null);
    // Habyss matches only your first race of the day.
    const [firstToday, setFirstToday] = useState(true);
    const [panel, setPanel] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Opened: today's most important already in, and what you can spend.
    // Today's lists as they are now, read when it opens, without re-subscribing.
    const latest = useRef({ top, open });
    useEffect(() => { latest.current = { top, open }; }, [top, open]);
    useEffect(() => {
        const sub = on('show_race', () => {
            const { top: first, open: all } = latest.current;
            setPicked(first.length ? first.slice(0, MOST) : all.slice(0, 3).map(task => task.id));
            setMinutes(RACE_MAX);
            setPanel(null);
            setVisible(true);
            void myWallet().then(wallet => {
                setBalance(wallet.spendable);
                if (wallet.spendable !== null) setStake(current => Math.min(current, Math.max(1, wallet.spendable ?? 1)));
            }).catch(() => setBalance(null));
            const day = localDateKey(new Date());
            void raceFeed().then(races => setFirstToday(!races.some(race => race.mine && localDateKey(new Date(race.startsAt)) === day))).catch(() => undefined);
        });
        return () => sub.remove();
    }, []);

    // Faster than the tasks should take, never slower: their estimates, 90 minutes each without one.
    const expected = expectedMinutes(picked.map(id => open.find(task => task.id === id) ?? {}));
    const times = raceTimes(expected);
    const chosenTime = Math.min(minutes, times[times.length - 1]);
    const steps = STEPS.filter(step => balance === null || step < balance);
    const allIn = balance !== null && stake === balance;
    const broke = balance !== null && balance < 1;
    const close = () => setVisible(false);
    const toggle = (id: string) => {
        selectionFeedback();
        setPicked(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= MOST ? current : [...current, id]);
    };
    const start = async () => {
        if (busy || !picked.length) return;
        setBusy(true);
        try {
            await openRace(picked.map(id => ({ key: id, title: open.find(task => task.id === id)?.title ?? 'A task' })), chosenTime, stake);
            successFeedback();
            close();
        } catch (failed) {
            Alert.alert(oopsTitle(), failed instanceof Error ? failed.message : 'Try again in a moment.');
        } finally {
            setBusy(false);
        }
    };

    const items: DetailItem[] = [
        {
            id: 'time', icon: 'timer-outline', label: 'Time', value: picked.length ? timeLabel(chosenTime) : undefined, hidden: !picked.length,
            content: (
                <StepSlider label="Beat the clock in" values={times} value={chosenTime} say={timeLabel}
                    onChange={value => { selectionFeedback(); setMinutes(value); }} />
            ),
        },
        {
            id: 'stake', icon: 'diamond-outline', label: 'Stake', value: stake.toLocaleString(),
            content: (
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
            ),
        },
    ];

    // The most a win pays: done within half the time (the speed bonus in full).
    const win = ownerWin(stake, firstToday, 0);
    return (
        <ComposerModal visible={visible} onClose={close}>
            <ModalHeader title="Race the clock" subtitle={picked.length ? raceTitle(picked.length, chosenTime) : undefined} />

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} alwaysBounceVertical={false}>
                {open.length ? open.slice(0, 12).map(task => {
                    const on = picked.includes(task.id);
                    return (
                        <Pressable key={task.id} onPress={() => toggle(task.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                            accessibilityLabel={task.title} style={styles.task}>
                            <AppIcon name={on ? 'checkmark-circle' : 'ellipse-outline'} filled={on} size={Control.icon} color={on ? t.color.accent : t.color.textSubtle} />
                            <Text variant="body" grow numberOfLines={1} tone={on ? 'primary' : 'muted'}>{task.title}</Text>
                            {top.includes(task.id) ? <AppIcon name="star" filled size={Spacing.md} color={t.color.warning} accessibilityLabel="Top task" /> : null}
                        </Pressable>
                    );
                }) : <Text variant="bodySmall" tone="muted">No tasks today</Text>}
            </ScrollView>

            <DetailBar fitContent items={items} open={panel} onToggle={setPanel} accent={t.color.accent} />

            <View style={styles.footer}>
                {/* What a win pays, what a miss costs: two figures, no sentences. */}
                <View style={styles.terms} accessible accessibilityLabel={`Win up to ${win} Shards, more the faster you finish; miss and lose ${stake}`}>
                    <View style={styles.term}>
                        <AppIcon name="trophy" filled size={Spacing.lg} color={t.color.success} />
                        <Text variant="bodySmall" tone="success">{`Up to +${win.toLocaleString()}`}</Text>
                    </View>
                    <View style={styles.term}>
                        <AppIcon name="hourglass" filled size={Spacing.lg} color={t.color.danger} />
                        <Text variant="bodySmall" tone="danger">{`−${stake.toLocaleString()}`}</Text>
                    </View>
                </View>
                <AppButton label={busy ? 'Starting…' : 'Start'} icon="flash" variant="primary" loading={busy}
                    disabled={!picked.length || busy || broke} onPress={() => void start()} />
            </View>
        </ComposerModal>
    );
}

const styles = StyleSheet.create({
    // As tall as the list, giving up room first when the card reaches the top of the screen.
    list: { flexGrow: 0, flexShrink: 3 },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    task: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.hitTarget },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },
    terms: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl },
    term: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});

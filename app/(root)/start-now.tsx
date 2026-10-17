import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppButton } from '@/components/ui/AppButton';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { MatteInput } from '@/components/ui/MatteInput';
import { IconTile } from '@/components/ui/IconTile';
import { AnimatedFill, ListItem } from '@/components/ui/Motion';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { Colors } from '@/theme/colors';
import { Radius } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useEchoCoach } from '@/hooks/useEchoCoach';
import { addNote, helpRanking, recordHelp, type HelpType } from '@/lib/echoMemory';
import { firstStepFor, OBSTACLES, smartFirstStep, tipFor, type Obstacle } from '@/lib/firstStep';
import { CRISIS_MESSAGE, soundsLikeCrisis } from '@/lib/echoSafety';
import { tasksForDay, setTaskStatus } from '@/lib/tasks';
import { isTimedHabit, isHabitScheduledForDate, toggleCompletion } from '@/lib/habitsSQLite';
import { emit } from '@/lib/appEvents';
import { styles } from '@/styles/screens/start-now.styles';

type Phase = 'ready' | 'running' | 'after' | 'plan';
const HELP: Record<HelpType, { label: string; seconds: number }> = {
    two_minute: { label: 'Start 2 minutes', seconds: 120 },
    five_minute: { label: 'Start 5 minutes', seconds: 300 },
    plan: { label: 'Make it a plan', seconds: 0 },
};
const ANCHORS = ['I wake up', 'breakfast', 'my coffee', 'lunch', 'work', 'dinner'];
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * For when you cannot start. Not a pep talk: pick the one thing, see the
 * smallest first step, say what is in the way if you like, and start a two or
 * five minute clock, or turn it into a plan ("After breakfast, I will…").
 * Echo puts first whichever help has actually worked for you before.
 */
export default function StartNow() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback, successFeedback, lightFeedback } = useHaptics();
    const params = useLocalSearchParams<{ item?: string; title?: string }>();
    const coach = useEchoCoach();

    const [picked, setPicked] = useState<{ item: string; title: string } | null>(params.item && params.title ? { item: params.item, title: params.title } : null);
    // The rule's step at once; the on-device model's wording replaces it if it has one.
    const [smartStep, setSmartStep] = useState<{ title: string; step: string } | null>(null);
    const step = !picked ? '' : smartStep?.title === picked.title ? smartStep.step : firstStepFor(picked.title);
    const [phase, setPhase] = useState<Phase>('ready');
    const [obstacle, setObstacle] = useState<Obstacle | null>(null);
    const [note, setNote] = useState('');
    const [crisis, setCrisis] = useState(false);
    const [left, setLeft] = useState(0);
    const [total, setTotal] = useState(0);
    const [anchor, setAnchor] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!picked) return;
        let alive = true;
        void smartFirstStep(picked.title).then(better => { if (alive) setSmartStep({ title: picked.title, step: better }); });
        return () => { alive = false; };
    }, [picked]);
    useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

    // What to choose from: today's open tasks, then today's habits not yet done.
    const choices = useMemo(() => {
        const tasks = tasksForDay(coach.tasks, coach.today, coach.today).filter(task => task.status === 'open')
            .slice(0, 5).map(task => ({ item: `task:${task.id}`, title: task.title, kind: 'Task' }));
        const now = new Date();
        const habits = coach.habits.filter(habit => !habit.isGoal && !habit.isArchived && !coach.completions[habit.id] && isHabitScheduledForDate(habit, now))
            .slice(0, 5).map(habit => ({ item: `habit:${habit.id}`, title: habit.name, kind: 'Habit' }));
        return [...tasks, ...habits];
    }, [coach.tasks, coach.habits, coach.completions, coach.today]);

    const order = helpRanking(coach.memory.helps).map(entry => entry.type);

    const begin = (type: HelpType) => {
        if (!picked) return;
        selectionFeedback();
        void recordHelp(type, picked.item, coach.today);
        if (type === 'plan') { setPhase('plan'); return; }
        const seconds = HELP[type].seconds;
        setTotal(seconds); setLeft(seconds); setPhase('running');
        if (timer.current) clearInterval(timer.current);
        timer.current = setInterval(() => setLeft(value => {
            if (value <= 1) { if (timer.current) clearInterval(timer.current); timer.current = null; successFeedback(); setPhase('after'); return 0; }
            return value - 1;
        }), 1000);
    };

    const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setPhase('after'); };

    const markDone = async () => {
        if (!picked) return;
        const id = picked.item.slice(picked.item.indexOf(':') + 1);
        if (picked.item.startsWith('task:')) {
            await setTaskStatus(id, 'done').catch(() => undefined);
            emit('tasks_changed');
        } else {
            const habit = coach.habits.find(each => each.id === id);
            if (habit && isTimedHabit(habit)) { router.replace({ pathname: '/habit-detail', params: { habitId: id } }); return; }
            if (!coach.completions[id]) await toggleCompletion(id).catch(() => undefined);
        }
        successFeedback();
        router.back();
    };

    const saveNote = () => {
        const text = note.trim();
        if (!text) return;
        if (soundsLikeCrisis(text)) { setCrisis(true); return; }
        void addNote('obstacle', text, 'you');
        setNote('');
        lightFeedback();
    };

    const plan = anchor ? `After ${anchor}, I will ${step.charAt(0).toLowerCase()}${step.slice(1)}` : '';

    return (
        <SheetScreen title="Start now" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {crisis ? (
                    <VoidCard style={styles.crisis}>
                        <Text style={[styles.crisisTitle, { color: colors.textPrimary }]}>{CRISIS_MESSAGE.title}</Text>
                        <Text style={[styles.tip, { color: colors.textSecondary }]}>{CRISIS_MESSAGE.body}</Text>
                    </VoidCard>
                ) : null}

                {!picked ? (
                    <>
                        <Text style={[styles.lead, { color: colors.textSecondary }]}>Which one? Just one.</Text>
                        {choices.length ? choices.map((choice, index) => (
                            <ListItem key={choice.item} index={index}>
                                <Pressable accessibilityRole="button" onPress={() => { selectionFeedback(); setPicked(choice); }}>
                                    <VoidCard style={styles.pick}>
                                        <IconTile icon={choice.kind === 'Task' ? 'flash' : 'repeat'} color={choice.kind === 'Task' ? TASK_COLOR : primary} size={32} />
                                        <Text numberOfLines={2} style={[styles.pickText, { color: colors.textPrimary }]}>{choice.title}</Text>
                                        <Text style={[styles.pickKind, { color: colors.textTertiary }]}>{choice.kind}</Text>
                                    </VoidCard>
                                </Pressable>
                            </ListItem>
                        )) : (
                            <Text style={[styles.lead, { color: colors.textTertiary }]}>Nothing open for today. That counts as a win.</Text>
                        )}
                    </>
                ) : phase === 'running' ? (
                    <>
                        <Text style={[styles.title, styles.center, { color: colors.textPrimary }]}>{picked.title}</Text>
                        <Text style={[styles.clock, { color: colors.textPrimary }]}>{clock(left)}</Text>
                        <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
                            <AnimatedFill progress={total ? 1 - left / total : 0} style={[styles.fill, { backgroundColor: primary }]} />
                        </View>
                        <Text style={[styles.tip, styles.center, { color: colors.textSecondary }]}>{step}</Text>
                        <AppButton label="Stop" variant="ghost" onPress={stop} />
                    </>
                ) : phase === 'after' ? (
                    <>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>You started. That was the hard part.</Text>
                        <AppButton label="It’s done" onPress={() => void markDone()} />
                        <AppButton label="Keep going on my own" variant="ghost" onPress={() => router.back()} />
                        <AppButton label="Two more minutes" variant="ghost" onPress={() => begin('two_minute')} />
                    </>
                ) : phase === 'plan' ? (
                    <>
                        <Text style={[styles.lead, { color: colors.textSecondary }]}>Tie it to something you already do.</Text>
                        <View style={styles.chips}>
                            {ANCHORS.map(each => (
                                <Pressable key={each} onPress={() => { selectionFeedback(); setAnchor(each); }} accessibilityRole="button">
                                    <MatteSurface radius={Radius.pill} level="control" tint={anchor === each ? primary : undefined} style={styles.chip}>
                                        <Text style={[styles.chipText, { color: anchor === each ? textOn(primary) : colors.textSecondary }]}>After {each}</Text>
                                    </MatteSurface>
                                </Pressable>
                            ))}
                        </View>
                        {plan ? (
                            <VoidCard style={styles.stepCard}>
                                <Text style={[styles.plan, { color: colors.textPrimary }]}>{plan}</Text>
                            </VoidCard>
                        ) : null}
                        <AppButton label="Save the plan" disabled={!plan} onPress={() => { void addNote('strategy', `${plan} (${picked.title})`, 'you'); successFeedback(); router.back(); }} />
                    </>
                ) : (
                    <>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>{picked.title}</Text>
                        <VoidCard style={styles.stepCard}>
                            <Text style={[styles.stepLabel, { color: colors.textTertiary }]}>First step</Text>
                            <Text style={[styles.step, { color: colors.textPrimary }]}>{step}</Text>
                        </VoidCard>

                        {order.map(type => (
                            <AppButton key={type} label={HELP[type].label} variant={type === order[0] ? 'default' : 'ghost'} onPress={() => begin(type)} />
                        ))}

                        <Text style={[styles.label, { color: colors.textTertiary }]}>What’s in the way? (optional)</Text>
                        <View style={styles.chips}>
                            {OBSTACLES.map(each => (
                                <Pressable key={each.id} accessibilityRole="button" onPress={() => {
                                    selectionFeedback();
                                    setObstacle(each.id);
                                    void addNote('obstacle', `${each.label}: ${picked.title}`, 'you');
                                }}>
                                    <MatteSurface radius={Radius.pill} level="control" tint={obstacle === each.id ? primary : undefined} style={styles.chip}>
                                        <Text style={[styles.chipText, { color: obstacle === each.id ? textOn(primary) : colors.textSecondary }]}>{each.label}</Text>
                                    </MatteSurface>
                                </Pressable>
                            ))}
                        </View>
                        {obstacle ? <Text style={[styles.tip, { color: colors.textSecondary }]}>{tipFor(obstacle)}</Text> : null}
                        <MatteInput value={note} onChangeText={setNote} placeholder="Something else…" placeholderTextColor={colors.textTertiary}
                            returnKeyType="done" onSubmitEditing={saveNote} onBlur={saveNote} style={[styles.field, { color: colors.textPrimary }]}
                            accessibilityLabel="What is in the way" />
                    </>
                )}
            </ScrollView>
        </SheetScreen>
    );
}

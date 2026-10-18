import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { IconTile } from '@/components/ui/IconTile';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppButton } from '@/components/ui/AppButton';
import { ListItem } from '@/components/ui/Motion';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { InsightRow } from '@/components/Echo/InsightRow';
import { ExperimentCard } from '@/components/Echo/ExperimentCard';
import { MiniBar } from '@/components/Echo/MiniBar';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useEchoCoach } from '@/hooks/useEchoCoach';
import { useExperiments } from '@/hooks/useEchoMemory';
import { useCheckIns, useEggs, useFreezes } from '@/hooks/useCheckIns';
import { moodEnergy } from '@/lib/moodEnergy';
import { vaultSize } from '@/lib/echoEggs';
import { baselineFor, evaluate, proposeExperiment, startExperiment } from '@/lib/echoExperiments';
import { styles } from '@/styles/screens/echo.styles';

/**
 * Echo, beyond the one line on Home: everything it noticed (each with its
 * numbers), the way in when you cannot start, your week, the experiments you
 * are running, and what it remembers. It is a coach to get you moving, not a
 * place to stay: every card leads back to doing something.
 */
export default function EchoScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();
    const { propose } = useLocalSearchParams<{ propose?: string }>();
    const coach = useEchoCoach();
    const experiments = useExperiments();
    const [proposalClosed, setProposalClosed] = useState(false);
    const checkIns = useCheckIns();
    const eggs = useEggs();
    const freezes = useFreezes();
    const feel = useMemo(() => moodEnergy(checkIns.entries, coach.today, coach.habits, coach.historyDays), [checkIns.entries, coach.today, coach.habits, coach.historyDays]);
    const recent = feel.days.slice(-7);

    const running = experiments.filter(item => item.status === 'running');
    const proposalHabit = propose && !proposalClosed && !running.some(item => item.habitId === propose)
        ? coach.habits.find(habit => habit.id === propose) : undefined;
    const proposal = proposalHabit ? proposeExperiment(proposalHabit) : null;
    const baseline = useMemo(() => proposal ? baselineFor(proposal.habitId, coach.habits, coach.historyDays, coach.completions, coach.today) : null,
        [proposal?.habitId, coach.habits, coach.historyDays, coach.completions, coach.today]); // eslint-disable-line react-hooks/exhaustive-deps

    const begin = () => {
        if (!proposal || !baseline) return;
        // Nothing about a habit changes without a yes.
        Alert.alert(proposal.title, `${proposal.why}\n\nThis changes the habit for 7 days. You can go back at any time.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Start', onPress: async () => {
                await startExperiment(proposal, baseline, coach.today).catch(() => Alert.alert('Could not start', 'Please try again.'));
                successFeedback();
                setProposalClosed(true);
            } },
        ]);
    };

    return (
        <SheetScreen title="Echo" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {proposal && baseline ? (
                    <VoidCard style={styles.proposal}>
                        <Text style={[styles.proposalTitle, { color: colors.textPrimary }]}>{proposal.title}</Text>
                        <Text style={[styles.proposalText, { color: colors.textSecondary }]}>{proposal.why}</Text>
                        <Text style={[styles.proposalText, { color: colors.textTertiary }]}>
                            Last 14 days: {baseline.kept} of {baseline.countable} kept. In 7 days, Echo compares.
                        </Text>
                        <View style={styles.buttons}>
                            <AppButton label="Start experiment" onPress={begin} style={styles.flex} />
                            <AppButton label="Not now" variant="ghost" onPress={() => setProposalClosed(true)} style={styles.flex} />
                        </View>
                    </VoidCard>
                ) : proposalHabit ? (
                    <VoidCard style={styles.proposal}>
                        <Text style={[styles.proposalText, { color: colors.textSecondary }]}>
                            No simple experiment fits {proposalHabit.name} yet. Try a two-minute start instead.
                        </Text>
                    </VoidCard>
                ) : null}

                <Pressable accessibilityRole="button" onPress={() => { lightFeedback(); router.push('/(root)/start-now' as never); }}>
                    <VoidCard style={styles.start}>
                        <IconTile icon="flash" color={primary} size={40} />
                        <View style={styles.startText}>
                            <Text style={[styles.startTitle, { color: colors.textPrimary }]}>Can’t start?</Text>
                            <Text style={[styles.startSub, { color: colors.textTertiary }]}>Pick one thing. Echo finds the first two minutes.</Text>
                        </View>
                        <AppIcon name="chevron-forward" size={16} color={colors.textTertiary} />
                    </VoidCard>
                </Pressable>

                <SectionTitle>Right now</SectionTitle>
                {coach.insights.length ? coach.insights.slice(0, 4).map((insight, index) => (
                    <ListItem key={insight.id} index={index}><InsightRow insight={insight} today={coach.today} /></ListItem>
                )) : (
                    <Text style={[styles.quiet, { color: colors.textTertiary }]}>Nothing needs you right now. Keep going.</Text>
                )}

                {running.length ? (
                    <>
                        <SectionTitle>Experiments</SectionTitle>
                        {running.map(experiment => (
                            <ExperimentCard key={experiment.id} experiment={experiment}
                                verdict={evaluate(experiment, coach.habits, coach.historyDays, coach.completions, coach.today)} />
                        ))}
                    </>
                ) : null}

                {/* Mood and energy, from the one-tap questions after a pull down on Home. */}
                <SectionTitle>Mood & energy</SectionTitle>
                {recent.length ? (
                    <VoidCard style={styles.feel}>
                        <View style={styles.feelRow}>
                            {(['mood', 'energy'] as const).map(kind => {
                                const now = feel.week[kind];
                                const before = feel.lastWeek[kind];
                                return (
                                    <View key={kind} style={styles.flex}>
                                        <Text style={[styles.feelValue, { color: colors.textPrimary }]}>{now === null ? '–' : now.toFixed(1)}</Text>
                                        <Text style={[styles.startSub, { color: colors.textTertiary }]}>
                                            {kind === 'mood' ? 'Mood' : 'Energy'} this week{now !== null && before !== null && now !== before ? ` · ${now > before ? '↑' : '↓'} ${Math.abs(now - before).toFixed(1)}` : ''}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                        <View style={styles.bars}>
                            {recent.map((day, index) => (
                                <View key={day.date} style={styles.barCol}>
                                    <MiniBar value={day.mood} color={primary} index={index} />
                                    <MiniBar value={day.energy} color={colors.warning} index={index} />
                                </View>
                            ))}
                        </View>
                        {feel.energyEffect ? (
                            <Text style={[styles.startSub, { color: colors.textSecondary }]}>
                                On high-energy days you keep {feel.energyEffect.high}% of habits; on low ones, {feel.energyEffect.low}% ({feel.energyEffect.highDays} and {feel.energyEffect.lowDays} days).
                            </Text>
                        ) : null}
                        {feel.bestTime ? (
                            <Text style={[styles.startSub, { color: colors.textSecondary }]}>Your energy is highest in the {feel.bestTime}.</Text>
                        ) : null}
                    </VoidCard>
                ) : (
                    <Text style={[styles.quiet, { color: colors.textTertiary }]}>Pull down on Home now and then: Echo will ask how you feel.</Text>
                )}

                <SettingsGroup>
                    <SettingsRow icon="snow" color="#64D2FF" label="Streak freezes" value={String(freezes.count)} />
                    <SettingsRow icon="key" color="#FFD60A" label="Secrets found" value={`${eggs.words.length} of ${vaultSize}`} />
                </SettingsGroup>

                <SettingsGroup>
                    <SettingsRow icon="calendar" color="#30D158" label="Your week" onPress={() => router.push('/(root)/week-review' as never)} />
                    <SettingsRow icon="bookmark" color="#FF9F0A" label="What Echo remembers"
                        value={coach.memory.notes.length ? String(coach.memory.notes.length) : undefined}
                        onPress={() => router.push('/(root)/echo-memory' as never)} />
                    <SettingsRow icon="sparkles" color="#5E5CE6" label="Voice & reminders" onPress={() => router.push('/(root)/ai-settings')} />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

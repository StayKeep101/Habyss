import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { parseGoalText, type GoalParseResult, type GoalSpec } from './goalParser';
import type { Habit } from './habitsSQLite';
import { localDateKey } from './habitSchedule';
import { draftToHabit, type OnboardingDraft } from './onboarding';
import { coachForTone, dailyTargetMinutes } from './onboardingAnswers';

/**
 * Everything onboarding writes, worked out before anything is written.
 *
 * This used to be inline in the screen, where it overwrote the habit's name,
 * amount and unit with the pre-roadmap defaults at the moment of saving. Every
 * edit made on the roadmap step was silently discarded and the habit was always
 * saved in minutes. As a pure function it can be tested directly, so the plan
 * the user sees is provably the plan that gets stored.
 */

export interface PlannedTask {
    /** The roadmap step it came from, for a stable import id. */
    stepId: string;
    title: string;
    dueDate: string;
}

export interface OnboardingPlan {
    /** The goal contract, with a "lose 5 kg" delta resolved against the baseline. */
    spec: GoalSpec;
    goal: Partial<Habit>;
    /** The first habit, the one carrying the daily amount. */
    habit: Partial<Habit>;
    /** Every habit the user added, the first one being `habit`. */
    habits: Partial<Habit>[];
    tasks: PlannedTask[];
    coach: PersonalityModeId;
    /** What giving up would cost, if they wrote anything. */
    stakes: string | null;
}

/** Resolves the confirmed goal, turning a delta into a target once a baseline exists. */
/**
 * How the goal was understood: the on-device model's reading when it read
 * exactly this text, otherwise the rule-based parse. Every step of onboarding
 * and the saved plan use this, so they all agree.
 */
export function readGoal(draft: OnboardingDraft, today: Date): GoalParseResult | null {
    const goalText = (draft.measurableText ?? draft.identityGoal ?? '').trim();
    if (!goalText) return null;
    if (draft.goalReading?.text === goalText) return draft.goalReading.result;
    return parseGoalText(goalText, { today, habits: [] });
}

export function resolveGoal(draft: OnboardingDraft, today: Date): GoalSpec {
    const parsed = readGoal(draft, today)?.goal ?? parseGoalText('', { today, habits: [] }).goal;

    const typed = (draft.baselineText ?? '').trim();
    const baseline = typed !== '' && Number.isFinite(Number(typed)) ? Number(typed) : parsed.baseline;

    return {
        ...parsed,
        baseline,
        target: parsed.delta_from_baseline !== null && baseline !== null
            ? baseline - parsed.delta_from_baseline
            : parsed.target,
    };
}

/** The name of the first habit the user added, if they added one. */
function firstHabitName(draft: OnboardingDraft): string | undefined {
    const fromItems = (draft.planItems ?? []).find(item => item.kind === 'habit' && item.title.trim())?.title.trim();
    return fromItems || draft.habitName?.trim() || undefined;
}

export function planFromDraft(draft: OnboardingDraft, now: Date = new Date()): OnboardingPlan {
    const spec = resolveGoal(draft, now);
    const today = localDateKey(now);
    const minutes = dailyTargetMinutes(draft.timeBudget, draft.killers);

    const goal: Partial<Habit> = {
        name: spec.title,
        isGoal: true,
        type: 'build',
        category: 'personal',
        icon: 'flag-outline',
        // Percent targets are stored 0-1 in the spec; goal_value is an integer.
        goalValue: spec.metric_unit === 'percent'
            ? Math.round((spec.target ?? 0) * 100)
            : Math.round(spec.target ?? 1),
        unit: spec.metric_unit ?? 'sessions',
        goalPeriod: spec.window?.kind === 'recurring'
            ? (spec.window.period === 'day' ? 'daily' : spec.window.period === 'week' ? 'weekly' : 'monthly')
            : 'daily',
        startDate: spec.window?.kind === 'fixed' ? spec.window.start : today,
        targetDate: spec.window?.kind === 'fixed' ? spec.window.end : undefined,
        goalSpec: JSON.stringify(spec),
    };

    // The roadmap step is where the habit is named and sized, so its values win.
    // The defaults only apply if that step was somehow never reached.
    const habit: Partial<Habit> = {
        ...draftToHabit({
            ...draft,
            habitName: firstHabitName(draft) || spec.suggested_habit?.name || spec.title,
            targetValue: draft.targetValue ?? minutes,
            targetUnit: draft.targetUnit ?? 'min',
            trackingMethod: draft.trackingMethod ?? 'numeric',
            startDate: today,
        }),
        icon: 'ellipse-outline',
    };

    // The extra habits the user added; they follow the same schedule and are
    // simply done or not, since only the first one carries an amount.
    const extras: Partial<Habit>[] = (draft.planItems ?? [])
        .filter(item => item.kind === 'habit' && item.title.trim())
        .slice(1)
        .map(item => ({
            ...draftToHabit({
                ...draft,
                habitName: item.title.trim(),
                targetValue: undefined,
                targetUnit: undefined,
                trackingMethod: 'boolean',
                startDate: today,
            }),
            icon: 'ellipse-outline',
        }));

    // An item with no title is not something anyone committed to.
    const items = draft.planItems
        ? draft.planItems.filter(item => item.kind === 'task').map(item => ({ id: item.id, title: item.title, dueDate: item.dueDate ?? today }))
        : (draft.roadmapSteps ?? []);
    const tasks: PlannedTask[] = items
        .map(step => ({ stepId: step.id, title: step.title.trim(), dueDate: step.dueDate }))
        .filter(step => step.title.length > 0);

    return {
        spec,
        goal,
        habit,
        habits: [habit, ...extras],
        tasks,
        // Chosen directly on the Echo step; older drafts derived it from the tone answer.
        coach: draft.echo ?? coachForTone(draft.tone),
        stakes: draft.stakesText?.trim() ? draft.stakesText.trim() : null,
    };
}

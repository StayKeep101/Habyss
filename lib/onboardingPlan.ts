import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { parseGoalText, type GoalSpec } from './goalParser';
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
    habit: Partial<Habit>;
    tasks: PlannedTask[];
    coach: PersonalityModeId;
    /** What giving up would cost, if they wrote anything. */
    stakes: string | null;
}

/** Resolves the confirmed goal, turning a delta into a target once a baseline exists. */
export function resolveGoal(draft: OnboardingDraft, today: Date): GoalSpec {
    const goalText = (draft.measurableText ?? draft.identityGoal ?? '').trim();
    const parsed = parseGoalText(goalText, { today, habits: [] }).goal;

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
            habitName: draft.habitName?.trim() || spec.suggested_habit?.name || spec.title,
            targetValue: draft.targetValue ?? minutes,
            targetUnit: draft.targetUnit ?? 'min',
            trackingMethod: draft.trackingMethod ?? 'numeric',
            startDate: today,
        }),
        icon: 'ellipse-outline',
    };

    // A checkpoint with no title is not a step anyone committed to.
    const tasks: PlannedTask[] = (draft.roadmapSteps ?? [])
        .map(step => ({ stepId: step.id, title: step.title.trim(), dueDate: step.dueDate }))
        .filter(step => step.title.length > 0);

    return {
        spec,
        goal,
        habit,
        tasks,
        coach: coachForTone(draft.tone),
        stakes: draft.stakesText?.trim() ? draft.stakesText.trim() : null,
    };
}

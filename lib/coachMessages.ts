import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';

/**
 * Coach voice, in one place.
 *
 * Onboarding previews and the coaching the user gets afterwards are generated
 * from these same functions, so the personality someone picks because they liked
 * its preview is the personality they actually get.
 *
 * These are written, predefined lines, not model output. They must never be
 * presented as a freshly generated AI response. The on-device model is used
 * separately in the AI chat; this is the guidance that works offline, before a
 * model is downloaded, and as the fallback when generation fails.
 *
 * Rules that hold for every personality:
 * - Facts come from the caller. Nothing here invents progress, streaks,
 *   history, or reasons a habit was missed.
 * - A missing completion is described as "not logged", never as proof the user
 *   failed to do it.
 * - Direct personalities are blunt and demanding, never insulting or
 *   threatening, and never use guilt.
 */

export interface CoachContext {
    habitName: string;
    /** Already formatted, e.g. "15 min" or "Done or not done". */
    target?: string;
    recurrence?: string;
    cue?: string;
    /** Only pass values that were actually recorded. */
    currentStreak?: number;
    completedThisWeek?: number;
    scheduledThisWeek?: number;
    /** The obstacle the user chose during setup, if they answered. */
    obstacle?: 'forgetting' | 'too_big' | 'no_time' | 'unsure';
}

type Voice = {
    planIntro: (c: CoachContext) => string;
    completion: (c: CoachContext) => string;
    notLogged: (c: CoachContext) => string;
    home: (c: CoachContext) => string;
    /** Same habit, same situation, for side-by-side comparison in onboarding. */
    preview: (habitName: string) => string;
    /** The notification when a habit's reminder time comes. */
    reminder: (c: { habitName: string; name?: string }) => string;
    /** How Echo introduces itself when the user is choosing a voice. */
    hello: (name?: string) => string;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const streakLine = (c: CoachContext): string | null => {
    if (!c.currentStreak || c.currentStreak < 2) return null;
    return `${plural(c.currentStreak, 'day')} in a row`;
};

const weekLine = (c: CoachContext): string | null => {
    if (c.completedThisWeek === undefined || !c.scheduledThisWeek) return null;
    return `${c.completedThisWeek} of ${c.scheduledThisWeek} logged this week`;
};

const VOICES: Record<PersonalityModeId, Voice> = {
    friendly: {
        planIntro: c =>
            `Love this. ${c.habitName}${c.target ? `, ${c.target}` : ''}, ${(c.recurrence ?? 'every day').toLowerCase()}` +
            `${c.cue ? `, right after ${c.cue.toLowerCase()}` : ''}. That is a really good place to start, and I will be here for it. 💙`,
        completion: c => {
            const streak = streakLine(c);
            return streak
                ? `Yes! ${c.habitName} done — that is ${streak}. You are building something real here. 🎉`
                : `Yes! ${c.habitName} is done for today. That counts, and I am glad you showed up. 🎉`;
        },
        notLogged: c =>
            `No rush — ${c.habitName} is not logged yet today. If you already did it, you can add it. If not, there is still time. 💙`,
        home: c => {
            const week = weekLine(c);
            return week
                ? `${c.habitName} is on for today — ${week} so far. You are doing lovely. 🌟`
                : `${c.habitName} is on for today. Whenever you are ready, I am cheering for you. 🌟`;
        },
        preview: name => `You picked ${name}? That is a wonderful start, and I will be right here cheering you on every single day. 💙`,
        reminder: c => `${c.name ? `Hey ${c.name}! ` : ''}Time for ${c.habitName}. You've got this. 💙`,
        hello: name => `${name ? `Hi ${name}! ` : 'Hi! '}I'll cheer on every win, big or small. 💙`,
    },

    normal: {
        planIntro: c =>
            `Your plan: ${c.habitName}${c.target ? `, ${c.target}` : ''}, ${(c.recurrence ?? 'every day').toLowerCase()}` +
            `${c.cue ? `, cued after ${c.cue.toLowerCase()}` : ''}. One habit is the right number to start with.`,
        completion: c => {
            const streak = streakLine(c);
            return streak ? `${c.habitName} logged. That is ${streak}.` : `${c.habitName} logged for today.`;
        },
        notLogged: c => `${c.habitName} is scheduled today and not logged yet. You can log it any time before the day ends.`,
        home: c => {
            const week = weekLine(c);
            return week ? `${c.habitName} today. ${week}.` : `${c.habitName} is scheduled for today.`;
        },
        preview: name => `${name}, scheduled and tracked. I will show you how consistent you have been and keep the feedback factual.`,
        reminder: c => `${c.habitName} is scheduled now.${c.name ? ` Over to you, ${c.name}.` : ''}`,
        hello: name => `${name ? `${name}, ` : ''}I'll keep it clear: what's due, what's done, how you're trending.`,
    },

    dad_mode: {
        planIntro: c =>
            `Alright. ${c.habitName}${c.target ? `, ${c.target}` : ''}, ${(c.recurrence ?? 'every day').toLowerCase()}` +
            `${c.cue ? `, after ${c.cue.toLowerCase()}` : ''}. You set it, so you keep it. I will hold you to it.`,
        completion: c => {
            const streak = streakLine(c);
            return streak ? `Good. ${streak}. That is what keeping your word looks like.` : `Good. ${c.habitName} done. That is the standard.`;
        },
        notLogged: c => `${c.habitName} is not logged yet today. If you did it, log it. If you did not, there is still time.`,
        home: c => {
            const week = weekLine(c);
            return week ? `${c.habitName} today. ${week}. Let's keep it up.` : `${c.habitName} is on today. Get it done.`;
        },
        preview: name => `You committed to ${name}. I will expect it done, and I will ask about it when it is not logged.`,
        reminder: c => `${c.habitName}. You said you would${c.name ? `, ${c.name}` : ''}. Do it now.`,
        hello: name => `${name ? `${name}. ` : ''}You gave your word. I expect you to keep it.`,
    },

    bully_mode: {
        planIntro: c =>
            `${c.habitName}${c.target ? `, ${c.target}` : ''}, ${(c.recurrence ?? 'every day').toLowerCase()}` +
            `${c.cue ? `, after ${c.cue.toLowerCase()}` : ''}. No negotiating with yourself later. Do it.`,
        completion: c => {
            const streak = streakLine(c);
            return streak ? `Logged. ${streak}. Again tomorrow.` : `Logged. Again tomorrow.`;
        },
        notLogged: c => `${c.habitName}: not logged. Log it or do it. Your call.`,
        home: c => {
            const week = weekLine(c);
            return week ? `${c.habitName} today. ${week}. Move.` : `${c.habitName} today. Move.`;
        },
        preview: name => `${name}. Every scheduled day. I will not soften it when it is not logged.`,
        reminder: c => `${c.habitName}. Now${c.name ? `, ${c.name}` : ''}. Get off your ass.`,
        hello: name => `${name ? `${name}. ` : ''}No excuses, no hand-holding. Show up or shut up.`,
    },
};

const voiceFor = (id: PersonalityModeId): Voice => VOICES[id] ?? VOICES.normal;

export const coachPlanIntro = (id: PersonalityModeId, context: CoachContext): string =>
    voiceFor(id).planIntro(context);

export const coachCompletion = (id: PersonalityModeId, context: CoachContext): string =>
    voiceFor(id).completion(context);

export const coachNotLogged = (id: PersonalityModeId, context: CoachContext): string =>
    voiceFor(id).notLogged(context);

export const coachHomeMessage = (id: PersonalityModeId, context: CoachContext): string =>
    voiceFor(id).home(context);

/** Echo's line in a habit's reminder notification. */
export const coachReminder = (id: PersonalityModeId, context: { habitName: string; name?: string }): string =>
    voiceFor(id).reminder(context);

/** Echo introducing itself in a personality, for choosing between them. */
export const coachHello = (id: PersonalityModeId, name?: string): string =>
    voiceFor(id).hello(name?.trim() || undefined);

/** One line per personality about the same habit, for the comparison step. */
export const coachPreview = (id: PersonalityModeId, habitName: string): string =>
    voiceFor(id).preview(habitName || 'this habit');

/**
 * System prompt for the on-device model, carrying both the personality and the
 * facts it is allowed to use. Anything absent from the context must not be
 * asserted by the model.
 */
export function coachSystemPrompt(id: PersonalityModeId, context: CoachContext): string {
    const mode = PERSONALITY_MODES.find(item => item.id === id) ?? PERSONALITY_MODES[1];
    const facts = [
        `Habit: ${context.habitName}`,
        context.target ? `Target: ${context.target}` : null,
        context.recurrence ? `Schedule: ${context.recurrence}` : null,
        context.cue ? `Routine cue: ${context.cue}` : null,
        context.currentStreak !== undefined ? `Current streak: ${context.currentStreak}` : null,
        context.completedThisWeek !== undefined && context.scheduledThisWeek !== undefined
            ? `Logged this week: ${context.completedThisWeek} of ${context.scheduledThisWeek}`
            : null,
        context.obstacle ? `User said their obstacle is: ${context.obstacle}` : null,
    ].filter(Boolean).join('\n');

    return `${mode.systemPrompt}

Only these facts are known:
${facts}

Rules:
- Never invent progress, streaks, history, or reasons the user missed a habit.
- A habit with no completion logged is "not logged"; do not claim the user failed to do it.
- Never change the user's target or schedule. Suggest, and let them accept.
- Be direct if your personality is direct, but never insulting or threatening.
- Keep replies under 400 characters.`;
}

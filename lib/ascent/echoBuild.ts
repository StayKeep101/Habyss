import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { minutesOf, type DayWindow, type EchoConfig } from '../echo';
import { clockLabel } from '../dayFlow';
import { dayWindowFor, suggestEcho, type BlockerId } from '../onboardingProfile';
import type { Answers, ObstacleId } from './story';

const clock = (time: string) => clockLabel(minutesOf(time));

/** What each obstacle says about them, in the words suggestEcho reads. */
const BLOCKERS: Record<ObstacleId, BlockerId[]> = {
    starting: [],
    consistency: ['motivation'],
    distraction: [],
    overwhelm: ['overwhelmed'],
};

/** How Echo tells them which voice it chose, in its own words. */
const SAYS: Record<PersonalityModeId, string> = {
    friendly: 'I’ll keep it kind, and cheer every win.',
    normal: 'I’ll keep it calm, and stay out of your way.',
    dad_mode: 'I’ll keep you honest. Deadlines are my thing.',
    bully_mode: 'I won’t go easy on you.',
};

export interface BuiltEcho {
    voice: PersonalityModeId;
    /** Echo saying how it will speak to them, so the voice is explained. */
    reason: string;
    day: DayWindow;
    /** What Echo does for them on its own (lib/echo.ts EchoConfig). */
    config: Partial<EchoConfig>;
    /** The build, line by line, as it is shown: each one something they told Echo. */
    parts: { icon: string; text: string }[];
}

/**
 * Their Echo, from everything they said: the voice (the same choice
 * suggestEcho makes for anyone, so it is never decided two ways), their day,
 * and which nudges are on. Everything here can be changed in Echo's settings;
 * this is only where it starts.
 *
 * - a morning nudge with what the day asks, for everyone;
 * - an evening check for people who lose the thread (consistency, overwhelm,
 *   or work that slides to the last minute or never);
 * - a heads-up before each step for people who struggle to start or get pulled away;
 * - demon mode stays off for anyone Echo is gentle with.
 */
export function buildEcho(answers: Answers): BuiltEcho {
    const { id: voice } = suggestEcho({
        blockers: answers.obstacle ? BLOCKERS[answers.obstacle] : [],
        sleepAmount: answers.sleepAmount,
        timing: answers.timing,
    });
    const fallback = dayWindowFor(answers.chronotype);
    const day = { wake: answers.wake ?? fallback.wake, sleep: answers.sleep ?? fallback.sleep };
    const evening = answers.obstacle === 'consistency' || answers.obstacle === 'overwhelm'
        || answers.timing === 'last_minute' || answers.timing === 'rarely';
    const alive = answers.obstacle === 'starting' || answers.obstacle === 'distraction' || answers.timing === 'rarely';
    const config: Partial<EchoConfig> = { morning: true, evening, alive, demonMode: voice !== 'friendly', useName: !!answers.name?.trim() };

    const nudges = ['a plan each morning', evening ? 'a check each evening' : null, alive ? 'a heads-up before each step' : null].filter(Boolean);
    const voiceName = PERSONALITY_MODES.find(mode => mode.id === voice)?.name ?? 'Normal';
    return {
        voice, reason: SAYS[voice], day, config,
        parts: [
            { icon: 'sunny', text: `Your day: ${clock(day.wake)} to ${clock(day.sleep)}` },
            { icon: 'chatbubble-ellipses', text: `My voice: ${voiceName}` },
            { icon: 'notifications', text: `I’ll send ${nudges.join(', ')}` },
        ],
    };
}

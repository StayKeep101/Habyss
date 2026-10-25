import type { PersonalityModeId } from '@/constants/AIPersonalities';

/**
 * What we ask before anything else, and what the answers change.
 *
 * The old flow interrogated the goal — how many times you had failed at it,
 * what giving up would cost — before it knew your name. These questions are
 * about the person instead: when they sleep, when work actually happens, and
 * what gets in the way. They are easier to answer honestly, and they are the
 * only answers the app can act on straight away.
 *
 * Nothing here is a test with a right answer. Every option is a real way to
 * be, written the way someone would say it out loud.
 */

export type SourceId = 'friend' | 'app_store' | 'social' | 'youtube' | 'search' | 'other';
export type HopeId = 'consistency' | 'finish' | 'sleep' | 'calm' | 'proud' | 'together';
export type ChronotypeId = 'early_bird' | 'night_owl' | 'neither';
export type SleepAmountId = 'under_six' | 'six_seven' | 'seven_eight' | 'eight_plus';
export type TimingId = 'straight_away' | 'planned' | 'last_minute' | 'rarely';
export type BlockerId = 'forget' | 'no_time' | 'too_tired' | 'motivation' | 'overwhelmed' | 'alone' | 'perfect';
export type JuggleId = 'job' | 'school' | 'side_project' | 'business' | 'training' | 'family';

export const SOURCES: { id: SourceId; label: string; icon: string }[] = [
    { id: 'friend', label: 'A friend told me', icon: 'people-outline' },
    { id: 'app_store', label: 'The App Store', icon: 'logo-apple' },
    { id: 'social', label: 'TikTok or Instagram', icon: 'sparkles-outline' },
    { id: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
    { id: 'search', label: 'I went looking for this', icon: 'search-outline' },
    { id: 'other', label: 'Somewhere else', icon: 'ellipsis-horizontal' },
];

/** Everything they are carrying at once: what Habyss is built to run together. */
export const JUGGLES: { id: JuggleId; label: string; icon: string }[] = [
    { id: 'job', label: 'A job', icon: 'briefcase-outline' },
    { id: 'school', label: 'School or uni', icon: 'school-outline' },
    { id: 'side_project', label: 'A side project', icon: 'rocket-outline' },
    { id: 'business', label: 'A business', icon: 'trending-up-outline' },
    { id: 'training', label: 'Training', icon: 'barbell-outline' },
    { id: 'family', label: 'Family', icon: 'home-outline' },
];

export const HOPES: { id: HopeId; label: string; icon: string }[] = [
    { id: 'calm', label: 'Run all of it without dropping a thing', icon: 'layers-outline' },
    { id: 'finish', label: 'Finish everything I start, on time', icon: 'checkmark-done-outline' },
    { id: 'consistency', label: 'Never lose another day', icon: 'flame-outline' },
    { id: 'proud', label: 'Out-work everyone around me', icon: 'trophy-outline' },
    { id: 'sleep', label: 'Wake up sharp, every single morning', icon: 'sunny-outline' },
    { id: 'together', label: 'Have someone who will not let me slack', icon: 'people-outline' },
];

export const CHRONOTYPES: { id: ChronotypeId; label: string; detail: string; icon: string; wake: string; sleep: string }[] = [
    { id: 'early_bird', label: 'Early bird', detail: 'Best before the world wakes up', icon: 'sunny-outline', wake: '06:00', sleep: '22:00' },
    { id: 'night_owl', label: 'Night owl', detail: 'Everything good happens after dark', icon: 'moon-outline', wake: '09:00', sleep: '01:00' },
    { id: 'neither', label: 'Somewhere in between', detail: 'Depends on the day', icon: 'partly-sunny-outline', wake: '07:00', sleep: '23:00' },
];

export const SLEEP_AMOUNTS: { id: SleepAmountId; label: string; hours: number }[] = [
    { id: 'under_six', label: 'Under 6 hours', hours: 5.5 },
    { id: 'six_seven', label: '6 to 7 hours', hours: 6.5 },
    { id: 'seven_eight', label: '7 to 8 hours', hours: 7.5 },
    { id: 'eight_plus', label: '8 or more', hours: 8.5 },
];

export const TIMINGS: { id: TimingId; label: string; detail: string; icon: string }[] = [
    { id: 'straight_away', label: 'The moment it lands', detail: 'Done before anyone else has started', icon: 'flash-outline' },
    { id: 'planned', label: 'When I planned it', detail: 'Decided in advance, then it just happens', icon: 'calendar-outline' },
    { id: 'last_minute', label: 'At the last minute', detail: 'Panic is my only deadline', icon: 'alarm-outline' },
    { id: 'rarely', label: 'Honestly? A lot of it never does', detail: 'Days slip by and nothing moves', icon: 'cloud-outline' },
];

export const BLOCKERS: { id: BlockerId; label: string; icon: string }[] = [
    { id: 'no_time', label: 'Busy all day, still behind', icon: 'hourglass-outline' },
    { id: 'overwhelmed', label: 'So much on my plate I freeze', icon: 'layers-outline' },
    { id: 'motivation', label: 'I start strong, then fade', icon: 'battery-half-outline' },
    { id: 'forget', label: 'I forget until it is too late', icon: 'notifications-off-outline' },
    { id: 'too_tired', label: 'Too drained to start', icon: 'bed-outline' },
    { id: 'alone', label: 'Nobody holds me to it', icon: 'person-outline' },
    { id: 'perfect', label: 'I wait for the perfect moment', icon: 'diamond-outline' },
];

export interface Profile {
    hope?: HopeId[];
    chronotype?: ChronotypeId;
    sleepAmount?: SleepAmountId;
    timing?: TimingId;
    blockers?: BlockerId[];
}

export interface EchoSuggestion {
    id: PersonalityModeId;
    /** Said back to the user, in their own words, so the choice is explained. */
    reason: string;
}

/**
 * The voice Echo starts with, chosen from what the person just told us.
 *
 * The order matters more than the rules. Someone who is exhausted or
 * underwater gets a gentler voice even if they also leave everything to the
 * last minute, because pushing a person who is already drowning is not
 * motivation, it is harm. Firmness is for people who said the deadline is what
 * makes things real — they asked for a deadline, so Echo becomes one.
 *
 * The harshest voice is never chosen for anyone. It exists for people who go
 * looking for it, and it stays an explicit choice.
 */
export function suggestEcho(profile: Profile): EchoSuggestion {
    const blockers = profile.blockers ?? [];
    const running = profile.sleepAmount === 'under_six';

    if (blockers.includes('overwhelmed')) {
        return { id: 'friendly', reason: 'You said it all feels like too much, so Echo starts gentle.' };
    }
    if (blockers.includes('too_tired') || running) {
        return { id: 'friendly', reason: 'You are running on empty, so Echo starts kind rather than loud.' };
    }
    if (blockers.includes('perfect')) {
        return { id: 'friendly', reason: 'You said you would rather not start than do it badly. Echo will take the pressure off.' };
    }
    if (profile.timing === 'last_minute') {
        return { id: 'dad_mode', reason: 'You said the deadline is what makes it real, so Echo will be one.' };
    }
    if (profile.timing === 'rarely') {
        return { id: 'dad_mode', reason: 'You said things tend to slide, so Echo will hold you to them.' };
    }
    if (blockers.includes('motivation')) {
        return { id: 'friendly', reason: 'The motivation runs out, you said. Echo is there for the days it does.' };
    }
    if (profile.timing === 'straight_away') {
        return { id: 'normal', reason: 'You get things done. Echo will keep out of the way.' };
    }
    return { id: 'normal', reason: 'A steady voice to start with.' };
}

/** The day a chronotype implies, before the user adjusts it. */
export function dayWindowFor(chronotype?: ChronotypeId): { wake: string; sleep: string } {
    const found = CHRONOTYPES.find(type => type.id === chronotype) ?? CHRONOTYPES[2];
    return { wake: found.wake, sleep: found.sleep };
}

/**
 * Whether to offer inviting someone.
 *
 * Only to people for whom it answers something they actually said: that nobody
 * notices, or that they want to do this with someone.
 */
export function shouldOfferFriends(profile: Profile): boolean {
    return (profile.blockers ?? []).includes('alone') || (profile.hope ?? []).includes('together');
}

/**
 * Whether to offer reminders first.
 *
 * Someone who said they simply forget is told what reminders can do; everyone
 * else is left alone about it.
 */
export function shouldOfferReminders(profile: Profile): boolean {
    return (profile.blockers ?? []).includes('forget');
}

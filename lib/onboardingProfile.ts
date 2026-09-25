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

export const SOURCES: { id: SourceId; label: string; icon: string }[] = [
    { id: 'friend', label: 'A friend told me', icon: 'people-outline' },
    { id: 'app_store', label: 'The App Store', icon: 'logo-apple' },
    { id: 'social', label: 'TikTok or Instagram', icon: 'sparkles-outline' },
    { id: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
    { id: 'search', label: 'I went looking for this', icon: 'search-outline' },
    { id: 'other', label: 'Somewhere else', icon: 'ellipsis-horizontal' },
];

export const HOPES: { id: HopeId; label: string; icon: string }[] = [
    { id: 'consistency', label: 'To finally be consistent', icon: 'repeat-outline' },
    { id: 'finish', label: 'To finish what I start', icon: 'checkmark-done-outline' },
    { id: 'sleep', label: 'To sort my sleep out', icon: 'moon-outline' },
    { id: 'calm', label: 'To feel less scattered', icon: 'leaf-outline' },
    { id: 'proud', label: 'To be proud of my days', icon: 'sunny-outline' },
    { id: 'together', label: 'To do it with someone', icon: 'heart-outline' },
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
    { id: 'straight_away', label: 'Straight away', detail: 'I would rather have it done than hanging over me', icon: 'flash-outline' },
    { id: 'planned', label: 'When I planned to', detail: 'It goes in the day and it happens', icon: 'calendar-outline' },
    { id: 'last_minute', label: 'At the last minute', detail: 'The deadline is what makes it real', icon: 'alarm-outline' },
    { id: 'rarely', label: 'Honestly, often not at all', detail: 'Things slide, and then they are gone', icon: 'cloud-outline' },
];

export const BLOCKERS: { id: BlockerId; label: string; icon: string }[] = [
    { id: 'forget', label: 'I simply forget', icon: 'notifications-off-outline' },
    { id: 'no_time', label: 'There is never enough time', icon: 'hourglass-outline' },
    { id: 'too_tired', label: 'I am too tired by then', icon: 'bed-outline' },
    { id: 'motivation', label: 'The motivation runs out', icon: 'battery-half-outline' },
    { id: 'overwhelmed', label: 'It all feels like too much', icon: 'rainy-outline' },
    { id: 'alone', label: 'Nobody notices either way', icon: 'person-outline' },
    { id: 'perfect', label: 'If I cannot do it properly, I do not start', icon: 'diamond-outline' },
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

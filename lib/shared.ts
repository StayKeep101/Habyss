/**
 * A habit or a task that people took on together.
 *
 * The rule is that it is not done until everyone on it has done it — two
 * people, or five, however many it was shared with. That is the whole point:
 * one you can tick alone is just an ordinary item with a friend's face next to
 * it, and the thing that makes people turn up is knowing someone is waiting.
 *
 * Nothing here is specific to habits. A shared task works the same way, and
 * the only difference is which table the participants came from.
 *
 * What it deliberately does *not* do is touch streaks. Tying your run to
 * somebody else's behaviour is a much heavier promise than it sounds: one
 * friend's quiet week would end a streak you kept perfectly. The shared state
 * is shown, and your own record stays yours, until that is a decision somebody
 * has taken on purpose rather than one that arrived with a feature.
 */

export interface Participant {
    userId: string;
    username: string;
    avatarUrl?: string;
    /** Whether this person has done *this* item today. */
    done: boolean;
    isYou: boolean;
    /**
     * Offered it, but has not answered yet.
     *
     * They belong on the card — the point of the faces is knowing at a glance
     * who this is shared with — but they are **not** part of the rule. Somebody
     * who has not said yes cannot be holding a habit up, and counting them
     * would make an item impossible to finish until they replied.
     */
    pending?: boolean;
}

export interface SharedState {
    /** Everyone on it, you first, then the rest by name, invitees last. */
    people: Participant[];
    /** Who has been asked and not answered. On the card, outside the rule. */
    invited: Participant[];
    /** True only once every single person has done it. */
    complete: boolean;
    /** Done, out of everyone. */
    done: number;
    total: number;
    /** Who it is still waiting on — never includes you if you have done it. */
    waitingOn: Participant[];
    /** Whether you are the one holding it up. */
    waitingOnYou: boolean;
    /** One short line for the card. */
    line: string;
}

/** Names, written the way a person would say them. */
export function nameList(people: Participant[]): string {
    const names = people.map(person => (person.isYou ? 'you' : person.username));
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Where a shared habit or task stands today.
 *
 * One nobody else is on behaves exactly like an ordinary one, so the caller
 * does not have to check first.
 */
export function sharedState(participants: Participant[]): SharedState {
    const people = [...participants].sort((a, b) =>
        // Invited-but-unanswered sit at the end: they are on the card, not in
        // the arrangement.
        Number(!!a.pending) - Number(!!b.pending)
        || Number(b.isYou) - Number(a.isYou)
        || a.username.localeCompare(b.username));

    // Only the people who actually agreed to it are part of the rule.
    const agreed = people.filter(person => !person.pending);
    const done = agreed.filter(person => person.done).length;
    const total = agreed.length;
    const waitingOn = agreed.filter(person => !person.done);
    const waitingOnYou = waitingOn.some(person => person.isYou);
    const complete = total > 0 && done === total;

    const invited = people.filter(person => !!person.pending);
    return {
        people, invited, complete, done, total, waitingOn, waitingOnYou,
        line: lineFor({ complete, done, total, waitingOn, waitingOnYou, invited: invited.length }),
    };
}

function lineFor({ complete, done, total, waitingOn, waitingOnYou, invited }: {
    complete: boolean; done: number; total: number; waitingOn: Participant[]; waitingOnYou: boolean;
    invited: number;
}): string {
    if (total === 0) return '';
    // Nobody has accepted yet, so there is nothing shared to report on — only
    // an invitation out, which is the honest thing to say about it.
    if (total === 1 && invited > 0) return invited === 1 ? 'Invited · not answered' : `${invited} invited`;
    if (total === 1) return complete ? 'Done' : 'Not done yet';
    if (complete) return 'Both done';

    // Your own part comes first, because it is the part you can act on.
    if (waitingOnYou && waitingOn.length === 1) return 'Waiting on you';
    if (waitingOnYou) return `Waiting on you and ${waitingOn.length - 1} more`;

    const others = waitingOn.filter(person => !person.isYou);
    if (others.length === 1) return `Waiting on ${others[0].username}`;
    return `${done} of ${total} done`;
}

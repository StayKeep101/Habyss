import type { PersonalityModeId } from '@/constants/AIPersonalities';

/**
 * What Echo knows right now, and the one thing most worth saying about it.
 *
 * The brief is the day as the timeline has it (planned from waking, whether or
 * not the app was opened, and updated on every tick, addition or early finish),
 * plus what is going on around you: your rank among friends and who just passed
 * you, your duels, friends finishing their day or focusing, and how long your
 * blocked apps have had you today.
 *
 * From it, talking points, ranked by how much they matter now; Echo says the
 * first. Every line is written to say something true and specific ("Study has
 * 20 minutes left"), in the chosen voice. The on-device model may only rephrase
 * that line, keeping its facts (lib/echoSays.ts); it never invents what to say.
 * Pure, so it is tested without a phone.
 */
export interface EchoBrief {
    /** Minutes from midnight. */
    now: number;
    name?: string;
    /** On now: a habit, task or event, with its minutes in and left. Home is open, so they are on their phone during it. */
    onNow?: { title: string; minutesIn: number; minutesLeft: number };
    next?: { title: string; at: string };
    /** Free until the next thing (minutes), when nothing is on. */
    freeFor?: number;
    /** Habits and tasks whose time went by unticked today. */
    missed: string[];
    done: number;
    total: number;
    /** Something ticked before its time was up, in the last half hour. */
    early?: { title: string; minutes: number };
    streak: number;
    /** Minutes in your blocked apps today (Screen Time), when known. */
    scrolled?: number;
    /** A friend who passed you on the leaderboard since Echo last looked. */
    passedBy?: { name: string; rank: number };
    rank?: number;
    /** Your duels under way. */
    duels: { name: string; me: number; them: number; daysLeft: number }[];
    /** Friends who finished everything today. */
    friendsDone: { name: string; done: number }[];
    /** Friends focusing right now. */
    friendsFocusing: { name: string; on?: string }[];
    /** Minutes to bedtime. */
    toBed?: number;
    /** Goals and tasks due soon, nearest first (upcomingDeadlines). */
    deadlines?: Deadline[];
}

export interface Deadline { title: string; daysLeft: number; kind: 'goal' | 'task'; progress?: number }

/**
 * What is due soon: goals ending within a week and not reached, tasks due in
 * the next three days (today's are on the timeline already). Nearest first.
 */
export function upcomingDeadlines(
    goals: { title: string; daysLeft: number | null; progress: number }[],
    tasks: { title: string; dueDate?: string; status: string }[],
    today: string,
): Deadline[] {
    const days = (key: string) => Math.round((Date.parse(`${key}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000);
    const out: Deadline[] = [];
    for (const goal of goals) {
        if (goal.daysLeft !== null && goal.daysLeft >= 0 && goal.daysLeft <= 7 && goal.progress < 100) {
            out.push({ title: goal.title, daysLeft: goal.daysLeft, kind: 'goal', progress: Math.round(goal.progress) });
        }
    }
    for (const task of tasks) {
        if (task.status !== 'open' || !task.dueDate) continue;
        const left = days(task.dueDate);
        if (left >= 1 && left <= 3) out.push({ title: task.title, daysLeft: left, kind: 'task' });
    }
    return out.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 3);
}

const dueWhen = (days: number) => (days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

export type PointKind = 'scrolling' | 'passed' | 'duel' | 'missed' | 'onNow' | 'deadline' | 'friendDone' | 'friendFocusing' | 'early' | 'dayDone' | 'free' | 'nothingYet' | 'next';

export interface TalkingPoint {
    kind: PointKind;
    /** The words that must survive any rephrasing: titles, names, numbers. */
    keys: string[];
    /** The facts, said plainly, for the model. */
    facts: string;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const mins = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`);

/** What is worth saying now, most important first. */
export function talkingPoints(brief: EchoBrief): TalkingPoint[] {
    const out: TalkingPoint[] = [];
    const doing = brief.onNow?.title ?? brief.next?.title;
    if (brief.scrolled && brief.scrolled >= 15) {
        out.push({ kind: 'scrolling', keys: [String(brief.scrolled)],
            facts: `They have spent ${brief.scrolled} minutes in their blocked apps today${doing ? ` while "${doing}" is waiting` : ''}.` });
    }
    if (brief.passedBy) {
        out.push({ kind: 'passed', keys: [brief.passedBy.name],
            facts: `Their friend ${brief.passedBy.name} just passed them on the leaderboard; they are now #${brief.passedBy.rank}.` });
    }
    const losing = brief.duels.filter(duel => duel.them > duel.me).sort((a, b) => a.daysLeft - b.daysLeft)[0];
    if (losing) {
        out.push({ kind: 'duel', keys: [losing.name],
            facts: `In their duel with ${losing.name}, they are at ${losing.me}% and ${losing.name} is at ${losing.them}%, ${losing.daysLeft} day${losing.daysLeft === 1 ? '' : 's'} left.` });
    }
    if (brief.missed.length >= 2 || (brief.missed.length === 1 && !brief.onNow)) {
        out.push({ kind: 'missed', keys: [brief.missed[0]],
            facts: `${brief.missed.length} thing${brief.missed.length === 1 ? '' : 's'} went by unticked today: ${brief.missed.slice(0, 3).join(', ')}.` });
    }
    if (brief.onNow) {
        out.push({ kind: 'onNow', keys: [brief.onNow.title],
            facts: `"${brief.onNow.title}" is on now: ${brief.onNow.minutesIn} minutes in, ${brief.onNow.minutesLeft} left.${brief.next ? ` Then "${brief.next.title}".` : ''}` });
    }
    const due = brief.deadlines?.[0];
    if (due) {
        out.push({ kind: 'deadline', keys: [due.title],
            facts: `Their ${due.kind} "${due.title}" is due ${dueWhen(due.daysLeft)}${due.progress !== undefined ? ` and is ${due.progress}% done` : ''}.` });
    }
    const friend = brief.friendsDone[0];
    if (friend && brief.done < brief.total) {
        out.push({ kind: 'friendDone', keys: [friend.name],
            facts: `Their friend ${friend.name} has already finished everything today (${friend.done} things). They have ${brief.total - brief.done} left.` });
    }
    const focusing = brief.friendsFocusing[0];
    if (focusing && !brief.onNow) {
        out.push({ kind: 'friendFocusing', keys: [focusing.name],
            facts: `Their friend ${focusing.name} is focusing right now${focusing.on ? ` on "${focusing.on}"` : ''}.` });
    }
    if (brief.early) {
        out.push({ kind: 'early', keys: [brief.early.title],
            facts: `They finished "${brief.early.title}" ${brief.early.minutes} minutes early.` });
    }
    if (brief.total > 0 && brief.done >= brief.total) {
        out.push({ kind: 'dayDone', keys: [String(brief.done)], facts: `Everything planned today is done: ${brief.done} of ${brief.total}.` });
    }
    if (brief.freeFor && brief.freeFor >= 15 && brief.next) {
        out.push({ kind: 'free', keys: [brief.next.title],
            facts: `They are free for ${mins(brief.freeFor)}, until "${brief.next.title}" at ${brief.next.at}.` });
    }
    if (brief.done === 0 && brief.total > 0 && brief.now >= 12 * 60) {
        out.push({ kind: 'nothingYet', keys: [String(brief.total)], facts: `Nothing is done yet today, and it is past noon. ${brief.total} things are planned.` });
    }
    if (brief.next && !brief.onNow) {
        out.push({ kind: 'next', keys: [brief.next.title], facts: `Next: "${brief.next.title}" at ${brief.next.at}.` });
    }
    return out;
}

type Lines = (brief: EchoBrief) => string[];

/** What Echo calls you: your first name when it has it, else a word that fits the voice. */
const you = (b: EchoBrief, otherwise: string) => (b.name ? b.name.split(' ')[0] : otherwise);
/** The thing waiting on you: on now, else next, else the plan. */
const waiting = (b: EchoBrief, otherwise: string) => b.onNow?.title ?? b.next?.title ?? otherwise;
const losingDuel = (b: EchoBrief) => b.duels.find(x => x.them > x.me)!;
const dueLine = (b: EchoBrief) => { const d = b.deadlines![0]; return { t: d.title, when: dueWhen(d.daysLeft), pct: d.progress !== undefined ? `, ${d.progress}% done` : '' }; };

/**
 * The written lines: always true, always about something specific, in each
 * voice. Several per voice, so Echo never reads like a loop, and written the
 * way a person would text you: it notices you are on your phone, calls it,
 * and now and then hands you one practical thing to do.
 */
const LINES: Record<PointKind, Record<PersonalityModeId, Lines>> = {
    scrolling: {
        friendly: b => [
            `${b.scrolled} minutes in your apps today. Let's put the phone down and give ${waiting(b, 'your plan')} some love 💙`,
            `Hey ${you(b, 'you')}, ${b.scrolled} minutes of scrolling so far. Want to swap the next ten for ${waiting(b, 'your plan')}? 💙`,
            `${b.scrolled} minutes scrolled. Try this: phone face down, timer for ten, start ${waiting(b, 'one small thing')} 💙`,
        ],
        normal: b => [
            `${b.scrolled} minutes of scrolling today. That's ${b.scrolled} minutes not spent on ${waiting(b, 'your goals')}.`,
            `${b.scrolled} minutes in your blocked apps. Close this, put the phone across the room, start ${waiting(b, 'your plan')}.`,
            `You've given your apps ${b.scrolled} minutes today. Give ${waiting(b, 'your plan')} the next fifteen.`,
        ],
        dad_mode: b => [
            `${b.scrolled} minutes on that phone. ${waiting(b, 'Your work')} is still waiting. Put it down.`,
            `I counted ${b.scrolled} minutes of scrolling today. Phone in a drawer, then ${waiting(b, 'your work')}.`,
            `${b.scrolled} minutes, ${you(b, 'kid')}. That's time you don't get back. ${waiting(b, 'Your work')}, now.`,
        ],
        bully_mode: b => [
            `${b.scrolled} minutes of brainrot today. That's ${b.scrolled} minutes further from your goals, loser. ${waiting(b, 'Your work')}. Now.`,
            `${b.scrolled} minutes of scrolling while ${waiting(b, 'your work')} sits there. Put the damn phone down.`,
            `${b.scrolled} minutes feeding the algorithm. It's getting rich off you. ${waiting(b, 'Your work')}. Go.`,
        ],
        goofball: b => [
            `${b.scrolled} minutes of scrolling. The algorithm thanks you for your service. ${waiting(b, 'Your to-do list')} does not.`,
            `${b.scrolled} minutes of brainrot. Impressive dedication. Wrong thing, though: ${waiting(b, 'your plan')}.`,
            `${b.scrolled} minutes in the apps. Your thumb is in incredible shape. ${waiting(b, 'Your plan')}, less so.`,
        ],
    },
    passed: {
        friendly: b => [
            `${b.passedBy!.name} just passed you on the leaderboard. You're #${b.passedBy!.rank}, one good push and you're back 💙`,
            `${b.passedBy!.name} edged ahead. You're #${b.passedBy!.rank}, one finished thing and you're right back in it 💙`,
        ],
        normal: b => [
            `${b.passedBy!.name} just passed you. You're #${b.passedBy!.rank} now.`,
            `${b.passedBy!.name} moved ahead. You're #${b.passedBy!.rank}. One more thing done today changes that.`,
        ],
        dad_mode: b => [
            `${b.passedBy!.name} just passed you. #${b.passedBy!.rank}. You going to let that stand?`,
            `#${b.passedBy!.rank}. ${b.passedBy!.name} worked harder today. Answer that.`,
        ],
        bully_mode: b => [
            `${b.passedBy!.name} just walked right past you on the leaderboard. #${b.passedBy!.rank}. Embarrassing. Get to work.`,
            `${b.passedBy!.name} just lapped you. #${b.passedBy!.rank}. They're not better than you, they're just not on their phone.`,
        ],
        goofball: b => [
            `Breaking news: ${b.passedBy!.name} just passed you. You're #${b.passedBy!.rank}. Revenge arc starts now?`,
            `Plot twist: ${b.passedBy!.name} overtook you. You're #${b.passedBy!.rank}. Every good sequel needs a comeback.`,
        ],
    },
    duel: {
        friendly: b => { const d = losingDuel(b); return [
            `You're at ${d.me}% and ${d.name} is at ${d.them}% in your duel, ${d.daysLeft} days left. Totally catchable 💙`,
            `${d.name} is ahead ${d.them}% to ${d.me}%. One really good day evens it 💙`,
        ]; },
        normal: b => { const d = losingDuel(b); return [
            `Duel with ${d.name}: you ${d.me}%, them ${d.them}%. ${d.daysLeft} days left.`,
            `You're behind ${d.name}, ${d.me}% to ${d.them}%. Finish everything today and it's close again.`,
        ]; },
        dad_mode: b => { const d = losingDuel(b); return [
            `${d.name} is beating you, ${d.them}% to ${d.me}%. ${d.daysLeft} days. Close it.`,
            `${d.daysLeft} days left and ${d.name} leads. I don't want to hear about it after.`,
        ]; },
        bully_mode: b => { const d = losingDuel(b); return [
            `${d.name} is wiping the floor with you: ${d.them}% to your ${d.me}%. ${d.daysLeft} days left. Do something about it.`,
            `You're losing to ${d.name}, ${d.me}% to ${d.them}%. Your Shards and your pride. Fix it.`,
        ]; },
        goofball: b => { const d = losingDuel(b); return [
            `Duel update: ${d.name} ${d.them}%, you ${d.me}%. ${d.daysLeft} days for a comeback the crowd will talk about.`,
            `${d.name} ${d.them}%, you ${d.me}%. The crowd is getting restless. Give them a show.`,
        ]; },
    },
    missed: {
        friendly: b => [
            `${b.missed[0]}${b.missed.length > 1 ? ` and ${b.missed.length - 1} more` : ''} slipped by today. That's okay, want to fit ${b.missed.length > 1 ? 'them' : 'it'} back in? 💙`,
            `Missed ${b.missed[0]}? Happens to everyone. A tiny version now still counts, even five minutes 💙`,
            `${b.missed[0]} didn't happen yet. Is there a quiet moment later for it? 💙`,
        ],
        normal: b => [
            `${b.missed.length} missed today, starting with ${b.missed[0]}. There's still time to fit ${b.missed.length > 1 ? 'them' : 'it'} in.`,
            `${b.missed[0]} went by undone. Shrink it: the five-minute version still counts.`,
            `${b.missed[0]} slipped. Give it a new time now, or move it to tomorrow. Don't leave it hanging.`,
        ],
        dad_mode: b => [
            `${b.missed[0]}${b.missed.length > 1 ? ` and ${b.missed.length - 1} more` : ''}: not done. You planned it. Finish it.`,
            `${b.missed[0]}. You planned it, you skipped it. Do it before the day's out.`,
            `Where was ${b.missed[0]} today? The only answer I'll take is doing it.`,
        ],
        bully_mode: b => [
            `You let ${b.missed[0]}${b.missed.length > 1 ? ` and ${b.missed.length - 1} more` : ''} slide today. Planned it, then bailed. Fix it.`,
            `${b.missed[0]}? Skipped. Planning is cute, doing is what counts. Go.`,
            `You wrote ${b.missed[0]} down and then ghosted it. Who are you even lying to? Do it.`,
        ],
        goofball: b => [
            `${b.missed[0]}${b.missed.length > 1 ? ` and ${b.missed.length - 1} of its friends` : ''} went by untouched. They're not mad, just disappointed.`,
            `${b.missed[0]} waited for you all day like a dog at the window. Go say hi.`,
            `${b.missed[0]} has filed a missing person report. The missing person is you.`,
        ],
    },
    onNow: {
        friendly: b => [
            `${b.onNow!.title} is on, ${b.onNow!.minutesLeft} minutes left. You've got this 💙`,
            `Hey ${you(b, 'you')}, isn't it ${b.onNow!.title} time? Phone down, I'll be right here after 💙`,
            `Caught you 👀 ${b.onNow!.title} is happening right now. Go, ${b.onNow!.minutesLeft} minutes is nothing.`,
            `${b.onNow!.title}, ${b.onNow!.minutesLeft} minutes left. Tip: flip the phone face down so it can't pull you back 💙`,
        ],
        normal: b => [
            `${b.onNow!.title}: ${b.onNow!.minutesLeft} minutes left.${b.next ? ` Then ${b.next.title}.` : ''}`,
            `You're on your phone during ${b.onNow!.title}. ${b.onNow!.minutesLeft} minutes left. Close the app.`,
            `${b.onNow!.title} is running. If you're reading this, you're not doing it.`,
            `${b.onNow!.title}, ${b.onNow!.minutesLeft} minutes to go. Put the phone out of reach. It's the one trick that works.`,
        ],
        dad_mode: b => [
            `${b.onNow!.title}. ${b.onNow!.minutesLeft} minutes left. Eyes on it.`,
            `${you(b, 'Kid')}, what are you doing? ${b.onNow!.title} is on. Phone away.`,
            `It's ${b.onNow!.title} time and you're on your phone. We both know that's not how this works.`,
            `${b.onNow!.title}. ${b.onNow!.minutesLeft} minutes. I'm not asking twice.`,
        ],
        bully_mode: b => [
            `${b.onNow!.title} is on and the clock's running: ${b.onNow!.minutesLeft} minutes. Stop reading this and do it.`,
            `Hey ${you(b, 'genius')}, what the hell are you doing? ${b.onNow!.title} is on RIGHT NOW. Drop the phone.`,
            `${b.onNow!.title} is happening and you're scrolling. ${b.onNow!.minutesLeft} minutes. Get off your ass.`,
            `Oh look, on your phone during ${b.onNow!.title}. Classic. Go.`,
        ],
        goofball: b => [
            `${b.onNow!.title}: ${b.onNow!.minutesLeft} minutes left. You're reading this instead. Bold.`,
            `Hey ${you(b, 'you')}, what are you doing here? ${b.onNow!.title} is literally on right now. I'm telling.`,
            `Breaking: local legend checks phone during ${b.onNow!.title}. Experts baffled. Go.`,
            `${b.onNow!.title} is on and you came to hang out with me. Flattered. Now leave, ${b.onNow!.minutesLeft} minutes.`,
        ],
    },
    deadline: {
        friendly: b => { const d = dueLine(b); return [
            `${d.t} is due ${d.when}${d.pct}. A little today makes the last day easy 💙`,
            `Heads up, ${d.t} is due ${d.when}. Want to do one small piece of it now? 💙`,
        ]; },
        normal: b => { const d = dueLine(b); return [
            `${d.t} is due ${d.when}${d.pct}. Do the hardest part today, not on the last day.`,
            `${d.t}: due ${d.when}. Block an hour for it now, while you're thinking about it.`,
        ]; },
        dad_mode: b => { const d = dueLine(b); return [
            `${d.t} is due ${d.when}. I expect it done early, not at midnight.`,
            `${d.t}, due ${d.when}${d.pct}. Don't make me remind you again.`,
        ]; },
        bully_mode: b => { const d = dueLine(b); return [
            `${d.t} is due ${d.when}${d.pct} and you're on your phone. Bold. Stupid, but bold.`,
            `${d.t} is due ${d.when}. Last-minute you is going to hate current you. Start.`,
        ]; },
        goofball: b => { const d = dueLine(b); return [
            `${d.t} is due ${d.when}. Future you is already sweating. Be nice to them.`,
            `${d.t} is due ${d.when}${d.pct}. Deadlines are closer than they appear.`,
        ]; },
    },
    friendDone: {
        friendly: b => [
            `${b.friendsDone[0].name} already finished their whole day! You've got ${b.total - b.done} left, you can do it too 💙`,
            `${b.friendsDone[0].name} wrapped up their day. ${b.total - b.done} to go for you, let's knock out the next one 💙`,
        ],
        normal: b => [
            `${b.friendsDone[0].name} finished everything today. You have ${b.total - b.done} left.`,
            `${b.friendsDone[0].name} is done for today. ${b.total - b.done} left on yours. Next one, now.`,
        ],
        dad_mode: b => [
            `${b.friendsDone[0].name} is done for the day. You still have ${b.total - b.done}. Get moving.`,
            `${b.friendsDone[0].name} finished everything. You've got ${b.total - b.done}. No excuses.`,
        ],
        bully_mode: b => [
            `${b.friendsDone[0].name} already finished everything. You've still got ${b.total - b.done} sitting there. Pathetic. Catch up.`,
            `${b.friendsDone[0].name} is done and chilling. You've got ${b.total - b.done} left and you're on your phone. Think about it.`,
        ],
        goofball: b => [
            `${b.friendsDone[0].name} finished their whole day and is probably being smug about it. You: ${b.total - b.done} left.`,
            `${b.friendsDone[0].name}: done. You: ${b.total - b.done} to go and reading this. Interesting strategy.`,
        ],
    },
    friendFocusing: {
        friendly: b => [
            `${b.friendsFocusing[0].name} is focusing right now${b.friendsFocusing[0].on ? ` on ${b.friendsFocusing[0].on}` : ''}. Want to join them? 💙`,
            `${b.friendsFocusing[0].name} is in focus mode. Start a timer too and keep each other company 💙`,
        ],
        normal: b => [
            `${b.friendsFocusing[0].name} is focusing right now. Good moment to start yours.`,
            `${b.friendsFocusing[0].name} is working right now. Start a focus and match them.`,
        ],
        dad_mode: b => [
            `${b.friendsFocusing[0].name} is working right now. What are you doing?`,
            `${b.friendsFocusing[0].name} is putting in the hours right now. Are you?`,
        ],
        bully_mode: b => [
            `${b.friendsFocusing[0].name} is locked in right now while you're on your phone. Think about that.`,
            `${b.friendsFocusing[0].name} is grinding right now. You're here. That's the whole difference between you two.`,
        ],
        goofball: b => [
            `${b.friendsFocusing[0].name} is in focus mode right now. Being out-worked live. Riveting.`,
            `${b.friendsFocusing[0].name} is focusing. You're scrolling. One of you is the main character.`,
        ],
    },
    early: {
        friendly: b => [
            `${b.early!.title} done ${b.early!.minutes} minutes early! Look at you go 🎉`,
            `${b.early!.title} done early! Use the extra minutes however you like, you earned them 🎉`,
        ],
        normal: b => [
            `${b.early!.title} done ${b.early!.minutes} minutes early. Everything after it moved up.`,
            `${b.early!.title} finished ahead of time. Bank it: start the next thing now.`,
        ],
        dad_mode: b => [
            `${b.early!.title}, done early. Good. Keep that pace.`,
            `${b.early!.title} done ahead of time. That's the standard now.`,
        ],
        bully_mode: b => [
            `${b.early!.title} done ${b.early!.minutes} minutes early. Fine. Don't get comfortable.`,
            `${b.early!.title}, early. Okay. Now do it again with the next one.`,
        ],
        goofball: b => [
            `${b.early!.title}, ${b.early!.minutes} minutes early. Who are you and what did you do with the procrastinator?`,
            `${b.early!.title} done early. The schedule is shook.`,
        ],
    },
    dayDone: {
        friendly: b => [`All ${b.done} done today. I'm so proud of you 🎉`, `Everything done, all ${b.done}. Go enjoy your evening, you earned it 🎉`],
        normal: b => [`${b.done} of ${b.total} done. Today is complete.`, `All ${b.done} done. Rest properly, tomorrow starts the same way.`],
        dad_mode: b => [`All ${b.done} done. That's what keeping your word looks like.`, `${b.done} things, all done. Proud of you. Don't make it a one-off.`],
        bully_mode: b => [`All ${b.done} done. Finally. Same again tomorrow.`, `All ${b.done} done. See? You can do it when you stop whining.`],
        goofball: b => [`All ${b.done} done. Take a bow. A small one, there's tomorrow.`, `${b.done} for ${b.done}. Someone call the newspapers.`],
    },
    free: {
        friendly: b => [
            `You're free until ${b.next!.at}, then ${b.next!.title}. Enjoy the breather 💙`,
            `Free time until ${b.next!.title} at ${b.next!.at}. Maybe some water or a short walk? 💙`,
        ],
        normal: b => [
            `Free until ${b.next!.at}. Then ${b.next!.title}.`,
            `Nothing until ${b.next!.title} at ${b.next!.at}. Use the gap: prepare for it, or rest properly. Not scrolling.`,
        ],
        dad_mode: b => [
            `Free until ${b.next!.at}. Be ready for ${b.next!.title}.`,
            `You've got time before ${b.next!.title}. Use it. Get ahead.`,
        ],
        bully_mode: b => [
            `Free till ${b.next!.at}. Don't waste it scrolling. ${b.next!.title} after.`,
            `Free until ${b.next!.at}. Spend it on your phone and you'll show up to ${b.next!.title} brain-fried.`,
        ],
        goofball: b => [
            `Free until ${b.next!.at}. Then ${b.next!.title} makes its grand entrance.`,
            `Free until ${b.next!.at}. ${b.next!.title} is backstage fixing its hair.`,
        ],
    },
    nothingYet: {
        friendly: b => [
            `Nothing ticked yet today, and ${b.total} things are waiting. Let's start with just one 💙`,
            `${b.total} things planned and none started. The smallest one first, two minutes, go 💙`,
        ],
        normal: b => [
            `Past noon and nothing done yet. ${b.total} planned. Start with one.`,
            `None of ${b.total} done and it's past noon. Pick the easiest and finish it in the next twenty minutes.`,
        ],
        dad_mode: b => [
            `Half the day gone and nothing done. ${b.total} things. Start now.`,
            `${b.total} things, nothing done. Sit down and start. Now.`,
        ],
        bully_mode: b => [
            `Half the day gone and you've done nothing. Zero out of ${b.total}. Get your ass moving.`,
            `${b.total} things on your list and you've done jack shit. Pick one. Now.`,
        ],
        goofball: b => [
            `Zero out of ${b.total} and it's past noon. A bold strategy. Let's see if it pays off.`,
            `${b.total} things planned, none done. Speedrun attempt? Start with the easiest.`,
        ],
    },
    next: {
        friendly: b => [`Next up: ${b.next!.title} at ${b.next!.at} 💙`, `${b.next!.title} at ${b.next!.at}. Grab some water and be ready 💙`],
        normal: b => [`Next: ${b.next!.title} at ${b.next!.at}.`, `${b.next!.title} at ${b.next!.at}. Five minutes before, put the phone away.`],
        dad_mode: b => [`${b.next!.title} at ${b.next!.at}. Be ready.`, `${b.next!.title} at ${b.next!.at}. On time means early.`],
        bully_mode: b => [`${b.next!.title} at ${b.next!.at}. Don't be late.`, `${b.next!.title} at ${b.next!.at}. Be there, not on your phone.`],
        goofball: b => [`Coming up at ${b.next!.at}: ${b.next!.title}. Tickets are free.`, `${b.next!.title} at ${b.next!.at}. Dress code: not holding your phone.`],
    },
};

/** The written line for a point, in a voice; `pick` chooses among its variants. */
export function writtenLine(point: TalkingPoint, brief: EchoBrief, voice: PersonalityModeId, pick = 0): string {
    const lines = writtenLines(point, brief, voice);
    return lines[Math.abs(pick) % lines.length];
}

/** Every written variant of a point, in a voice. */
export function writtenLines(point: TalkingPoint, brief: EchoBrief, voice: PersonalityModeId): string[] {
    return (LINES[point.kind][voice] ?? LINES[point.kind].normal)(brief);
}

/** A rephrasing by the model is kept only when it still says the same thing, well. */
export function keepsTheFacts(line: string | null | undefined, point: TalkingPoint): line is string {
    if (!line) return false;
    const text = line.trim();
    if (text.length < 12 || text.length > 220) return false;
    const lower = text.toLowerCase();
    if (!point.keys.every(key => lower.includes(key.toLowerCase()))) return false;
    // A sentence that repeats itself, or chains words without saying anything.
    const words = lower.split(/\s+/);
    if (new Set(words).size < words.length * 0.6) return false;
    if (/(.{12,})\1/.test(lower)) return false;
    return true;
}

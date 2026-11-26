import { clockTime, findAnchor, findReminder, findSubtasks, findTracking } from '../settingWords';

describe('Link: right before or right after something', () => {
    it.each([
        ['Gym right after work', 'after', 'Work'],
        ['Stretch just before my class', 'before', 'Class'],
        ['Meditate straight after Gym', 'after', 'Gym'],
        ['Read immediately after dinner', 'after', 'Dinner'],
        ['Journal as soon as I finish work', 'after', 'Work'],
        ['Walk once I get back from school', 'after', 'School'],
        ['Review notes when I get out of Accounting', 'after', 'Accounting'],
        ['Stretch after my run', 'after', 'Run'],
        ['Prep before the meeting, 10 min', 'before', 'Meeting'],
        ['Floss after each meal', 'after', 'Meal'],
        ['Pray first thing after waking', null, null],
        ['Water plants right before Lunch at 12', 'before', 'Lunch'],
    ])('%s', (text, side, to) => {
        const found = findAnchor(text);
        if (!side) { expect(found).toBeNull(); return; }
        expect(found).toMatchObject({ side, to });
    });
    it('uses the names the day already has', () => {
        expect(findAnchor('Walk after lunch', ['Lunch'])).toMatchObject({ side: 'after', to: 'Lunch' });
        expect(findAnchor('Read before Accounting', ['Accounting 101', 'Accounting'])).toMatchObject({ to: 'Accounting' });
    });
    it('never reads a time or a date as a link', () => {
        expect(findAnchor('Run before 9 AM')).toBeNull();
        expect(findAnchor('Submit after Friday')).toBeNull();
        expect(findAnchor('Read before bed')).toBeNull();
        expect(findAnchor('Call right after 5pm')).toBeNull();
        expect(findAnchor('Pay after tomorrow')).toBeNull();
    });
    it('takes out exactly what it read', () => {
        expect(findAnchor('Gym right after work, 45 min')?.phrase).toBe(' right after work'.trim());
    });
});

describe('Reminder', () => {
    it.each([
        ['Run, remind me 10 min before', { alerts: [10] }],
        ['Gym and notify me an hour ahead', { alerts: [60] }],
        ['Call mom, remind me half an hour before', { alerts: [30] }],
        ['Pay rent with a 15 minute heads-up', { alerts: [15] }],
        ['Essay, remind me at 8am', { at: '08:00' }],
        ['Pills, reminder at 9:30 pm', { at: '21:30' }],
        ['Take meds, remind me', { alerts: [10] }],
        ['Remind me to drink water', { alerts: [10] }],
        ['Read, no reminder', { none: true }],
        ["Stretch, don't remind me", { none: true }],
    ])('%s', (text, expected) => { expect(findReminder(text)).toMatchObject(expected); });
    it('says nothing when there is no reminder', () => { expect(findReminder('Run 10 min before work')).toBeNull(); });
});

describe('Tracking', () => {
    it.each([
        ['Run from Apple Health', 'health'],
        ['Steps with my Apple Watch', 'health'],
        ['Ride on Strava', 'health'],
        ['Gym, tracked with Bevel', 'health'],
        ['Read on Libby 30 min', 'app'],
        ['Spanish in Duolingo', 'app'],
        ['Read 20 min using Kindle', 'app'],
        ['Meditate in the Calm app', 'app'],
        ['Lift at the gym', 'place'],
        ['Study at the library 2 hours', 'place'],
        ['Run, auto-track it', 'auto'],
    ])('%s', (text, kind) => { expect(findTracking(text)?.kind).toBe(kind); });
    it('names the app', () => { expect(findTracking('Read on Libby')).toMatchObject({ kind: 'app', app: 'Libby' }); });
    it('leaves plain sentences alone', () => { expect(findTracking('Call the bank')).toBeNull(); });
});

describe('Subtasks', () => {
    it.each([
        ['Buy groceries: milk, eggs, bread', ['milk', 'eggs', 'bread']],
        ['Trip — book flights, pack and get cash', ['book flights', 'pack', 'get cash']],
        ['Report, steps: draft, edit, send', ['draft', 'edit', 'send']],
        ['Move out with checklist: boxes; tape; van', ['boxes', 'tape', 'van']],
    ])('%s', (text, steps) => { expect(findSubtasks(text)?.subtasks).toEqual(steps); });
    it('never reads a time or a single thing as a list', () => {
        expect(findSubtasks('Meeting at 5:30')).toBeNull();
        expect(findSubtasks('Note: call back')).toBeNull();
    });
});

describe('clock times', () => {
    it('reads the ways a time is written', () => {
        expect([clockTime('8am'), clockTime('8:30 pm'), clockTime('20:00'), clockTime('noon'), clockTime('3')]).toEqual(['08:00', '20:30', '20:00', '12:00', '15:00']);
    });
});

import { DONE_CATEGORY, HANDOVER_CATEGORY, ENERGY_CATEGORY, CATEGORIES, streakGuard } from '../notificationActions';

describe('notification buttons', () => {
    it('offers Done first on every item, never more than four buttons', () => {
        for (const category of CATEGORIES.filter(category => category.id !== ENERGY_CATEGORY && category.id !== HANDOVER_CATEGORY)) {
            expect(category.buttons.length).toBeLessThanOrEqual(4);
            expect(category.buttons[0].buttonTitle).toBe('Done');
        }
    });
    it('a handover names what its button ticks: the last one, not the one starting', () => {
        expect(CATEGORIES.find(category => category.id === HANDOVER_CATEGORY)!.buttons.map(button => button.buttonTitle)).toEqual(['Last one done']);
    });
    it('the day as it happens has one button: Done, for the one whose time just ended', () => {
        expect(CATEGORIES.find(category => category.id === DONE_CATEGORY)!.buttons.map(button => button.buttonTitle)).toEqual(['Done']);
    });
    it('asks energy with three answers that do not open the app', () => {
        const energy = CATEGORIES.find(category => category.id === ENERGY_CATEGORY)!;
        expect(energy.buttons.map(button => button.buttonTitle)).toEqual(['Low', 'Okay', 'High']);
        expect(energy.buttons.every(button => !button.options.opensAppToForeground)).toBe(true);
    });
});

describe('keeping the run alive', () => {
    it('speaks two hours before bed when nothing is done and there is a run', () => {
        const line = streakGuard({ streak: 6, doneToday: false, now: 600, sleep: 23 * 60, name: 'Erwan Peter', next: 'Read' });
        expect(line?.at).toBe(21 * 60);
        expect(line?.body).toContain('Erwan');
        expect(line?.body).toContain('6-day run');
        expect(line?.body).toContain('5 minutes on Read');
    });
    it('stays quiet with no run, once something is done, or once the time has passed', () => {
        expect(streakGuard({ streak: 1, doneToday: false, now: 600, sleep: 1380 })).toBeNull();
        expect(streakGuard({ streak: 6, doneToday: true, now: 600, sleep: 1380 })).toBeNull();
        expect(streakGuard({ streak: 6, doneToday: false, now: 1300, sleep: 1380 })).toBeNull();
    });
});

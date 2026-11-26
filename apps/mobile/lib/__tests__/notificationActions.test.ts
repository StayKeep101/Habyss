import { DONE_CATEGORY, HANDOVER_CATEGORY, ENERGY_CATEGORY, CATEGORIES, FRIEND_NUDGE_CATEGORY, COMMENT_CATEGORY, DUEL_CATEGORY, SHARE_CATEGORY, FRIEND_REQUEST_CATEGORY, CHALLENGE_CATEGORY, QUICK_ADD_CATEGORIES, streakGuard } from '../notificationActions';

describe('notification buttons', () => {
    it('offers Done first on every item, never more than four buttons', () => {
        for (const category of CATEGORIES.filter(category => ![ENERGY_CATEGORY, HANDOVER_CATEGORY, FRIEND_NUDGE_CATEGORY, COMMENT_CATEGORY, DUEL_CATEGORY, SHARE_CATEGORY, FRIEND_REQUEST_CATEGORY, CHALLENGE_CATEGORY].includes(category.id) && !(category.id in QUICK_ADD_CATEGORIES))) {
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

describe('adding from a notification', () => {
    it('every kind has a text field and adds without opening the app', () => {
        for (const id of Object.keys(QUICK_ADD_CATEGORIES)) {
            const category = CATEGORIES.find(entry => entry.id === id)!;
            expect(category.buttons).toHaveLength(1);
            expect(category.buttons[0].textInput?.submitButtonTitle).toBe('Add');
            expect(category.buttons[0].options.opensAppToForeground).toBe(false);
        }
    });
});

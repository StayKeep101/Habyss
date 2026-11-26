import { FIRST_RUN, stepAfterMissing, startTour, goToStep, getTour, endTour, claimLayer, topLayer } from '../coachMarks';

describe('first-run tour', () => {
    it('goes in the order asked: Home, a first habit, Roadmap, friends', () => {
        expect(FIRST_RUN.map(step => step.target)).toEqual([
            'today-focus', 'streak', 'focus-today', 'missed',
            'plus', 'create-habit',
            'tab-roadmap', 'tab-community', 'add-friend',
        ]);
    });

    it('waits for the person on the steps they do themselves', () => {
        const waiting = FIRST_RUN.filter(step => step.waitFor).map(step => step.target);
        expect(waiting).toEqual(['plus', 'create-habit', 'tab-roadmap', 'tab-community']);
    });

    it('goes back to + when the menu is gone, and on past anything else missing', () => {
        const at = (target: string) => FIRST_RUN.findIndex(step => step.target === target);
        expect(stepAfterMissing(FIRST_RUN, at('create-habit'))).toBe(at('plus'));
        expect(stepAfterMissing(FIRST_RUN, at('missed'))).toBe(at('plus'));
    });

    it('ends after the last step', () => {
        startTour();
        goToStep(FIRST_RUN.length);
        expect(getTour().active).toBe(false);
        startTour();
        endTour();
        expect(getTour()).toEqual({ active: false, index: 0 });
    });

    it('is drawn by the newest layer: a sheet over the app', () => {
        const app = claimLayer();
        const sheet = claimLayer();
        expect(topLayer()).toBe(sheet.id);
        sheet.release();
        expect(topLayer()).toBe(app.id);
        app.release();
    });
});

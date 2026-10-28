import { FIRST_RUN, stepAfterMissing, startTour, goToStep, getTour, endTour, claimLayer, topLayer } from '../coachMarks';

describe('first-run tour', () => {
    it('goes in the order asked: Home, a first goal, Roadmap, friends', () => {
        expect(FIRST_RUN.map(step => step.target)).toEqual([
            'today-focus', 'streak', 'focus-today', 'missed', 'goals',
            'plus', 'create-goal', 'goal-text', 'goal-details', 'goal-save',
            'tab-roadmap', 'roadmap-goal', 'tab-community', 'add-friend',
        ]);
    });

    it('waits for the person on the steps they do themselves', () => {
        const waiting = FIRST_RUN.filter(step => step.waitFor).map(step => step.target);
        expect(waiting).toEqual(['plus', 'create-goal', 'goal-save', 'tab-roadmap', 'tab-community']);
    });

    it('goes back to + when the goal sheet is gone, and on past anything else missing', () => {
        const at = (target: string) => FIRST_RUN.findIndex(step => step.target === target);
        expect(stepAfterMissing(FIRST_RUN, at('goal-details'))).toBe(at('plus'));
        expect(stepAfterMissing(FIRST_RUN, at('create-goal'))).toBe(at('plus'));
        expect(stepAfterMissing(FIRST_RUN, at('missed'))).toBe(at('goals'));
    });

    it('ends after the last step', () => {
        startTour();
        goToStep(FIRST_RUN.length);
        expect(getTour().active).toBe(false);
        startTour();
        endTour();
        expect(getTour()).toEqual({ active: false, index: 0 });
    });

    it('is drawn by the newest layer: the goal sheet over the app', () => {
        const app = claimLayer();
        const sheet = claimLayer();
        expect(topLayer()).toBe(sheet.id);
        sheet.release();
        expect(topLayer()).toBe(app.id);
        app.release();
    });
});

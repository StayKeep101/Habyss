import { questStanding, questWeek, type CrewMember } from '../crewQuest';

const member = (userId: string, showUps: number, extra: Partial<CrewMember> = {}): CrewMember =>
    ({ userId, name: userId, showUps, active: true, mine: false, ...extra });

describe('the crew quest', () => {
    it('runs Monday to Sunday, or Sunday to Saturday', () => {
        expect(questWeek('2026-10-28', true)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
        expect(questWeek('2026-10-28', false)).toEqual({ from: '2026-10-25', to: '2026-10-31' });
    });
    it('sets ten show-ups for each person around, and adds up what everyone brought', () => {
        const standing = questStanding([member('me', 12, { mine: true }), member('alex', 9), member('sam', 4)]);
        expect(standing).toMatchObject({ done: 25, target: 30, reached: false });
        expect(standing.crew.map(m => m.userId)).toEqual(['me', 'alex', 'sam']);
    });
    it('leaves out friends who have gone quiet, so they never put it out of reach', () => {
        const standing = questStanding([member('me', 10, { mine: true }), member('ghost', 0, { active: false })]);
        expect(standing).toMatchObject({ target: 10, reached: true });
        expect(standing.crew.map(m => m.userId)).toEqual(['me']);
    });
});

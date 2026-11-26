jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockAddNote = jest.fn(async () => null);
jest.mock('../echoMemory', () => ({ addNote: mockAddNote }));
import { answerFrom, daysAwayBefore, dueQuestion, markAsked, questionFor, resetTalkForTests, saveAnswer, TALK_QUESTIONS, yesterdayAnswer } from '../echoConversation';

beforeEach(() => resetTalkForTests());

describe('one real question a day', () => {
    it('asks for the win in the morning, how it went in the evening, nothing in between', () => {
        expect(questionFor(8, '2026-11-11')?.id).toBe('win');
        expect(questionFor(14, '2026-11-11')).toBeNull();
        expect(questionFor(20, '2026-11-11')?.id).toBe('blocker');
        expect(questionFor(20, '2026-11-12')?.id).toBe('wentWell');
    });
    it('never twice in a day', async () => {
        const morning = new Date(2026, 10, 11, 8, 0);
        expect(await dueQuestion(morning, '2026-11-11')).not.toBeNull();
        await markAsked('2026-11-11');
        expect(await dueQuestion(morning, '2026-11-11')).toBeNull();
    });
    it('remembers the answer for tomorrow, and keeps what got in the way as a note', async () => {
        await saveAnswer('2026-11-11', TALK_QUESTIONS.blocker, '  Too tired after work  ');
        expect(await yesterdayAnswer('2026-11-11')).toEqual({ question: TALK_QUESTIONS.blocker.text, answer: 'Too tired after work' });
        expect(mockAddNote).toHaveBeenCalledWith('obstacle', 'Too tired after work');
        expect(answerFrom([], '2026-11-11')).toBeUndefined();
    });
    it('knows how long you were away', async () => {
        expect(await daysAwayBefore('2026-11-04')).toBe(0);
    });
});

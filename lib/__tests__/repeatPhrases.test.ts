import { parseHabitText } from '../habitParser';
import { splitSpeech } from '../voicePlan';
import { readVoice } from '../voiceIntent';

// A Saturday, the 14th of November.
const today = new Date(2026, 10, 14, 9, 0);
const rule = (text: string) => parseHabitText(text, today).recurrence;

describe('every repeat the habit settings offer, said in words', () => {
    it('reads every few weeks, on the day it starts or the weekday said', () => {
        expect(parseHabitText('Make Food Every 4 weeks', today)).toMatchObject({ name: 'Make Food', recurrence: { kind: 'weekly', every: 4, weekdays: ['sat'] } });
        expect(rule('Call grandma every 3 weeks on Sunday')).toEqual({ kind: 'weekly', every: 3, weekdays: ['sun'] });
        expect(rule('Clean the car fortnightly')).toEqual({ kind: 'weekly', every: 2, weekdays: ['sat'] });
        expect(rule('Review budget every two weeks')).toEqual({ kind: 'weekly', every: 2, weekdays: ['sat'] });
    });
    it('reads every few months and years', () => {
        expect(rule('Haircut every 6 weeks')).toEqual({ kind: 'weekly', every: 6, weekdays: ['sat'] });
        expect(rule('Dentist every 6 months')).toEqual({ kind: 'monthly', every: 6, dates: [14] });
        expect(rule('Change filters quarterly')).toEqual({ kind: 'monthly', every: 3, dates: [14] });
        expect(rule('Check-up every year')).toEqual({ kind: 'yearly', every: 1, months: [10] });
        expect(rule('Renew passport every 10 years')).toEqual({ kind: 'yearly', every: 10, months: [10] });
    });
    it('still reads the ones it already knew', () => {
        expect(rule('Run every 2 days')).toEqual({ kind: 'daily', every: 2 });
        expect(rule('Gym 3 times a week')).toEqual({ kind: 'quota', every: 1, times: 3, period: 'week' });
        expect(rule('Clean every month')).toEqual({ kind: 'quota', every: 1, times: 1, period: 'month' });
        expect(parseHabitText('Read every weekday', today).taskDays).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
        expect(rule('Pay rent on the 1st of every month')).toEqual({ kind: 'monthly', every: 1, dates: [1] });
    });
});

describe('a verb is only a command when it says what to make', () => {
    it('keeps "make" when making is the thing itself', () => {
        expect(splitSpeech('Make Food Every 4 weeks')).toEqual([{ kind: 'habit', text: 'Make Food Every 4 weeks' }]);
        expect(readVoice('Add salt to the soup')?.text).toBe('Add salt to the soup');
    });
    it('still drops it as a command', () => {
        expect(readVoice('Make a habit of reading every night')).toMatchObject({ kind: 'habit', text: 'Reading every night' });
        expect(readVoice('Add a task call the bank')).toMatchObject({ kind: 'task', text: 'Call the bank' });
        expect(readVoice('Create a new goal run a marathon by June')?.kind).toBe('task');
    });
});

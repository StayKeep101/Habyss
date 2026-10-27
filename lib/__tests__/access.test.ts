jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { accessFrom, friendPrice, isOpen, TRIAL_DAYS } from '../access';

const DAY = 24 * 60 * 60 * 1000;
const start = new Date(2026, 9, 1, 9).getTime();

describe('access: a free week, then one payment', () => {
    it('never locks when there is no way to pay', () => {
        expect(accessFrom({ billing: false, owned: false, trialStart: start, now: start + 30 * DAY })).toEqual({ kind: 'owned' });
    });

    it('is yours once bought, whatever the trial says', () => {
        expect(accessFrom({ billing: true, owned: true, trialStart: start, now: start + 30 * DAY })).toEqual({ kind: 'owned' });
    });

    it('asks to start the free week before anything', () => {
        expect(accessFrom({ billing: true, owned: false, trialStart: null, now: start }).kind).toBe('not_started');
    });

    it('counts the days left, and locks when the week is up', () => {
        expect(accessFrom({ billing: true, owned: false, trialStart: start, now: start + DAY / 2 })).toMatchObject({ kind: 'trial', daysLeft: 7 });
        expect(accessFrom({ billing: true, owned: false, trialStart: start, now: start + 6.5 * DAY })).toMatchObject({ kind: 'trial', daysLeft: 1 });
        expect(accessFrom({ billing: true, owned: false, trialStart: start, now: start + TRIAL_DAYS * DAY }).kind).toBe('ended');
        expect(isOpen({ kind: 'ended' })).toBe(false);
        expect(isOpen({ kind: 'trial', daysLeft: 3, endsAt: 0 })).toBe(true);
    });

    it('is half price when invited, or once three invited friends have joined', () => {
        expect(friendPrice(null)).toBe(false);
        expect(friendPrice({ invitedBy: null, joined: 0 })).toBe(false);
        // One friend joining is enough: whoever invites pays half too.
        expect(friendPrice({ invitedBy: null, joined: 1 })).toBe(true);
        expect(friendPrice({ invitedBy: null, joined: 3 })).toBe(true);
        expect(friendPrice({ invitedBy: 'milo', joined: 0 })).toBe(true);
    });
});

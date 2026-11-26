import { lockState, UNLOCK_OPEN_MS, UNLOCK_WAIT_MS } from '../gateLock';

describe('gate hard lock', () => {
    const asked = 1_000_000;

    it('is locked when no unlock was asked', () => {
        expect(lockState(null, asked)).toEqual({ kind: 'locked' });
    });

    it('waits a full day after asking', () => {
        expect(lockState(asked, asked)).toEqual({ kind: 'waiting', opensAt: asked + UNLOCK_WAIT_MS });
        expect(lockState(asked, asked + UNLOCK_WAIT_MS - 1).kind).toBe('waiting');
    });

    it('opens once the wait is over, for a limited time', () => {
        expect(lockState(asked, asked + UNLOCK_WAIT_MS)).toEqual({ kind: 'open', closesAt: asked + UNLOCK_WAIT_MS + UNLOCK_OPEN_MS });
    });

    it('locks again by itself when the open window passes unused', () => {
        expect(lockState(asked, asked + UNLOCK_WAIT_MS + UNLOCK_OPEN_MS)).toEqual({ kind: 'locked' });
    });

    it('treats a corrupt stored value as locked', () => {
        expect(lockState(NaN, asked)).toEqual({ kind: 'locked' });
    });
});

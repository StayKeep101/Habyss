import { canEditShared } from '../sharedAdopt';

/**
 * Who may change what a shared thing is.
 *
 * Everybody on it. A shared goal is one plan two people carry out together, so
 * a cover photo, a reminder or a new task either of them adds reaches the other.
 * It is one row on the server, which is what stops the two copies drifting.
 */
describe('editing something two people are doing together', () => {
    it('is for whoever offered it', () => {
        expect(canEditShared('owner', 'owner')).toBe(true);
    });

    it('is for the person who accepted it too', () => {
        expect(canEditShared('owner', 'friend')).toBe(true);
    });

    it('says yes for anything nobody else is on', () => {
        expect(canEditShared(undefined, 'me')).toBe(true);
    });
});

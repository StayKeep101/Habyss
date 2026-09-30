import { canEditShared } from '../sharedAdopt';

/**
 * Who may change what a shared thing is.
 *
 * The rule has to be stated somewhere that fails when it changes, because the
 * alternative — both sides editing — has no good answer: one person moves the
 * habit to 7am and the other is late for something they never agreed to, or the
 * copies drift and both believe they are doing the same thing while doing
 * different ones. There is no merge for a disagreement about what a habit is.
 */
describe('editing something two people are doing together', () => {
    it('is for whoever offered it', () => {
        expect(canEditShared('owner', 'owner')).toBe(true);
    });

    it('is not for the person who accepted it', () => {
        expect(canEditShared('owner', 'friend')).toBe(false);
    });

    it('says yes for anything nobody else is on', () => {
        // An unshared item has no owner to compare against, and the sheets ask
        // this for every item rather than checking first.
        expect(canEditShared(undefined, 'me')).toBe(true);
    });

    it('says yes rather than locking somebody out when it cannot tell', () => {
        // Signed out, or mid-load. A read-only sheet you cannot explain is
        // worse than an edit that the server would refuse anyway.
        expect(canEditShared('owner', undefined)).toBe(true);
    });
});

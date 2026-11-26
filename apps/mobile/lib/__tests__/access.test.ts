jest.mock('@/lib/RevenueCat', () => ({ __esModule: true, default: { isConfigured: () => false } }));
import { proFrom, proStatusLine } from '../access';

describe('Habyss Pro', () => {
    it('is free unless the store says Pro is active', () => {
        expect(proFrom(null)).toEqual({ kind: 'free' });
        expect(proFrom({ active: false, until: null, renews: false })).toEqual({ kind: 'free' });
        expect(proFrom({ active: true, until: 1000, renews: true })).toEqual({ kind: 'pro', until: 1000, renews: true });
    });

    it('says when it renews, when a cancelled one ends, and a lifetime purchase is for good', () => {
        const at = new Date(2026, 11, 5).getTime();
        expect(proStatusLine({ kind: 'free' })).toBeNull();
        expect(proStatusLine({ kind: 'pro', until: null, renews: false })).toBe('Pro is yours for good.');
        expect(proStatusLine({ kind: 'pro', until: at, renews: true })).toMatch(/^Pro is on\. Renews .+\.$/);
        expect(proStatusLine({ kind: 'pro', until: at, renews: false })).toMatch(/won’t renew\.$/);
    });
});

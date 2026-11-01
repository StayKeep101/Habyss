import { exposedActions, type ExposedChallenge } from '../exposed';
jest.mock('../supabase', () => ({ getSupabase: () => null }));
const challenge = (status: ExposedChallenge['status']): ExposedChallenge => ({ id: 'c', owner_id: 'owner', reviewer_id: 'reviewer', title: 'Six hours', proof_method: 'A session summary', proof: null, status });
it('requires a friend to agree before the owner can claim', () => {
    expect(exposedActions(challenge('proposed'), 'owner')).toEqual([]);
    expect(exposedActions(challenge('proposed'), 'friend')).toEqual(['accept']);
    expect(exposedActions(challenge('active'), 'owner')).toEqual(['claim', 'concede']);
});
it('limits proof requests and verification to the agreed reviewer', () => {
    expect(exposedActions(challenge('claimed'), 'reviewer')).toEqual(['expose']);
    expect(exposedActions(challenge('claimed'), 'friend')).toEqual([]);
    expect(exposedActions(challenge('submitted'), 'owner')).toEqual(['concede']);
    expect(exposedActions(challenge('submitted'), 'reviewer')).toEqual(['verify', 'reject']);
});
it('offers proof or a loss and leaves settled challenges closed', () => {
    expect(exposedActions(challenge('exposed'), 'owner')).toEqual(['submit', 'concede']);
    for (const status of ['verified', 'lost'] as const) {
        expect(exposedActions(challenge(status), 'owner')).toEqual([]);
        expect(exposedActions(challenge(status), 'reviewer')).toEqual([]);
    }
});

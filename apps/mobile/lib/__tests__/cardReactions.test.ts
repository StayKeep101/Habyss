jest.mock('../supabase', () => ({ getSupabase: () => null }));
import { withMine } from '../cardReactions';

it('changing your emoji moves your one vote', () => {
    let state = withMine({}, 'cover', '🔥');
    expect(state.cover).toEqual({ counts: { '🔥': 1 }, mine: '🔥' });
    state = withMine({ cover: { counts: { '🔥': 3 }, mine: '🔥' } }, 'cover', '💪');
    expect(state.cover).toEqual({ counts: { '🔥': 2, '💪': 1 }, mine: '💪' });
    state = withMine(state, 'cover', null);
    expect(state.cover).toEqual({ counts: { '🔥': 2 }, mine: null });
});

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { MarketSection } from '../Market/MarketSection';

jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => { const React = require('react'); React.useEffect(effect, []); } }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('@/hooks/useSoundEffects', () => ({ useSoundEffects: () => ({ playComplete: jest.fn() }) }));
jest.mock('@/lib/market', () => ({
    ...jest.requireActual('@/lib/market'),
    marketFeed: jest.fn(async () => []),
    myWallet: jest.fn(async () => ({ ledger: 0, inPlay: 0, spendable: 140, entries: [] })),
    openMarket: jest.fn(async () => undefined),
}));
jest.mock('@/hooks/useGoalInsights', () => ({
    useGoalsInsights: () => ({
        today: '2026-10-28',
        goals: [
            { id: 'g1', name: 'Run a half marathon', icon: 'trophy', color: '#22C55E', targetDate: '2026-11-20' },
            { id: 'g2', name: 'Read 12 books', icon: 'book', color: '#F59E0B' },
        ],
    }),
}));

it('invites you to open a goal when there are no bets, and opens one from the list', async () => {
    const screen = render(<MarketSection />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.press(screen.getByText('Open a goal to bets'));
    expect(screen.getByText('Run a half marathon')).toBeTruthy();
    // A goal without a deadline is listed, with why it can't be opened yet.
    expect(screen.getByText('No deadline')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Run a half marathon')); });
    expect(jest.requireMock('@/lib/market').openMarket).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', targetDate: '2026-11-20' }));
});

it('opens the bet from the card: pick a side, see what it would win, place it', async () => {
    const market = {
        id: 'm1', ownerId: 'o', name: 'Sam', goalKey: 'g', title: 'Run a 5k', deadline: '2026-11-10', status: 'open',
        pool: { make: 0, miss: 100 }, people: { make: 0, miss: 1 }, mine: false, myStake: null,
    };
    const lib = jest.requireMock('@/lib/market');
    lib.marketFeed.mockResolvedValueOnce([market]);
    lib.placeStake = jest.fn(async () => undefined);
    const screen = render(<MarketSection />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    // Everyone doubts Sam, and the card says so.
    expect(screen.getByText('Very doubted')).toBeTruthy();
    fireEvent.press(screen.getByText('Run a 5k'));
    fireEvent.press(screen.getByLabelText('Makes it, 0%'));
    // 25 on makes it against 100 on misses it: all of their 100 comes to you.
    expect(screen.getByLabelText('Wins 100 Shards')).toBeTruthy();
    // Held like paying (VoiceOver activates it directly), then the receipt.
    await act(async () => { fireEvent(screen.getByLabelText('Hold to bet 25 Shards'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }); });
    expect(lib.placeStake).toHaveBeenCalledWith('m1', 'make', 25);
    expect(screen.getByText('Bet placed')).toBeTruthy();
});

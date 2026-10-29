import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { MarketSection } from '../Market/MarketSection';

jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => { const React = require('react'); React.useEffect(effect, []); } }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
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

it('says how bets work when there are none, and opens a goal from the list', async () => {
    const screen = render(<MarketSection />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('No bets yet')).toBeTruthy();
    expect(screen.getByLabelText('140 Shards to spend')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Open a goal to bets')[0]);
    expect(screen.getByText('Run a half marathon')).toBeTruthy();
    // A goal without a deadline is listed, with why it can't be opened yet.
    expect(screen.getByText('No deadline')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Run a half marathon')); });
    expect(jest.requireMock('@/lib/market').openMarket).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', targetDate: '2026-11-20' }));
});

it('lets you bet your own amount, checked against what you have and the 100 per goal, and says what it pays', async () => {
    const market = {
        id: 'm1', ownerId: 'o', name: 'Sam', goalKey: 'g', title: 'Run a 5k', deadline: '2026-11-10', status: 'open',
        pool: { make: 0, miss: 100 }, people: { make: 0, miss: 1 }, mine: false, myStake: null,
    };
    const lib = jest.requireMock('@/lib/market');
    lib.marketFeed.mockResolvedValueOnce([market]);
    lib.placeStake = jest.fn(async () => undefined);
    const screen = render(<MarketSection />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.press(screen.getByText('Makes it'));
    // 100 on makes it against 100 on misses it: your 100 back plus their 100.
    fireEvent.press(screen.getByLabelText('100 Shards'));
    expect(screen.getByText('200 back · +100')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Another amount'));
    fireEvent.changeText(screen.getByPlaceholderText('1 to 100'), '150');
    expect(screen.getByText('Up to 100 more on this goal.')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('1 to 100'), '40');
    expect(screen.getByText('140 back · +100')).toBeTruthy();
    expect(screen.getByText('Bet 40 Shards')).toBeTruthy();
});

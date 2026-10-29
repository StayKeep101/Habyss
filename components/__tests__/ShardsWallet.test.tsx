import React from 'react';
import { render } from '@testing-library/react-native';
import { ShardsWallet } from '../Shards/ShardsWallet';
import type { Wallet } from '@/hooks/useWallet';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('react-native-screens', () => ({ FullWindowOverlay: ({ children }: { children: React.ReactNode }) => children }));

const wallet: Wallet = {
    balance: 140, inPlay: 25, earned: 65, today: 4,
    timeline: [{ t: Date.now() - 30 * 3600e3, value: 100 }, { t: Date.now() - 2 * 3600e3, value: 120 }, { t: Date.now() - 10 * 60e3, value: 140 }],
    activity: [
        { t: Date.now() - 60e3, date: '2026-10-28', amount: 10, kind: 'complete', item: 'task', title: 'Send proposal' },
        { t: Date.now() - 3600e3, date: '2026-10-27', amount: -25, kind: 'stake', title: 'Run a 5k' },
        { t: Date.now() - 7200e3, date: '2026-10-27', amount: -2, kind: 'miss', item: 'habit', title: 'Read' },
        { t: Date.now() - 9000e3, date: '2026-10-27', amount: 0, kind: 'add', item: 'task', title: 'Plan the week', held: 'limit' },
    ],
};

it('reads like a brokerage account: balance, the period’s change, what is on bets, every transaction', () => {
    const screen = render(<ShardsWallet visible onClose={jest.fn()} wallet={wallet} multiplier={1} perfectRun={0} />);
    expect(screen.getByText('Shards balance')).toBeTruthy();
    expect(screen.getByText('+40 (40.0%)')).toBeTruthy();
    expect(screen.getByText('Past 24 hours')).toBeTruthy();
    // Every range a trading app has, no candles.
    ['1H', '24H', '1W', '1M', '1Y', 'All'].forEach(label => expect(screen.getByText(label)).toBeTruthy());
    expect(screen.getByText('On bets')).toBeTruthy();
    // Transactions as the Marks page listed them: the thing, what happened, the Shards.
    expect(screen.getByText('Send proposal')).toBeTruthy();
    expect(screen.getByText(/^Completed task · /)).toBeTruthy();
    expect(screen.getByText(/^Missed habit · /)).toBeTruthy();
    expect(screen.getByText('−25')).toBeTruthy();
    expect(screen.getByText('−2')).toBeTruthy();
    // Held back by a fair-play rule: listed at 0, saying why.
    expect(screen.getByText('Added task · Daily limit reached')).toBeTruthy();
});

it('says plainly, in its info card, that Shards are a game currency and not money', () => {
    const { fireEvent } = require('@testing-library/react-native');
    const screen = render(<ShardsWallet visible onClose={jest.fn()} wallet={wallet} multiplier={2} perfectRun={8} />);
    fireEvent.press(screen.getByLabelText('How Shards work'));
    expect(screen.getByText('Game currency only')).toBeTruthy();
    expect(screen.getByText(/aren’t real money and have no cash value/)).toBeTruthy();
    expect(screen.getByText('Fair play')).toBeTruthy();
    expect(screen.getByText(/No farming/)).toBeTruthy();
});

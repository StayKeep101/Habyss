import React from 'react';
import { render } from '@testing-library/react-native';
import { ShardsWallet } from '../Shards/ShardsWallet';
import type { Wallet } from '@/hooks/useWallet';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('react-native-screens', () => ({ FullWindowOverlay: ({ children }: { children: React.ReactNode }) => children }));

const wallet: Wallet = {
    balance: 140, inPlay: 25, earned: 65, today: 4, capLeft: 16,
    series: [{ date: '2026-10-26', value: 100 }, { date: '2026-10-27', value: 120 }, { date: '2026-10-28', value: 140 }],
    activity: [
        { key: 'a', date: '2026-10-28', title: 'Earned by doing', detail: 'Habits, tasks and goals done', amount: 4, kind: 'earned' },
        { key: 'b', date: '2026-10-27', title: 'Bet placed', detail: 'Run a 5k', amount: -25, kind: 'stake' },
    ],
};

it('reads like a brokerage account: balance, the period’s change, what is on bets, every transaction', () => {
    const screen = render(<ShardsWallet visible onClose={jest.fn()} wallet={wallet} />);
    expect(screen.getByText('Shards balance')).toBeTruthy();
    expect(screen.getByText('+40 (40.0%)')).toBeTruthy();
    expect(screen.getByText('Past month')).toBeTruthy();
    expect(screen.getByText('On bets')).toBeTruthy();
    expect(screen.getByText('Bet placed')).toBeTruthy();
    expect(screen.getByText('−25')).toBeTruthy();
});

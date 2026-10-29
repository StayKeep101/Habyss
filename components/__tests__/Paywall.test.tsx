import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { HoldButton } from '@/components/ui/HoldButton';
import { Paywall } from '../Paywall/Paywall';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/useAccess', () => ({ useAccess: () => ({ access: { kind: 'ended' }, referral: null }) }));
jest.mock('@/hooks/useGoalInsights', () => ({ useGoalsInsights: () => ({ today: '2026-10-28' }) }));
jest.mock('@/hooks/useMarks', () => ({
    useMarks: () => ({
        ledger: [
            { date: '2026-10-20', item: 'habit', points: 5, kind: 'complete', title: 'Read' },
            { date: '2026-10-21', item: 'habit', points: 5, kind: 'complete', title: 'Read' },
            { date: '2026-10-22', item: 'task', points: 10, kind: 'complete', title: 'Ship it' },
        ],
    }),
}));
jest.mock('@/lib/RevenueCat', () => ({ __esModule: true, default: { getOneOff: jest.fn(async () => null) } }));
jest.mock('@/lib/friendsService', () => ({ getMyUsername: jest.fn(async () => null) }));

describe('hold to commit', () => {
    it('does nothing for a tap, and VoiceOver can confirm it directly', () => {
        const onComplete = jest.fn();
        const screen = render(<HoldButton label="Commit · $9.99" onComplete={onComplete} />);
        const button = screen.getByLabelText('Commit · $9.99');
        fireEvent(button, 'pressIn');
        fireEvent(button, 'pressOut');
        expect(onComplete).not.toHaveBeenCalled();
        fireEvent(button, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
        expect(onComplete).toHaveBeenCalledTimes(1);
    });
});

describe('day 15', () => {
    it('shows what the fourteen days came to, then the price and the hold to commit', async () => {
        const screen = render(<Paywall mode="ended" />);
        await act(async () => { await Promise.resolve(); });
        expect(screen.getByText('Your 14 days are up')).toBeTruthy();
        expect(screen.getByText('Days you showed up')).toBeTruthy();
        expect(screen.getByLabelText('3/14')).toBeTruthy();
        expect(screen.getByText('Unlock Habyss for life')).toBeTruthy();
        expect(screen.getByText('Once. Yours for life. No subscription.')).toBeTruthy();
        expect(screen.getByLabelText('Commit · $9.99')).toBeTruthy();
    });
});

import React from 'react';
import { render } from '@testing-library/react-native';
import { WeekView } from '../Community/WeekView';
import type { CrewWeek } from '@/hooks/useCrewWeek';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => null }));

const week = (over: Partial<CrewWeek> = {}): CrewWeek => ({
    week: { from: '2026-10-26', to: '2026-11-01' },
    mission: { friendId: 'l', friendName: 'Lucas', kind: 'show_up', target: 3, progress: 1, completed: false, ends: '2026-11-01' },
    revealed: [], king: { userId: 'b', name: 'Bea', days: 6, showUps: 14 }, previousKing: null,
    race: [{ userId: 'me', name: 'Me', days: 3, showUps: 6 }, { userId: 'b', name: 'Bea', days: 2, showUps: 5 }],
    challenges: [], fresh: false, dethroned: false, markSeen: jest.fn(), markCrownSeen: jest.fn(), reload: jest.fn(), ...over,
});

it('shows who holds the crown, the race for the next one, and your secret mission', () => {
    const screen = render(<WeekView week={week()} meId="me" />);
    // Bea wears the crown, and is second in this week's race.
    expect(screen.getAllByText('Bea')).toHaveLength(2);
    expect(screen.getByText('Holds the crown · 6 of 7 days last week')).toBeTruthy();
    expect(screen.getByText('This week’s race')).toBeTruthy();
    expect(screen.getByText('Get Lucas to show up on 3 days this week.')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
    // Only the king can set the challenge.
    expect(screen.queryByText('Set this week’s challenge')).toBeNull();
});

it('lets the king set the crew’s challenge', () => {
    const screen = render(<WeekView week={week({ king: { userId: 'me', name: 'Me', days: 7, showUps: 20 } })} meId="me" />);
    expect(screen.getByText('Hold the crown · 7 of 7 days last week')).toBeTruthy();
    expect(screen.getByText('Set this week’s challenge')).toBeTruthy();
});

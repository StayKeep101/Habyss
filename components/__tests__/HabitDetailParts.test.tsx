import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { HabitHero, HabitInsight, StreakFlame, HabitToday, HabitWeek } from '../Habit/HabitDetailParts';
import { habitRecord } from '@/lib/habitRecord';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8' }), useAccent: () => ({ accent: '#00b9e8' }) }));

const record = habitRecord([
    { date: '2026-10-26', completed: true, skipped: false, scheduled: true },
    { date: '2026-10-27', completed: false, skipped: false, scheduled: true },
], '2026-10-27', '2026-10-26');

describe('the habit page', () => {
    it('shows the habit, its week and its numbers', async () => {
        const screen = render(<>
            <HabitHero name="Read" schedule="Daily · 21:00" color="#7aa2ff" weekShare={0.5} goalName="Read 24 books" onGoal={jest.fn()} />
            <StreakFlame streak={record.streak} best={record.best} />
            <HabitWeek week={record.week} color="#7aa2ff" />
            <HabitInsight record={record} />
        </>);
        expect(screen.getByText('Read')).toBeTruthy();
        expect(screen.getByLabelText('Part of the goal Read 24 books. Open it')).toBeTruthy();
        expect(screen.getByLabelText(/^Streak: \d+ days?\. Best: \d+$/)).toBeTruthy();
        expect(screen.getByLabelText(/today, not done yet/)).toBeTruthy();
        await act(async () => {});
    });

    it('marks today done from one big button', async () => {
        const onDone = jest.fn();
        const screen = render(<HabitToday done={false} skipped={false} scheduled color="#7aa2ff" onDone={onDone} onSkip={jest.fn()} onFocus={jest.fn()} />);
        fireEvent.press(screen.getByLabelText('Mark done for today'));
        expect(onDone).toHaveBeenCalled();
        await act(async () => {});
    });
});

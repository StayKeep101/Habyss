import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { CalendarStrip } from '../Home/CalendarStrip';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#7098ff' }) }));
jest.mock('@/hooks/useWeekStart', () => ({ useWeekStart: () => 'monday' }));

const openMonth = (screen: ReturnType<typeof render>) =>
    fireEvent(screen.getByLabelText('Month'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

it('opens the month (by swipe, or VoiceOver), with the month and the small year as the week shows its date, clamping as it moves', async () => {
    const select = jest.fn();
    const screen = render(<CalendarStrip selectedDate={new Date(2026, 0, 31)} onSelectDate={select} />);
    openMonth(screen);
    expect(screen.getByText('January')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy();
    // The week underneath steps back (and out of VoiceOver's way); the month has no weekday labels.
    for (const weekday of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) expect(screen.queryByText(weekday, { includeHiddenElements: false })).toBeNull();
    fireEvent.press(screen.getByLabelText('Next month'));
    expect(select).toHaveBeenCalledWith(new Date(2026, 1, 28));
    await act(async () => {});
});

it('a tap on the title always comes back to today', () => {
    const select = jest.fn();
    const screen = render(<CalendarStrip selectedDate={new Date(2026, 0, 31)} onSelectDate={select} />);
    fireEvent.press(screen.getByLabelText('Saturday, Jan 31, 2026'));
    expect(select).toHaveBeenCalledTimes(1);
    const picked: Date = select.mock.calls[0][0];
    expect(picked.toDateString()).toBe(new Date().toDateString());
});

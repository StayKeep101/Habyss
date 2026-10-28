import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Ascent } from '../Ascent/Ascent';
import { track } from '@/lib/analytics';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/echo', () => ({ saveName: jest.fn(async () => undefined) }));
jest.mock('@/lib/ascent/plan', () => ({ ...jest.requireActual('@/lib/ascent/plan'), commitPlan: jest.fn() }));

/** Lets the line finish typing, then taps Continue. */
const through = (screen: ReturnType<typeof render>) => {
    act(() => { jest.advanceTimersByTime(6000); });
    fireEvent.press(screen.getByLabelText('Continue'));
};

describe('the Ascent, played', () => {
    beforeEach(() => { jest.useFakeTimers(); (track as jest.Mock).mockClear(); });
    afterEach(() => jest.useRealTimers());

    it('meets Echo, takes a name, and goes down answering how they got here', () => {
        const screen = render(<Ascent preview onEnd={jest.fn()} />);
        expect(track).toHaveBeenCalledWith('onboarding_started', { preview: true });
        for (let line = 0; line < 4; line++) through(screen);
        act(() => { jest.advanceTimersByTime(1000); });
        fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Sam');
        fireEvent.press(screen.getByText('Continue'));
        expect(screen.getByLabelText('Nice to meet you, Sam.')).toBeTruthy();
        through(screen);
        expect(track).toHaveBeenCalledWith('eco_introduction_completed');
        through(screen);
        through(screen);
        act(() => { jest.advanceTimersByTime(1000); });
        fireEvent.press(screen.getByLabelText('All the time.'));
        act(() => { jest.advanceTimersByTime(1000); });
        expect(screen.getByLabelText('Yeah. Starting over again and again can be exhausting.')).toBeTruthy();
    });

    it('a first tap shows the whole line, the next moves on', () => {
        const screen = render(<Ascent preview onEnd={jest.fn()} />);
        act(() => { jest.advanceTimersByTime(260); });
        const tapAnywhere = () => fireEvent.press(screen.UNSAFE_root.findAll(node => node.props.onPress && node.props.accessible === false)[0]);
        tapAnywhere();
        expect(screen.getByLabelText('Oh. Hey.')).toBeTruthy();
        tapAnywhere();
        expect(screen.getByLabelText('Didn’t think I’d find someone else down here.')).toBeTruthy();
    });

    it('can be left at any point, and says where', () => {
        const onEnd = jest.fn();
        const screen = render(<Ascent preview onEnd={onEnd} />);
        fireEvent.press(screen.getByLabelText('Close preview'));
        expect(track).toHaveBeenCalledWith('onboarding_skipped', { scene: 'first-light' });
        expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ how: 'skipped' }));
    });
});

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { GoalCompleteSequence } from '../Celebrations/GoalCompleteSequence';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('@/hooks/useSounds', () => ({ useSounds: () => ({ playLevelUp: jest.fn() }) }));
jest.mock('react-native-screens', () => ({ FullWindowOverlay: ({ children }: { children: React.ReactNode }) => children }));

describe('the goal-reached ceremony', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('plays to rest by itself, then says what happened and offers the way back', () => {
        const screen = render(<GoalCompleteSequence goal={{ name: 'Read 24 books', color: '#6B8AF5', count: 3 }} onDone={jest.fn()} />);
        expect(screen.queryByText('Take it in')).toBeNull();
        act(() => { jest.advanceTimersByTime(4000); });
        expect(screen.getByText('Read 24 books')).toBeTruthy();
        expect(screen.getByText('Take it in')).toBeTruthy();
    });

    it('jumps straight to the end on a tap anywhere', () => {
        const screen = render(<GoalCompleteSequence goal={{ name: 'Run 10 km', color: '#6B8AF5' }} onDone={jest.fn()} />);
        act(() => { jest.advanceTimersByTime(200); });
        fireEvent.press(screen.UNSAFE_root.findAll(node => node.props.onPress && node.props.accessible === false)[0]);
        expect(screen.getByText('Run 10 km')).toBeTruthy();
        expect(screen.getByText('Take it in')).toBeTruthy();
    });
});

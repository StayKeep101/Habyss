import React from 'react';
import { act, render } from '@testing-library/react-native';
import { EchoLine } from '../Home/EchoLine';

jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5' }) }));
jest.useFakeTimers();

describe('Echo’s line, written out smoothly', () => {
    it('writes the sentence out letter by letter and ends as the sentence', () => {
        const onDone = jest.fn();
        const screen = render(<EchoLine text="Do it now." onDone={onDone} />);
        // VoiceOver always has the real sentence.
        expect(screen.getByLabelText('Do it now.')).toBeTruthy();
        act(() => { jest.advanceTimersByTime(10_000); });
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(screen.getAllByText('Do it now.').length).toBeGreaterThan(0);
    });
});

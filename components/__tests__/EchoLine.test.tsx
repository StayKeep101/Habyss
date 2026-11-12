import React from 'react';
import { act, render } from '@testing-library/react-native';
import { EchoLine, runeAt } from '../Home/EchoLine';

jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5' }) }));
jest.useFakeTimers();

describe('Echo’s line, revealed like an old inscription', () => {
    it('starts as runes, keeping spaces and punctuation, and ends as the sentence', () => {
        const onDone = jest.fn();
        const screen = render(<EchoLine text="Do it now." onDone={onDone} />);
        // VoiceOver always has the real sentence.
        expect(screen.getByLabelText('Do it now.')).toBeTruthy();
        act(() => { jest.advanceTimersByTime(10_000); });
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(screen.getAllByText('Do it now.').length).toBeGreaterThan(0);
    });
    it('picks a rune per letter that holds for a beat, then changes', () => {
        expect(runeAt(3, 1)).toBe(runeAt(3, 1));
        expect('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ').toContain(runeAt(7, 2));
    });
});

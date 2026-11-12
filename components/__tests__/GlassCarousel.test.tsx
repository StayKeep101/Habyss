import React from 'react';
import { act, render } from '@testing-library/react-native';
import { GlassCarousel } from '../Home/GlassCarousel';
import { emit } from '@/lib/appEvents';

jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5' }) }));

describe('every hourglass you can earn', () => {
    it('opens on yours, and says what the next one costs', () => {
        const screen = render(<GlassCarousel />);
        expect(screen.queryByText('Hourglasses')).toBeNull();
        act(() => { emit('glass_open', { rank: 'Lost', marks: 144 }); });
        expect(screen.getByText('Hourglasses')).toBeTruthy();
        expect(screen.getByText('Yours now')).toBeTruthy();
        expect(screen.getByText('Lost')).toBeTruthy();
    });
});

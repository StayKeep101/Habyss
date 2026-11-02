import React from 'react';
import { render } from '@testing-library/react-native';
import { Stage } from '../Ascent/Stage';
import { awakeAt } from '../Ascent/Explainers';
import type { StageId } from '@/lib/ascent/story';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5' }) }));

const answers = { wake: '07:00', sleep: '23:00', phone: 'two_four', age: 'age_18', skill: 'guitar' } as const;
const say = (stage: StageId) => render(<Stage stage={stage} answers={answers} mood="idle" speaking={false} color="#6B8AF5" label="In the dark." />);

describe('what Echo becomes', () => {
    it('is itself, labelled with the scene', () => {
        expect(say('echo').getByLabelText('In the dark.')).toBeTruthy();
    });

    it('becomes each explainer, each saying what it shows', () => {
        expect(say('clock').getByLabelText('A 24-hour day: 16 hours awake, 8 asleep.')).toBeTruthy();
        expect(say('lifetime').getByLabelText('7.4 years on a screen, of the 59 years until 80.')).toBeTruthy();
        expect(say('trade').getByLabelText(/45 hours over 90 days\. Scrolling: nothing kept\. Guitar: Play your first real songs\./)).toBeTruthy();
        expect(say('motivation').getByLabelText('Motivation spikes, then fades.')).toBeTruthy();
        expect(say('discipline').getByLabelText(/Discipline rises steadily/)).toBeTruthy();
        expect(say('compound').getByLabelText(/37\.8 times/)).toBeTruthy();
    });

    it('counts a day that runs past midnight', () => {
        expect(awakeAt(23, '09:00', '01:00')).toBe(true);
        expect(awakeAt(3, '09:00', '01:00')).toBe(false);
    });
});

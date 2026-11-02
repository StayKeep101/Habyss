import React from 'react';
import { render } from '@testing-library/react-native';
import { Stage } from '../Ascent/Stage';
import { awakeAt } from '../Ascent/Explainers';
import type { StageId } from '@/lib/ascent/story';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5' }) }));

const answers = { wake: '07:00', sleep: '23:00', phone: 'h4', age: 19, skill: 'guitar' } as const;
const say = (stage: StageId, step = 0) => render(<Stage stage={stage} step={step} answers={answers} mood="idle" speaking={false} color="#6B8AF5" label="In the dark." />);

describe('what Echo becomes', () => {
    it('is itself, labelled with the scene', () => {
        expect(say('echo').getByLabelText('In the dark.')).toBeTruthy();
    });

    it('becomes each explainer, built step by step, each saying what it shows', () => {
        expect(say('clock').getByLabelText('A day: 24 hours.')).toBeTruthy();
        expect(say('clock', 1).getByLabelText('Everyone gets the same 24 hours: you, me, a billionaire.')).toBeTruthy();
        expect(say('clock', 2).getByLabelText('Your day: 16 hours awake, 8 asleep.')).toBeTruthy();
        expect(say('cost').getByLabelText('4 hours times 365 days times 19 years equals 27,740 hours.')).toBeTruthy();
        expect(say('cost', 1).getByLabelText('27,740 hours is 1,156 days, which is 3.17 years.')).toBeTruthy();
        expect(say('cost', 2).getByLabelText('3.17 years, as cubes.')).toBeTruthy();
        expect(say('cost', 3).getByLabelText('A life of 90 years, one cube each. 19 lived.')).toBeTruthy();
        expect(say('cost', 4).getByLabelText('A life of 90 years: 19 lived, 11.8 more on a screen at this pace.')).toBeTruthy();
        expect(say('trade', 2).getByLabelText(/45 hours\. Scrolling: nothing kept\. Guitar: Play your first real songs\./)).toBeTruthy();
        expect(say('motivation').getByLabelText('Motivation spikes, then fades.')).toBeTruthy();
        expect(say('motivation', 1).getByLabelText(/Discipline rises steadily/)).toBeTruthy();
        expect(say('compound', 1).getByLabelText(/37\.8 times/)).toBeTruthy();
    });

    it('counts a day that runs past midnight', () => {
        expect(awakeAt(23, '09:00', '01:00')).toBe(true);
        expect(awakeAt(3, '09:00', '01:00')).toBe(false);
    });
});

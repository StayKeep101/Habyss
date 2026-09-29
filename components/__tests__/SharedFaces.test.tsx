import React from 'react';
import { render } from '@testing-library/react-native';
import { SharedFaces } from '../Common/SharedFaces';
import { sharedState, type Participant } from '@/lib/shared';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

const person = (over: Partial<Participant>): Participant =>
    ({ userId: 'u', username: 'sam', done: false, isYou: false, ...over });

const you = (done: boolean) => person({ userId: 'me', username: 'you', isYou: true, done });

describe('the faces on a shared row', () => {
    it('says nothing when nobody else is on it', () => {
        // A card announcing that a habit is yours alone is noise on every screen.
        expect(render(<SharedFaces people={[you(true)]} tint="#6B8AF5" />).toJSON()).toBeNull();
    });

    it('draws everyone who has access, and says how many are done', () => {
        const screen = render(
            <SharedFaces people={[you(true), person({ userId: 'them', done: false })]} tint="#6B8AF5" />,
        );
        expect(screen.getByLabelText('1 of 2 done')).toBeTruthy();
    });

    it('counts the rest rather than overflowing the row', () => {
        const many = [you(true), ...Array.from({ length: 6 }, (_, index) =>
            person({ userId: `u${index}`, username: `friend${index}` }))];
        const screen = render(<SharedFaces people={many} tint="#6B8AF5" />);
        expect(screen.getByText('+3')).toBeTruthy();
        expect(screen.getByLabelText('1 of 7 done')).toBeTruthy();
    });
});

describe('what a shared row claims', () => {
    it('is not finished until everybody has finished', () => {
        // The rule the user asked for twice: sharing a habit means it is not
        // done until all of them have done it.
        expect(sharedState([you(true), person({ userId: 'them' })]).complete).toBe(false);
        expect(sharedState([you(true), person({ userId: 'them', done: true })]).complete).toBe(true);
    });

    it('names who is still holding it up', () => {
        expect(sharedState([you(true), person({ userId: 'them', username: 'sam' })]).line).toBe('Waiting on sam');
        expect(sharedState([you(false), person({ userId: 'them', done: true })]).waitingOnYou).toBe(true);
    });
});

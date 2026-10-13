import React from 'react';
import { render } from '@testing-library/react-native';
import { MeasureBadge, PriorityFlag, ReminderBadge, BadgeRow } from '../Common/CardBadges';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

describe('what a row admits without being opened', () => {
    it('says nothing when no reminder is set', () => {
        expect(render(<ReminderBadge on={false} />).toJSON()).toBeNull();
    });

    it('shows a bell once one is', () => {
        expect(render(<ReminderBadge on />).toJSON()).not.toBeNull();
    });

    it('spells a measurement out rather than showing a bare number', () => {
        expect(render(<MeasureBadge value={2} unit="books" />).getByText('2 books')).toBeTruthy();
    });

    it('does not pluralise a single one', () => {
        // "1 books" reads as a bug.
        expect(render(<MeasureBadge value={1} unit="books" />).getByText('1 book')).toBeTruthy();
    });

    it('stays out of the way when there is nothing to measure', () => {
        expect(render(<MeasureBadge value={0} unit="books" />).toJSON()).toBeNull();
        expect(render(<MeasureBadge unit="books" />).toJSON()).toBeNull();
    });

    it('marks urgent with two exclamation marks, read instantly in any language', () => {
        expect(render(<PriorityFlag priority={1} />).getByText('!!')).toBeTruthy();
    });

    it('says nothing for a normal task, because normal is the default', () => {
        // Once urgent and low are marked, the absence of a mark is the answer.
        expect(render(<PriorityFlag priority={2} />).toJSON()).toBeNull();
    });

    it('marks a low one quietly rather than loudly', () => {
        const screen = render(<PriorityFlag priority={3} />);
        expect(screen.toJSON()).not.toBeNull();
        expect(screen.queryByText('!!')).toBeNull();
    });

    it('disappears entirely when a row has no badges at all', () => {
        const screen = render(
            <BadgeRow>
                <ReminderBadge on={false} />
                <MeasureBadge value={0} />
            </BadgeRow>,
        );
        // The children render nothing, so the row must not add its own spacing.
        expect(screen.toJSON()).not.toBeNull();
    });
});

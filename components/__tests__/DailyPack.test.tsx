import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DailyPack } from '../Community/DailyPack';
import { PackCard } from '../Community/PackCard';
import type { FeedPost } from '@/lib/feedService';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', colors: ['#3B82F6', '#8B5CF6'] }), useAccent: () => ({ accent: '#00b9e8' }) }));

const post = (userId: string, done: number, total: number): FeedPost => ({
    userId, day: '2026-10-27', postedAt: '', name: `${userId} Smith`, username: userId, ackCount: 0, ackedByMe: false, ackUsers: [], mine: false,
    card: { habitsDone: done, habitsTotal: total, tasksDone: 0, tasksTotal: 0, streak: 4, habits: [{ name: 'Run', done: true }] },
});

describe("today's pack", () => {
    it('says who is in it and opens', async () => {
        const onOpen = jest.fn();
        const screen = render(<DailyPack posts={[post('milo', 1, 2), post('ana', 2, 2), post('sam', 0, 1)]} opened={0} onOpen={onOpen} />);
        fireEvent.press(screen.getByLabelText(/Today's pack\. 3 cards · milo, ana and 1 more/));
        expect(onOpen).toHaveBeenCalled();
        await act(async () => {});
    });

    it('waits quietly with no cards', async () => {
        const screen = render(<DailyPack posts={[]} opened={0} onOpen={jest.fn()} />);
        expect(screen.getByText("Your friends' cards arrive at the times they choose")).toBeTruthy();
        await act(async () => {});
    });

    it('draws a perfect day as the rare card', async () => {
        const screen = render(<PackCard post={post('ana', 2, 2)} width={300} height={420} />);
        expect(screen.getByText('Perfect day')).toBeTruthy();
        expect(screen.getByText('100%')).toBeTruthy();
        await act(async () => {});
    });
});

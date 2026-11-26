// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Today, TodayItem } from '../today/today';
import { PlannedList } from './PlannedList';

const item = (id: string, over: Partial<TodayItem> = {}): TodayItem => ({ id, kind: 'task', title: id, done: false, skipped: false, start: 540, end: 630, state: 'later', locked: false, ...over });
const day = (items: TodayItem[]): Today => ({ day: '2026-11-26', items, current: null, next: null, done: 0, total: 0, tasksDone: 0, tasksTotal: 0, listedDone: 0, listedTotal: 0, streak: 0, signedIn: true, window: { wake: 480, sleep: 1410 } });
afterEach(cleanup);

describe('PlannedList', () => {
  const items = [item('Old', { due: '2026-11-24' }), item('Finish BA Assignment 3', { deadline: '2026-12-04' }), item('Polish', { priority: 1 }), item('Trade', { kind: 'habit', start: 700, end: 730 }), item('lunch', { kind: 'meal', fixed: true })];

  it('lists tasks, then habits, like the phone, without meals or events', () => {
    render(<PlannedList day={day(items)} onToggle={() => {}} onSeeAll={() => {}} />);
    const sections = screen.getAllByRole('region');
    expect(sections.map(s => s.getAttribute('aria-label'))).toEqual(['Tasks', 'Habits']);
    expect(within(sections[1]).getByText('Trade')).toBeTruthy();
    expect(screen.queryByText('lunch')).toBeNull();
  });

  it('says Overdue in red, Today otherwise, with each task\'s length and due date', () => {
    render(<PlannedList day={day(items)} onToggle={() => {}} onSeeAll={() => {}} />);
    const row = (name: string) => screen.getByRole('listitem', { name });
    expect(within(row('Old')).getByText('Overdue')).toBeTruthy();
    expect(within(row('Finish BA Assignment 3')).getByText('Today')).toBeTruthy();
    expect(within(row('Finish BA Assignment 3')).getByText('Due Fri 4')).toBeTruthy();
    expect(within(row('Finish BA Assignment 3')).getByText('1 h 30 min')).toBeTruthy();
    expect(within(row('Polish')).getByText('Urgent')).toBeTruthy();
  });

  it('ticks from the checkbox and opens everything from See all', () => {
    const onToggle = vi.fn(), onSeeAll = vi.fn();
    render(<PlannedList day={day(items)} onToggle={onToggle} onSeeAll={onSeeAll} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Polish' }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'Polish' }), true, 1);
    fireEvent.click(within(screen.getByRole('region', { name: 'Tasks' })).getByRole('button', { name: 'See all' }));
    expect(onSeeAll).toHaveBeenCalled();
  });
});

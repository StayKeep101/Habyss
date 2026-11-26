// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Today, TodayItem } from '../today/today';
import { makeAxis } from './axis';
import { PlannedTimeline } from './PlannedTimeline';

const item = (id: string, over: Partial<TodayItem> = {}): TodayItem => ({ id, kind: 'habit', title: id, done: false, skipped: false, start: 540, end: 570, state: 'later', locked: false, ...over });
const day = (items: TodayItem[]): Today => ({ day: '2026-11-26', items, current: null, next: null, done: 0, total: 0, tasksDone: 0, tasksTotal: 0, listedDone: 0, listedTotal: 0, streak: 0, signedIn: true, window: { wake: 480, sleep: 1410 } });
const axis = makeAxis(480, 1410);
afterEach(cleanup);

describe('PlannedTimeline', () => {
  it('makes an item as tall as it is long, on the shared axis', () => {
    render(<PlannedTimeline day={day([item('Study', { kind: 'task', start: 600, end: 690 })])} axis={axis} now={null} amountFor={() => null} onToggle={() => {}} />);
    const row = screen.getByRole('listitem', { name: /Study/ });
    expect(row.style.height).toBe('144px');
    expect(row.style.top).toBe(`${axis.y(600)}px`);
  });

  it('shows Urgent and Hard as the phone does', () => {
    render(<PlannedTimeline day={day([item('Send 50 Applications', { kind: 'task', priority: 1, difficulty: 3 })])} axis={axis} now={null} amountFor={() => null} onToggle={() => {}} />);
    expect(screen.getByText('Urgent')).toBeTruthy();
    expect(screen.getByText('Hard')).toBeTruthy();
  });

  it('asks how much for an amount habit, and saves it', () => {
    const onToggle = vi.fn();
    render(<PlannedTimeline day={day([item('Read')])} axis={axis} now={null} amountFor={i => (i.id === 'Read' ? { unit: 'pages', target: 30 } : null)} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Read done' }));
    const field = screen.getByRole('spinbutton', { name: 'Pages of Read' });
    fireEvent.change(field, { target: { value: '12' } });
    fireEvent.submit(field.closest('form')!);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'Read' }), true, 12);
  });

  it('ticks a yes/no item at once, and has no check for meals and events', () => {
    const onToggle = vi.fn();
    render(<PlannedTimeline day={day([item('Run'), item('meal:lunch', { kind: 'meal', title: 'Lunch', fixed: true, start: 720, end: 750 })])} axis={axis} now={null} amountFor={() => null} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Run done' }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'Run' }), true, 1);
    expect(screen.queryByRole('button', { name: 'Mark Lunch done' })).toBeNull();
  });

  it('strikes a done item through, and offers to undo it', () => {
    render(<PlannedTimeline day={day([item('Ship', { kind: 'task', done: true, state: 'done' })])} axis={axis} now={null} amountFor={() => null} onToggle={() => {}} />);
    expect(screen.getByText('Ship').style.textDecoration).toBe('line-through');
    expect(screen.getByRole('button', { name: 'Mark Ship not done' })).toBeTruthy();
  });

  it('shows the live clock on the item that is on now', () => {
    const now = new Date('2026-11-26T09:05:09').getTime();
    render(<PlannedTimeline day={day([item('Shower', { state: 'now' })])} axis={axis} now={now} amountFor={() => null} onToggle={() => {}} />);
    expect(screen.getByText('09:05:09')).toBeTruthy();
    expect(screen.getByText('Now')).toBeTruthy();
  });
});

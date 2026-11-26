// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Interval } from '../types';
import type { TodayItem } from '../today/today';
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false, invoke: () => Promise.resolve(null) }));
import { makeAxis } from './axis';
import { TrackedTimeline } from './TrackedTimeline';

const T0 = new Date('2026-11-26T09:00:00').getTime(), M = 60_000;
const iv = (name: string, start: number, end: number, over: Partial<Interval> = {}): Interval => ({ id: `${name}${start}`, application_id: null, bundle_id: `b.${name}`, name, title: null, start: T0 + start, end: T0 + end, state: 'active', category: 'writing', availability: 'available', pid: 1, window_id: null, url: null, domain: null, document: null, typing_ms: 0, pointer_ms: 0, meeting_ms: 0, media_ms: 0, ...over });
const task: TodayItem = { id: 'adm', kind: 'task', title: 'ADM2302', done: false, skipped: false, start: 9 * 60, end: 10 * 60, state: 'later', locked: false };
const axis = makeAxis(480, 1410);
afterEach(cleanup);

describe('TrackedTimeline', () => {
  const intervals = [iv('Word', 0, 40 * M, { title: 'BA Assignment 3', typing_ms: 31 * M }), iv('Chrome', 50 * M, 62 * M, { domain: 'youtube.com', category: 'entertainment' })];

  it('draws a block per stretch, at its time, with its title and length', () => {
    render(<TrackedTimeline intervals={intervals} axis={axis} day="2026-11-26" items={[task]} classes={{ entertainment: 'unproductive' }} now={null} />);
    const word = screen.getByRole('button', { name: /BA Assignment 3/ });
    expect(word.style.top).toBe(`${axis.y(9 * 60)}px`);
    expect(word.textContent).toContain('40m');
    expect(screen.getByRole('button', { name: /youtube\.com/ }).className).toContain('unproductive');
  });

  it('opens the detail card on focus, with what matters', () => {
    render(<TrackedTimeline intervals={intervals} axis={axis} day="2026-11-26" items={[task]} classes={{}} now={null} />);
    fireEvent.focus(screen.getByRole('button', { name: /BA Assignment 3/ }));
    const card = screen.getByRole('tooltip');
    expect(card.textContent).toContain('9:00 AM – 9:40 AM');
    expect(card.textContent).toContain('Matched: ADM2302');
    expect(card.textContent).toContain('Typing 31m');
    expect(card.textContent).toContain('Longest stretch 40m');
  });

  it('is empty when nothing was tracked that day', () => {
    render(<TrackedTimeline intervals={[]} axis={axis} day="2026-11-26" items={[]} classes={{}} now={null} />);
    expect(screen.getByText('Fills in as you use your Mac')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuickAdd } from './QuickAdd';

afterEach(cleanup);
const setup = () => {
  const run = vi.fn(async () => true), onSaved = vi.fn();
  render(<QuickAdd date="2026-11-26" apps={[{ name: 'Word', bundle: 'com.microsoft.Word' }]} run={run} onSaved={onSaved} />);
  return { run, onSaved };
};

describe('QuickAdd', () => {
  it('adds a task on the shown day', async () => {
    const { run, onSaved } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Task' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Task' }), { target: { value: 'Email Prof' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith('cloud_save', { table: 'tasks', row: expect.objectContaining({ title: 'Email Prof', due_date: '2026-11-26', status: 'open', estimated_minutes: 90, priority: 2 }) });
  });

  it('adds a habit with its time and length', async () => {
    const { run } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Habit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Habit' }), { target: { value: 'Stretch' } });
    fireEvent.change(screen.getByLabelText('At'), { target: { value: '07:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add habit' }));
    await waitFor(() => expect(run).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith('cloud_save', { table: 'habits', row: expect.objectContaining({ name: 'Stretch', start_time: '07:30', duration_minutes: 30, start_date: '2026-11-26', frequency: 'daily' }) });
  });

  it('logs time by hand on the shown day', async () => {
    const { run } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Log time' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'What' }), { target: { value: 'Reading on paper' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '14:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    await waitFor(() => expect(run).toHaveBeenCalled());
    const start = new Date('2026-11-26T14:00:00').getTime();
    expect(run).toHaveBeenCalledWith('log_time', { name: 'Reading on paper', bundle: null, start, end: start + 30 * 60_000, note: null });
  });

  it('will not log an end before its start', () => {
    const { run } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Log time' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'What' }), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '15:00' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '14:00' } });
    expect((screen.getByRole('button', { name: 'Log' }) as HTMLButtonElement).disabled).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { TaskFormModal } from '../Tasks/TaskFormModal';
import { createTask, updateTask, type Task } from '@/lib/tasks';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('@/lib/onDeviceAI', () => ({ isOnDeviceAIReady: () => false, currentEngine: () => null }));
jest.mock('@/lib/habitsSQLite', () => ({ getGoals: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/tasks', () => ({ createTask: jest.fn().mockResolvedValue({ id: 't1' }), updateTask: jest.fn().mockResolvedValue(undefined) }));

const saved = { id: 't1', title: 'Call tomorrow', dueDate: '2026-09-24', dueTime: '00:00', priority: 2 } as Task;
beforeEach(() => jest.clearAllMocks());

it('opens the calendar directly and saves the selected date', async () => {
    const screen = render(<TaskFormModal visible task={saved} />);
    fireEvent.press(screen.getByLabelText(/^Do on,/));
    expect(screen.getByTestId('goal-calendar')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Choose 2026-09-25'));
    await act(async () => { fireEvent.press(screen.getByText('Save changes')); });
    expect(updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ title: saved.title, dueDate: '2026-09-25' }));
});

it('preserves midnight when editing', async () => {
    // 00:00 is falsy in every obvious check, which is how it used to become
    // 08:00 on the way to the wheel.
    const screen = render(<TaskFormModal visible task={saved} />);
    fireEvent.press(screen.getByLabelText('Time, 00:00'));
    // The wheel is on screen the moment the row opens, not behind "Pick a time".
    const hour = within(screen.getByTestId('start-hour')).getAllByRole('radio').find(row => row.props.accessibilityState?.selected);
    expect(hour?.props.accessibilityLabel).toBe('00');
    await act(async () => { fireEvent.press(screen.getByText('Save changes')); });
    expect(updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ dueTime: '00:00' }));
});

it('puts the date shortcuts under the calendar, and offers no "No date"', async () => {
    const screen = render(<TaskFormModal visible task={saved} />);
    fireEvent.press(screen.getByLabelText(/^Do on,/));
    for (const label of ['Today', 'Tomorrow', 'Next week']) {
        expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('No date')).toBeNull();
    await act(async () => {});
});

it('highlights recognized details inside the input', async () => {
    const screen = render(<TaskFormModal visible />);
    const input = screen.getByLabelText('Describe the task');
    fireEvent.changeText(input, 'Call tomorrow at 2pm');
    expect(within(input).getByText('tomorrow').props.style.color).toBe('#00b9e8');
    expect(within(input).getByText('at 2pm').props.style.color).toBe('#00b9e8');
    await act(async () => {});
});

it('does not save the old title after the user clears it', async () => {
    const screen = render(<TaskFormModal visible task={saved} />);
    fireEvent.changeText(screen.getByLabelText('Describe the task'), '');
    await act(async () => { fireEvent.press(screen.getByText('Save changes')); });
    expect(updateTask).not.toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();
});

it('keeps the draft open after a failed save and allows retry', async () => {
    (createTask as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
    const onClose = jest.fn();
    const screen = render(<TaskFormModal visible onClose={onClose} />);
    fireEvent.changeText(screen.getByLabelText('Describe the task'), 'Buy tea');
    await act(async () => { fireEvent.press(screen.getByText('Add task')); });
    expect(screen.getByText(/Could not save that task/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByText('Add task')); });
    expect(onClose).toHaveBeenCalledTimes(1);
});

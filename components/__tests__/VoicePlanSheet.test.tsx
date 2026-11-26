import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { VoicePlanSheet } from '../Create/VoicePlanSheet';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));

const heard = [
    { kind: 'task' as const, text: 'Call the bank tomorrow' },
    { kind: 'habit' as const, text: 'Running every morning' },
    { kind: 'habit' as const, text: 'Read 12 books this year' },
];

it('shows each thing heard as what it is, lets you say otherwise or take it out, and adds the rest', () => {
    const onAdd = jest.fn();
    const screen = render(<VoicePlanSheet items={heard} onAdd={onAdd} onKeep={jest.fn()} />);
    expect(screen.getByText('Here’s what I heard')).toBeTruthy();
    expect(screen.getByText('Add all 3')).toBeTruthy();
    // The last one was really a task.
    fireEvent.press(screen.getAllByLabelText('Task')[2]);
    fireEvent.press(screen.getByLabelText('Take out Running every morning'));
    fireEvent.press(screen.getByText('Add 2 tasks'));
    expect(onAdd).toHaveBeenCalledWith([
        { kind: 'task', text: 'Call the bank tomorrow' },
        { kind: 'task', text: 'Read 12 books this year' },
    ]);
});

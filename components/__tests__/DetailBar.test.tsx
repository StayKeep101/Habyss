import React from 'react';
import { Keyboard, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { DetailBar, type DetailItem } from '../Create/DetailBar';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

const items: DetailItem[] = [
    { id: 'repeat', icon: 'repeat', label: 'Repeat', value: 'Weekdays', content: <Text>day picker</Text> },
    { id: 'time', icon: 'time-outline', label: 'Time', content: <Text>time picker</Text> },
    { id: 'look', icon: 'color-palette-outline', label: 'Look', content: <Text>colours</Text> },
];

const flatten = (style: any): Record<string, any> =>
    Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style ?? {});

const panelOf = (screen: ReturnType<typeof render>) =>
    flatten(screen.UNSAFE_getByProps({ accessibilityLabel: 'Close Repeat' }).parent?.parent?.props.style);

describe('the bar above the keyboard', () => {
    it('reads as the setting when it is empty, and as the value once it has one', () => {
        const screen = render(<DetailBar items={items} open={null} onToggle={jest.fn()} accent="#6B8AF5" />);
        // Set: says what it is set to. Unset: says what it is.
        expect(screen.getByText('Weekdays')).toBeTruthy();
        expect(screen.getByText('Time')).toBeTruthy();
        expect(screen.queryByText('Repeat')).toBeNull();
    });

    it('opens the one that was tapped, and closes it when tapped again', () => {
        const onToggle = jest.fn();
        const screen = render(<DetailBar items={items} open={null} onToggle={onToggle} accent="#6B8AF5" />);
        fireEvent.press(screen.getByLabelText('Time'));
        expect(onToggle).toHaveBeenCalledWith('time');

        const open = render(<DetailBar items={items} open="time" onToggle={onToggle} accent="#6B8AF5" />);
        fireEvent.press(open.getByLabelText('Time'));
        expect(onToggle).toHaveBeenLastCalledWith(null);
    });

    it('puts the keyboard away, because the panel is for picking and not typing', () => {
        const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
        const screen = render(<DetailBar items={items} open={null} onToggle={jest.fn()} accent="#6B8AF5" />);
        fireEvent.press(screen.getByLabelText('Time'));
        expect(dismiss).toHaveBeenCalled();
        dismiss.mockRestore();
    });

    it('shows the open setting, and only that one', () => {
        const screen = render(<DetailBar items={items} open="repeat" onToggle={jest.fn()} accent="#6B8AF5" />);
        expect(screen.getByText('day picker')).toBeTruthy();
        expect(screen.queryByText('time picker')).toBeNull();
        expect(screen.queryByText('colours')).toBeNull();
    });

    it('gives every setting the same panel, so the bar has one open position', () => {
        // This is what stops the bar bouncing: whatever is tapped, and whatever
        // is then chosen inside it, the panel is exactly as tall.
        const repeat = render(<DetailBar items={items} open="repeat" onToggle={jest.fn()} accent="#6B8AF5" />);
        const height = panelOf(repeat).height;
        expect(height).toBeGreaterThan(0);

        for (const id of ['time', 'look']) {
            const screen = render(<DetailBar items={items} open={id} onToggle={jest.fn()} accent="#6B8AF5" />);
            const label = id === 'time' ? 'Close Time' : 'Close Look';
            const style = flatten(screen.UNSAFE_getByProps({ accessibilityLabel: label }).parent?.parent?.props.style);
            expect(style.height).toBe(height);
        }
    });

    it('is closed flat when nothing is open', () => {
        const screen = render(<DetailBar items={items} open={null} onToggle={jest.fn()} accent="#6B8AF5" />);
        // Nothing to close, and no content taking up room.
        expect(screen.queryByText('day picker')).toBeNull();
        expect(screen.queryByLabelText('Close Repeat')).toBeNull();
    });

    it('keeps working when the settings on offer change', () => {
        // A goal gains a "Counts from" chip once the user has habits; the bar
        // must not care that the list it was given is a different length.
        const screen = render(<DetailBar items={items} open="look" onToggle={jest.fn()} accent="#6B8AF5" />);
        expect(screen.getByText('colours')).toBeTruthy();

        screen.rerender(<DetailBar items={items.slice(0, 2)} open="look" onToggle={jest.fn()} accent="#6B8AF5" />);
        // The setting is gone, so the panel closes rather than sitting open
        // and empty, and nothing throws.
        expect(screen.queryByText('colours')).toBeNull();
        expect(screen.queryByLabelText('Close Look')).toBeNull();
        expect(screen.getByText('Weekdays')).toBeTruthy();
    });
    it('sizes goal panels to their content and uses the chosen Look color', () => {
        const custom = [{ id: 'look', icon: 'rocket-outline' as const, color: '#EC4899', label: 'Look', content: <Text>Compact look controls</Text> }];
        const screen = render(<DetailBar fitContent items={custom} open="look" onToggle={jest.fn()} accent="#6B8AF5" />);
        expect(flatten(screen.getByTestId('detail-panel').props.style).height).toBeUndefined();
        expect(screen.getByLabelText('Look')).toHaveStyle({ borderColor: '#EC4899' });
        screen.rerender(<DetailBar fitContent items={custom} open={null} onToggle={jest.fn()} accent="#6B8AF5" />);
        expect(screen.queryByText('Compact look controls')).toBeNull();
    });

});

describe('a chip that has a lot to say', () => {
    it('is not capped, so a long rule is not cut off mid-word', () => {
        // "Every 2 months on the third Sunday" is useless as "Every 2 mont…".
        const rule = 'Every 2 months on the third Sunday';
        const long: DetailItem[] = [{ id: 'repeat', icon: 'repeat', label: 'Repeat', value: rule, content: <Text>panel</Text> }];
        const screen = render(<DetailBar items={long} open={null} onToggle={jest.fn()} accent="#6B8AF5" />);
        expect(screen.getByText(rule)).toBeTruthy();

        const chip = flatten(screen.getByLabelText(`Repeat, ${rule}`).props.style);
        expect(chip.maxWidth).toBeUndefined();
    });
});

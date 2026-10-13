import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ViewSwitcher, type SwitcherOption } from '../Common/ViewSwitcher';
import { surfaceFor } from '@/theme/designSystem';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));

type View3 = 'today' | 'stats' | 'music';
const options: SwitcherOption<View3>[] = [
    { id: 'today', label: 'Today', icon: 'today-outline' },
    { id: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
    { id: 'music', label: 'Music', icon: 'musical-notes-outline' },
];

describe('the view switcher', () => {
    it('shows every view at once, so you can see where you are', () => {
        const screen = render(<ViewSwitcher options={options} value="today" onChange={jest.fn()} accent="#6B8AF5" />);
        for (const label of ['Today', 'Stats', 'Music']) expect(screen.getByText(label)).toBeTruthy();
    });

    it('marks the one you are on, and only that one', () => {
        const screen = render(<ViewSwitcher options={options} value="stats" onChange={jest.fn()} accent="#6B8AF5" />);
        expect(screen.getByLabelText('Stats').props.accessibilityState).toMatchObject({ selected: true });
        expect(screen.getByLabelText('Today').props.accessibilityState).toMatchObject({ selected: false });
    });

    it('reports the view that was chosen', () => {
        const onChange = jest.fn();
        const screen = render(<ViewSwitcher options={options} value="today" onChange={onChange} accent="#6B8AF5" />);
        fireEvent.press(screen.getByText('Music'));
        expect(onChange).toHaveBeenCalledWith('music');
    });

    it('is a sealed surface, not a window onto the page behind it', () => {
        // A control that floats over a scrolling page has to stay readable
        // while the page moves under it.
        const screen = render(<ViewSwitcher options={options} value="today" onChange={jest.fn()} accent="#6B8AF5" />);
        // getByRole has no mapping for 'tablist', so it is found by the prop.
        const bar = screen.UNSAFE_getByProps({ accessibilityRole: 'tablist' });
        const background = StyleSheetFlatten(bar.props.style).backgroundColor as string;
        // The matte fill for a dark theme, read from the tokens rather than
        // pinned to a hex, so retuning the palette is not a failing test.
        expect(background).toBe(surfaceFor('dark').fill);
        expect(background).not.toMatch(/rgba|transparent/);
    });
});

/** The style prop arrives as a nested array; this is the last word for each key. */
function StyleSheetFlatten(style: any): Record<string, unknown> {
    if (Array.isArray(style)) return Object.assign({}, ...style.map(StyleSheetFlatten));
    return style ?? {};
}

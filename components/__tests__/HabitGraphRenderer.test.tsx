import React from 'react';
import { render } from '@testing-library/react-native';
import { Line, Path, Rect } from 'react-native-svg';
import { HabitGraphRenderer } from '../Habit/HabitGraphRenderer';

jest.mock('@/constants/themeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('@/constants/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#00b9e8', foreground: '#00b9e8' }) }));

const day = (index: number, over: Partial<{ completed: boolean; skipped: boolean; scheduled: boolean; value: number }> = {}) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    completed: true,
    ...over,
});

const chart = (style: string, data: ReturnType<typeof day>[], goalValue = 1) =>
    render(
        <HabitGraphRenderer
            graphStyle={style}
            color="#00b9e8"
            goalValue={goalValue}
            unit="times"
            completionData={data}
            currentStreak={3}
        />,
    );

/** Only the stroked lines — the gradient fills are drawn as Paths too. */
const strokedPaths = (screen: ReturnType<typeof render>) =>
    screen.UNSAFE_getAllByType(Path).filter(node => node.props.stroke && node.props.stroke !== 'none');

describe('a day the habit was never due', () => {
    it('breaks the line instead of drawing a crash to zero', () => {
        // Due Mon–Wed and Fri–Sun; Thursday is simply not a training day.
        const data = [0, 1, 2, 3, 4, 5, 6].map(i => day(i, i === 3 ? { completed: false, scheduled: false } : {}));
        const broken = strokedPaths(chart('line', data));

        // Two runs on either side of the gap, so two separate strokes.
        expect(broken).toHaveLength(2);
    });

    it('draws one unbroken line when every day was due', () => {
        const data = [0, 1, 2, 3, 4, 5, 6].map(i => day(i));
        expect(strokedPaths(chart('line', data))).toHaveLength(1);
    });

    it('does not let a day off drag the trend down', () => {
        const every = [0, 1, 2, 3, 4, 5, 6].map(i => day(i, { value: 10 }));
        const withDayOff = every.map((each, i) => (i === 3 ? { ...each, completed: false, scheduled: false, value: 0 } : each));

        // The plotted points either side keep the same height, because the
        // ceiling is set only by days that asked something of you.
        const heights = (data: typeof every) =>
            strokedPaths(chart('line', data, 10))
                .flatMap(node => String(node.props.d).match(/\d+(\.\d+)?(?= )/g) ?? []);

        expect(heights(withDayOff).length).toBeGreaterThan(0);
        expect(chart('line', withDayOff)).toBeTruthy();
    });
});

describe('the bar chart', () => {
    // The colours the bars are drawn from, named here so the assertions below
    // read as what they mean rather than as a wall of rgba.
    const TRACK = 'rgba(255,255,255,0.045)';
    const OFF = '#8B9AB0';

    it('gives every column a track, so an empty week still reads as a chart', () => {
        // Seven missed days used to be seven two-pixel slivers at eight percent
        // opacity, which looked like the card had failed to load.
        const data = [0, 1, 2, 3, 4, 5, 6].map(i => day(i, { completed: false }));
        const screen = chart('bar', data);
        const tracks = screen.UNSAFE_getAllByType(Rect).filter(node => node.props.fill === TRACK);
        expect(tracks).toHaveLength(7);
    });

    it('shows a day off as a marked slot rather than a zero bar', () => {
        const data = [0, 1, 2, 3, 4, 5, 6].map(i => day(i, i === 3 ? { completed: false, scheduled: false } : {}));
        const rects = chart('bar', data).UNSAFE_getAllByType(Rect);

        // The six days that were kept are drawn from the gradient; the day off
        // is not one of them, and is marked in its own right instead.
        expect(rects.filter(node => String(node.props.fill).startsWith('url('))).toHaveLength(6);
        expect(rects.filter(node => node.props.fill === OFF)).toHaveLength(1);
    });

    it('draws the goal line so a bar can be read against something', () => {
        const data = [0, 1, 2].map(i => day(i, { value: 5 }));
        const screen = chart('bar', data, 8);
        // Rendered inside the SVG, so it is found by type rather than by text.
        const dashed = screen.UNSAFE_getAllByType(Line).filter(node => node.props.strokeDasharray === '4 4');
        expect(dashed).toHaveLength(1);
    });
});

describe('two charts on one screen', () => {
    it('gives each its own gradient, so they cannot fight over one id', () => {
        // SVG defs are document-global; a shared id made the second chart
        // inherit the first one's fill.
        const data = [0, 1, 2].map(i => day(i));
        const first = chart('bar', data);
        const second = chart('bar', data);
        const idOf = (screen: ReturnType<typeof render>) =>
            screen.UNSAFE_getAllByType(Rect).map(node => node.props.fill).find(fill => String(fill).startsWith('url('));

        expect(idOf(first)).toBeTruthy();
        expect(idOf(first)).not.toBe(idOf(second));
    });
});

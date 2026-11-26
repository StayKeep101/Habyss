// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Donut, IconButton, ProgressBar, Segmented, Tag, donutArcs } from './index';

afterEach(cleanup);

describe('donutArcs', () => {
  it('splits 1,1,2 into 25%, 25% and 50% of a full circle', () => {
    const r = 40, c = 2 * Math.PI * r;
    const arcs = donutArcs([1, 1, 2], r);
    expect(arcs).toHaveLength(3);
    expect(arcs.map(a => (a.end - a.start) / c)).toEqual([0.25, 0.25, 0.5].map(x => expect.closeTo(x, 6)));
    expect(arcs[0].start).toBe(0);
    expect(arcs[2].end).toBeCloseTo(c, 6);
    expect(arcs[1].start).toBeCloseTo(arcs[0].end, 6);
  });
  it('gives nothing for empty or all-zero input', () => {
    expect(donutArcs([], 40)).toEqual([]);
    expect(donutArcs([0, 0], 40)).toEqual([]);
  });
  it('Donut then shows only the centre text', () => {
    const { container } = render(<Donut slices={[{ label: 'a', value: 0 }]} center="–" />);
    expect(screen.getByText('–')).toBeTruthy();
    expect(container.querySelectorAll('circle[data-slice]')).toHaveLength(0);
  });
  it('Donut draws one arc per non-empty slice', () => {
    const { container } = render(<Donut slices={[{ label: 'a', value: 1 }, { label: 'b', value: 3 }]} center="6h" caption="Total" />);
    expect(container.querySelectorAll('circle[data-slice]')).toHaveLength(2);
    expect(screen.getByText('Total')).toBeTruthy();
  });
});

describe('ProgressBar', () => {
  it('clamps to 0..100 and sets aria-valuenow', () => {
    const { rerender } = render(<ProgressBar value={-5} label="x" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    rerender(<ProgressBar value={140} label="x" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('Segmented', () => {
  it('calls onChange and marks the selected option', () => {
    const onChange = vi.fn();
    render(<Segmented options={['Today', 'Week']} value="Today" onChange={onChange} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Today' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Week' }).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('tab', { name: 'Week' }));
    expect(onChange).toHaveBeenCalledWith('Week');
  });
});

describe('Tag', () => {
  it('shows Productive for productive', () => {
    render(<Tag tone="productive" />);
    expect(screen.getByText('Productive')).toBeTruthy();
  });
});

describe('IconButton', () => {
  it('requires a label at the type level and is found by role and name', () => {
    // @ts-expect-error label is required
    render(<IconButton icon="add" onClick={() => {}} />);
    cleanup();
    render(<IconButton icon="add" label="Add habit" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add habit' })).toBeTruthy();
  });
});

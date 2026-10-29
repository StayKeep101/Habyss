import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Ascent } from '../Ascent/Ascent';
import { track } from '@/lib/analytics';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5', foreground: '#6B8AF5', buttonColors: ['#6B8AF5', '#6B8AF5'] }) }));
jest.mock('@/context/AppSettingsContext', () => ({ useAppSettings: () => ({ setAIPersonality: jest.fn(), setNotificationsEnabled: jest.fn(async () => undefined) }) }));
jest.mock('@/lib/notificationService', () => ({ NotificationService: { requestPermissions: jest.fn(async () => true), refreshReminders: jest.fn(async () => undefined) } }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/echo', () => ({ saveName: jest.fn(async () => undefined) }));
jest.mock('@/lib/ascent/plan', () => ({ ...jest.requireActual('@/lib/ascent/plan'), commitPlan: jest.fn() }));

/** Lets the line finish typing, then taps anywhere. */
const through = (screen: ReturnType<typeof render>) => {
    act(() => { jest.advanceTimersByTime(6000); });
    fireEvent.press(screen.UNSAFE_root.findAll(node => node.props.onPress && node.props.accessible === false)[0]);
};

describe('the Ascent, played', () => {
    beforeEach(() => { jest.useFakeTimers(); (track as jest.Mock).mockClear(); });
    afterEach(() => jest.useRealTimers());

    it('meets Echo, takes a name, and goes down answering how they got here', () => {
        const screen = render(<Ascent preview onEnd={jest.fn()} />);
        expect(track).toHaveBeenCalledWith('onboarding_started', { preview: true });
        for (let line = 0; line < 2; line++) through(screen);
        act(() => { jest.advanceTimersByTime(1000); });
        fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Sam');
        fireEvent.press(screen.getByText('Continue'));
        expect(screen.getByLabelText('Sam. Good to meet you.')).toBeTruthy();
        through(screen);
        expect(track).toHaveBeenCalledWith('eco_introduction_completed');
        through(screen);
        act(() => { jest.advanceTimersByTime(1000); });
        fireEvent.press(screen.getByLabelText('All the time'));
        act(() => { jest.advanceTimersByTime(1000); });
        expect(screen.getByLabelText('Most people have. It’s rarely willpower. It’s the plan.')).toBeTruthy();
        // No arrow under a line: tapping moves on.
        expect(screen.queryByLabelText('Continue')).toBeNull();
    });

    it('a first tap shows the whole line, the next moves on', () => {
        const screen = render(<Ascent preview onEnd={jest.fn()} />);
        act(() => { jest.advanceTimersByTime(260); });
        const tapAnywhere = () => fireEvent.press(screen.UNSAFE_root.findAll(node => node.props.onPress && node.props.accessible === false)[0]);
        tapAnywhere();
        expect(screen.getByLabelText('Hey. I’m Echo.')).toBeTruthy();
        tapAnywhere();
        expect(screen.getByLabelText('What should I call you?')).toBeTruthy();
    });

    it('can be left at any point, and says where', () => {
        const onEnd = jest.fn();
        const screen = render(<Ascent preview onEnd={onEnd} />);
        fireEvent.press(screen.getByLabelText('Close preview'));
        expect(track).toHaveBeenCalledWith('onboarding_skipped', { scene: 'first-light' });
        expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ how: 'skipped' }));
    });
});

describe('the new answers', () => {
    const { MultiList, DayAnswer, BuildList } = jest.requireActual('../Ascent/Answers');

    it('takes several of what they juggle, and only goes on with at least one', () => {
        const onDone = jest.fn();
        const screen = render(<MultiList color="#6B8AF5" onDone={onDone} options={[{ id: 'job', label: 'A job' }, { id: 'school', label: 'School or uni' }]} />);
        fireEvent.press(screen.getByText('Continue'));
        expect(onDone).not.toHaveBeenCalled();
        fireEvent.press(screen.getByText('A job'));
        fireEvent.press(screen.getByText('School or uni'));
        fireEvent.press(screen.getByText('Continue'));
        expect(onDone).toHaveBeenCalledWith(['job', 'school']);
    });

    it('offers the day their rhythm suggests, to keep or change', () => {
        const onDone = jest.fn();
        const screen = render(<DayAnswer wake="06:00" sleep="22:00" color="#6B8AF5" onDone={onDone} />);
        expect(screen.getByText('Wake up')).toBeTruthy();
        fireEvent.press(screen.getByText('Continue'));
        expect(onDone).toHaveBeenCalledWith({ wake: '06:00', sleep: '22:00' });
    });

    it('shows Echo being built from what they said', () => {
        const screen = render(<BuildList color="#6B8AF5" parts={[{ icon: 'sunny', text: 'Your day: 6:00 AM to 10:00 PM' }, { icon: 'chatbubble-ellipses', text: 'My voice: Friendly' }]} />);
        expect(screen.getByText('My voice: Friendly')).toBeTruthy();
    });
});

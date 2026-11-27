import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppButton, AppTextField, Badge, ChartCard, Divider, EmptyState, HabitRow, ProgressRing, StatTile, Text, Toggle, VoidCard } from '../ui';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#8BADD6', foreground: '#8BADD6', buttonColors: ['#8BADD6', '#5B7FB8'] }) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

describe('the component library', () => {
    it('draws text, cards, badges, stats and rings from tokens, and counts figures up', async () => {
        const screen = render(<VoidCard>
            <Text variant="title">Goals</Text>
            <Badge label="On track" tone="success" dot />
            <StatTile value="62%" label="Done" />
            <ProgressRing progress={0.5} label="50%" />
            <Divider />
            <EmptyState icon="flag-outline" title="No goals. Bold strategy." />
            <ChartCard value="62%" caption="done overall" series={[]} />
        </VoidCard>);
        expect(screen.getByText('Goals')).toBeTruthy();
        expect(screen.getByText('On track')).toBeTruthy();
        // Figures count up from zero, then settle on the real value.
        await waitFor(() => expect(screen.getAllByText('62%')).toHaveLength(2), { timeout: 4000 });
    });

    it('presses buttons, flips toggles and ticks rows', () => {
        const press = jest.fn(); const flip = jest.fn(); const tick = jest.fn();
        const screen = render(<>
            <AppButton label="Save" onPress={press} />
            <Toggle label="Morning" value={false} onChange={flip} />
            <HabitRow title="Read" done={false} onToggle={tick} />
            <AppTextField label="Name" value="" onChangeText={() => undefined} />
        </>);
        fireEvent.press(screen.getByLabelText('Save'));
        fireEvent.press(screen.getByLabelText('Morning'));
        fireEvent.press(screen.getByLabelText('Complete Read'));
        expect(press).toHaveBeenCalled();
        expect(flip).toHaveBeenCalledWith(true);
        expect(tick).toHaveBeenCalled();
    });
});

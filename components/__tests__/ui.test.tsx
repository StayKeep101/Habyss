import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Badge, Button, Card, ChartCard, Divider, EmptyState, HabitRow, Input, ProgressRing, StatTile, Text, Toggle } from '../ui';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#8BADD6', foreground: '#8BADD6' }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

describe('the component library', () => {
    it('draws text, cards, badges, stats and rings from tokens', () => {
        const screen = render(<Card>
            <Text variant="title">Goals</Text>
            <Badge label="On track" tone="success" dot />
            <StatTile value="62%" label="Done" />
            <ProgressRing progress={0.5} label="50%" />
            <Divider />
            <EmptyState icon="flag-outline" title="No goals yet" />
            <ChartCard value="62%" caption="done overall" series={[]} />
        </Card>);
        expect(screen.getByText('Goals')).toBeTruthy();
        expect(screen.getByText('On track')).toBeTruthy();
        expect(screen.getAllByText('62%')).toHaveLength(2);
    });

    it('presses buttons, flips toggles and ticks rows', () => {
        const press = jest.fn(); const flip = jest.fn(); const tick = jest.fn();
        const screen = render(<>
            <Button label="Save" onPress={press} />
            <Toggle label="Morning" value={false} onChange={flip} />
            <HabitRow title="Read" done={false} onToggle={tick} />
            <Input label="Name" value="" onChangeText={() => undefined} />
        </>);
        fireEvent.press(screen.getByLabelText('Save'));
        fireEvent.press(screen.getByLabelText('Morning'));
        fireEvent.press(screen.getByLabelText('Complete Read'));
        expect(press).toHaveBeenCalled();
        expect(flip).toHaveBeenCalledWith(true);
        expect(tick).toHaveBeenCalled();
    });
});

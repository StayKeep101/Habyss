import React from 'react';
import { render } from '@testing-library/react-native';
import { SettingsGroup, SettingsRow, SettingsSearch } from '@/components/ui/SettingsList';

jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'abyss' }) }));
jest.mock('@/context/AccentContext', () => ({ useAccentGradient: () => ({ primary: '#6B8AF5' }) }));

const page = (query: string) => render(
    <SettingsSearch value={query}>
        <SettingsGroup title="Your day">
            <SettingsRow icon="shuffle" color="#30D158" label="Auto-reschedule" toggle onToggle={jest.fn()} />
            <SettingsRow icon="calendar" color="#64D2FF" label="Week starts" keywords="monday sunday" />
        </SettingsGroup>
        <SettingsGroup title="Focus">
            <SettingsRow icon="timer" color="#FF375F" label="Clock style" />
        </SettingsGroup>
    </SettingsSearch>,
);

describe('the settings search', () => {
    it('shows only the rows that match, and hides groups with none', () => {
        const screen = page('monday');
        expect(screen.getByText('Week starts')).toBeTruthy();
        expect(screen.queryByText('Auto-reschedule')).toBeNull();
        expect(screen.queryByText('Focus')).toBeNull();
    });
    it('keeps a whole group whose title matches, and everything with no search', () => {
        expect(page('focus').getByText('Clock style')).toBeTruthy();
        expect(page('').getByText('Auto-reschedule')).toBeTruthy();
    });
});

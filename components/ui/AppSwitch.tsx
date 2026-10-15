import React from 'react';
import { Switch, type SwitchProps } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';
import { surfaceFor } from '@/theme/designSystem';
import { useAccentGradient } from '@/context/AccentContext';

/**
 * The one switch in the app: the system's own, so it moves and sounds the way
 * iOS does, in the app's colours. Every on/off row uses this; colours passed
 * in are ignored so no screen can draw a switch of its own.
 */
export function AppSwitch({ trackColor: _ignored, thumbColor: _thumb, ios_backgroundColor: _bg, ...props }: SwitchProps) {
    const { theme } = useTheme();
    const { primary } = useAccentGradient();
    const off = surfaceFor(theme).raised;
    return (
        <Switch
            {...props}
            trackColor={{ false: off, true: primary }}
            ios_backgroundColor={off}
            thumbColor={Colors.common.white}
        />
    );
}

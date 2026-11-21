import React, { useEffect, useState } from 'react';
import { requireNativeComponent, UIManager, View, type ViewStyle } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import SharedDefaults from '@/lib/SharedDefaults';
import { useTokens } from '@/hooks/useTokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { surfaceFor } from '@/theme/designSystem';
import { ScreenTimeService, screenTimeAllowedBefore } from '@/lib/ScreenTimeService';
import type { WeekStart } from '@/lib/weekStart';

type NativeProps = { days: number; offset: number; weekStart: number; style?: ViewStyle };

/**
 * Screen time, the Focus page's other side: the daily average, what it costs
 * over a year, a bar per day and the top apps. Drawn by the report extension
 * (ios/ScreenTimeReport): iOS lets only it see app usage, so the numbers stay
 * there and never reach Habyss. Needs the build that has it, and Screen Time
 * allowed.
 */
/**
 * The report extension is out of the build until its Apple app ID has the
 * Family Controls capability (ios/remove_report_target.rb, ios/add_report_target.rb):
 * without it the view would draw nothing, so it stays off.
 */
const REPORT_IN_BUILD = true;

const NativeReport = REPORT_IN_BUILD && UIManager.hasViewManagerConfig?.('ScreenTimeReportView')
    ? requireNativeComponent<NativeProps>('ScreenTimeReportView')
    : null;

const FILL = { flex: 1 } as const;

export const screenTimeReportSupported = (): boolean => !!NativeReport;

/** Fills what it is given (flex 1): the report scrolls inside itself (iOS draws it in its own process). */
export function ScreenTimeReport({ days, offset, weekStart }: { days: 7 | 30; offset: number; weekStart: WeekStart }) {
    const [allowed, setAllowed] = useState<boolean | null>(null);
    const t = useTokens();
    const { theme } = useTheme();
    const { primary } = useAccentGradient();
    // The report draws in the app's own colours: handed over through the App Group as they change.
    useEffect(() => {
        const tone = surfaceFor(theme);
        void SharedDefaults.set('habyss_report_theme', JSON.stringify({
            text: t.color.textPrimary, muted: t.color.textMuted, subtle: t.color.textSubtle, border: t.color.border,
            accent: primary, cardTop: tone.top, cardFill: tone.fill, cardBottom: tone.bottom,
        })).catch(() => false);
    }, [t, theme, primary]);
    useEffect(() => {
        // Start from what this phone already allowed, then confirm with iOS (it can be slow to say just after launch).
        void screenTimeAllowedBefore().then(before => { if (before) setAllowed(current => current ?? true); });
        void ScreenTimeService.isAuthorized().then(setAllowed).catch(() => setAllowed(false));
    }, []);

    if (!NativeReport) {
        return <EmptyState icon="phone-portrait-outline" title="Screen time is on its way" message="Where your hours go, app by app, arrives in a coming update." />;
    }
    if (allowed === false) {
        return (
            <EmptyState icon="phone-portrait-outline" title="Where your hours actually go" message="Allow Screen Time and Habyss shows your phone time, day by day, app by app. It stays on this iPhone."
                actionLabel="Allow Screen Time" onAction={() => void ScreenTimeService.requestAuthorization().then(setAllowed)} />
        );
    }
    if (allowed === null) return <View style={FILL} />;
    return <NativeReport days={days} offset={offset} weekStart={weekStart === 'sunday' ? 0 : 1} style={FILL} />;
}

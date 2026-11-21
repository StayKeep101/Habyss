import { NativeModules, Platform } from 'react-native';

/**
 * The day's starts said by the Screen Time monitor (NowGuide in
 * ios/Gate/GateShared.swift), one at a time under one name, so each new one
 * replaces the last in Notification Center, even with Habyss closed. Needs
 * the build with it (1.0.8) and Screen Time allowed; otherwise they are
 * ordinary notifications, tidied when Habyss opens (lib/dayGuideTidy.ts).
 */
export interface GuideMoment {
    /** Seconds since 1970. */
    at: number;
    title: string;
    body: string;
    category: string | null;
    sound: string | null;
    data: Record<string, string>;
}

const native = (): any => (Platform.OS === 'ios' ? NativeModules.ScreenTimeModule : null);

export async function nowGuideReady(): Promise<boolean> {
    if (typeof native()?.setNowPlan !== 'function') return false;
    try {
        const { ScreenTimeService } = require('./ScreenTimeService') as typeof import('./ScreenTimeService');
        return await ScreenTimeService.isAuthorized();
    } catch { return false; }
}

export function setNowPlan(moments: GuideMoment[]): void {
    try { native()?.setNowPlan(JSON.stringify(moments.filter(moment => moment.at * 1000 > Date.now()).sort((a, b) => a.at - b.at))); } catch { /* ordinary notifications stand */ }
}

// The shared module, one source for the phone and the Mac (packages/core/src/healthMetrics.ts). Change it there.
// Reading Apple Health is the phone's own part, here.
import { readingUnit, type HealthMetric } from '@habyss/core/healthMetrics';

export * from '@habyss/core/healthMetrics';

/**
 * Today's number from Health, or null when it cannot be had.
 *
 * Null rather than zero, and the difference matters: zero is "you have not
 * moved today", null is "Health did not answer", and only one of those should
 * ever be written over what somebody logged by hand.
 */
export async function readHealth(metric: HealthMetric, date = new Date(), unit?: string | null): Promise<number | null> {
    try {
        const { HealthKitService } = require('./HealthKitService') as typeof import('./HealthKitService');
        if (!HealthKitService.isAvailable) return null;
        if (!await HealthKitService.init()) return null;
        // A workout in the habit's terms: minutes, km, or how many sessions.
        const value = await HealthKitService.read(metric, date, readingUnit(metric, unit));
        return value === null || !Number.isFinite(value) ? null : Math.max(0, Math.round(value * 100) / 100);
    } catch {
        return null;
    }
}

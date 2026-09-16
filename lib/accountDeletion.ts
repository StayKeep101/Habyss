import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { closeDatabase, getDatabase } from './database';
import { SecureTokenService } from './secureStorage';
import SharedDefaults from './SharedDefaults';
import { resetLocalUserCache } from './localUser';

/**
 * Account deletion.
 *
 * Habyss stores everything on the device: habits and completions in SQLite,
 * settings and the local user id in AsyncStorage, integration tokens in the
 * keychain, and a small summary in the App Group container that the widget,
 * Live Activity and Watch app read. There is no server-side account — the app
 * ships without a Supabase client and never signs a user in — so deleting an
 * account means removing all of that local state.
 *
 * Every step is attempted even if an earlier one fails, and the result says
 * which succeeded, so the UI can report the truth instead of a blanket
 * "deleted". Apple requires deletion to actually work when it is offered.
 */

const DATABASE_NAME = 'habyss.db';

/** Keys mirrored into the App Group for the widget, Live Activity and Watch app. */
const SHARED_DEFAULT_KEYS = [
    'activeHabitName',
    'habitsData',
    'timerEndDate',
    'todayStats',
    'widgetSummary',
];

/** Integrations that may have left OAuth tokens in the keychain. */
const TOKEN_SERVICES = ['spotify', 'strava', 'garmin', 'plaid'];

export interface DeletionStep {
    key: string;
    label: string;
    ok: boolean;
    detail?: string;
}

export interface DeletionReport {
    steps: DeletionStep[];
    /** True only when every step succeeded. */
    ok: boolean;
    failed: DeletionStep[];
}

const run = async (key: string, label: string, work: () => Promise<void>): Promise<DeletionStep> => {
    try {
        await work();
        return { key, label, ok: true };
    } catch (error: any) {
        return { key, label, ok: false, detail: String(error?.message ?? error) };
    }
};

export async function deleteAllLocalData(): Promise<DeletionReport> {
    const steps: DeletionStep[] = [];

    // Detach the purchase identity first so a fresh install is not handed the
    // previous anonymous id. The purchase itself belongs to the Apple ID and is
    // deliberately untouched; only Apple can remove that.
    steps.push(await run('purchases', 'Purchase session', async () => {
        // require rather than a dynamic import: the same pattern the app already
        // uses for these modules, and it keeps this path exercisable in tests.
        const RevenueCat = require('./RevenueCat').default;
        await RevenueCat.logOut();
    }));

    // Reclaims roughly a gigabyte if the on-device model was downloaded.
    steps.push(await run('aiModel', 'On-device AI model', async () => {
        const LocalLLM = require('./LocalLLMService').default;
        await LocalLLM.deleteModel();
    }));

    // Otherwise the widget and Watch app keep showing the deleted user's habits.
    steps.push(await run('shared', 'Widget and Watch data', async () => {
        for (const key of SHARED_DEFAULT_KEYS) {
            await SharedDefaults.remove(key);
        }
        if (typeof SharedDefaults.reloadTimelines === 'function') {
            await SharedDefaults.reloadTimelines();
        }
    }));

    steps.push(await run('database', 'Habits and history', async () => {
        // Empty every table first. sqlite_master is used rather than a hardcoded
        // list so tables left by older versions are cleared too, and so the user's
        // data is gone even if the file itself cannot be removed.
        let clearedRows = false;
        try {
            const db = await getDatabase();
            if (db) {
                const tables: { name: string }[] = await db.getAllAsync(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                );
                for (const table of tables) {
                    await db.execAsync(`DELETE FROM "${table.name}";`);
                }
            }
            clearedRows = true;
        } catch {
            // Fall through: removing the file below also removes the data.
        }

        // Close the cached handle; deleting an open database fails on iOS.
        await closeDatabase();
        try {
            await SQLite.deleteDatabaseAsync(DATABASE_NAME);
        } catch (error) {
            // Only a real failure if the rows are still there.
            if (!clearedRows) throw error;
        }
    }));

    steps.push(await run('tokens', 'Connected accounts', async () => {
        for (const service of TOKEN_SERVICES) {
            await SecureTokenService.clearServiceTokens(service);
        }
    }));

    // Last: this holds the local user id and onboarding flag that earlier steps
    // may need in order to find what they are clearing.
    steps.push(await run('settings', 'Profile and settings', async () => {
        await AsyncStorage.clear();
        resetLocalUserCache();
    }));

    const failed = steps.filter(step => !step.ok);
    return { steps, ok: failed.length === 0, failed };
}

/**
 * Restarts the app so no deleted state survives in memory.
 *
 * Contexts, cached habits and the user id all live in module or component state
 * that clearing storage does not touch. Returns false when a reload is not
 * possible, so the caller can navigate instead.
 */
export async function restartAfterDeletion(): Promise<boolean> {
    try {
        const Updates = require('expo-updates');
        await Updates.reloadAsync();
        return true;
    } catch {
        return false;
    }
}

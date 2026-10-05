import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from './habitsSQLite';

/**
 * A goal's cover photo: kept on the phone so it is there the instant the goal
 * opens, and on the goal itself so everyone sharing the goal sees it.
 *
 * Why it used to vanish and come back. The picker hands over a file in the
 * app's *cache*, which iOS empties whenever it likes, and the app stored that
 * full path — which also changes every time the app is reinstalled or updated,
 * because the container's folder name does. So the picture was there, then
 * not, then (from a still-warm image cache) there again. It also loaded from
 * storage after the screen had drawn, flashing the app icon first.
 *
 * Now the picture is copied into the documents folder, which iOS never clears,
 * and stored by its name *inside* that folder, so a new container path does not
 * matter. The last answer is kept in memory, so reopening a goal draws it on the
 * first frame. And the uploaded URL rides in `goal_spec.cover`, which already
 * syncs, so a friend's new cover replaces yours the next time either of you
 * syncs — no new column, no new table.
 */

const DIR = 'goal-covers/';
const recordKey = (goalId: string) => `goal_bg_${goalId}`;

interface CoverRecord {
    /** Path inside the documents folder, or a legacy absolute uri. */
    file: string | null;
    /** The shared URL this file is a copy of; null until it has been uploaded. */
    src: string | null;
}

/** The last uri drawn for each goal, so the next open needs no wait. */
const memory = new Map<string, string | null>();

const fs = () => {
    try {
        return require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    } catch {
        return null;
    }
};

const absolute = (file: string): string | null => {
    if (!file.startsWith(DIR)) return file;
    const root = fs()?.documentDirectory;
    return root ? root + file : null;
};

async function exists(uri: string | null): Promise<boolean> {
    if (!uri) return false;
    if (/^https?:/.test(uri)) return true;
    try {
        return !!(await fs()?.getInfoAsync(uri))?.exists;
    } catch {
        return false;
    }
}

async function readRecord(goalId: string): Promise<CoverRecord> {
    try {
        const raw = await AsyncStorage.getItem(recordKey(goalId));
        if (!raw) return { file: null, src: null };
        // Older builds stored a bare uri here.
        if (!raw.startsWith('{')) return { file: raw, src: null };
        const parsed = JSON.parse(raw);
        return { file: parsed.file ?? null, src: parsed.src ?? null };
    } catch {
        return { file: null, src: null };
    }
}

async function writeRecord(goalId: string, record: CoverRecord): Promise<void> {
    try { await AsyncStorage.setItem(recordKey(goalId), JSON.stringify(record)); } catch { /* cache only */ }
}

/** The shared cover URL on the goal, if anybody has set one. */
export function coverUrlOf(goal: Pick<Habit, 'goalSpec'> | null | undefined): string | null {
    try {
        const url = goal?.goalSpec ? JSON.parse(goal.goalSpec)?.cover : null;
        return typeof url === 'string' && /^https?:/.test(url) ? url : null;
    } catch {
        return null;
    }
}

/** What to draw right now, without waiting: undefined means not known yet. */
export function cachedCover(goalId: string): string | null | undefined {
    return memory.get(goalId);
}

/** Copies a picture into the documents folder and returns its stored name. */
async function keep(goalId: string, uri: string): Promise<string | null> {
    const files = fs();
    if (!files?.documentDirectory) return null;
    try {
        await files.makeDirectoryAsync(files.documentDirectory + DIR, { intermediates: true }).catch(() => undefined);
        const name = `${DIR}${goalId}-${Date.now()}.jpg`;
        if (/^https?:/.test(uri)) await files.downloadAsync(uri, files.documentDirectory + name);
        else await files.copyAsync({ from: uri, to: files.documentDirectory + name });
        return name;
    } catch {
        return null;
    }
}

async function forget(file: string | null): Promise<void> {
    const uri = file ? absolute(file) : null;
    if (!uri || !file?.startsWith(DIR)) return;
    try { await fs()?.deleteAsync(uri, { idempotent: true }); } catch { /* best effort */ }
}

/**
 * The cover to draw for this goal.
 *
 * A shared URL newer than the copy on this phone wins — somebody else on the
 * goal changed it — and is copied down for next time.
 */
export async function resolveCover(goal: Pick<Habit, 'id' | 'goalSpec'>): Promise<string | null> {
    const record = await readRecord(goal.id);
    const remote = coverUrlOf(goal);
    const local = record.file ? absolute(record.file) : null;
    const haveLocal = await exists(local);

    let answer: string | null;
    if (remote && remote !== record.src) {
        answer = remote;
        void keep(goal.id, remote).then(async file => {
            if (!file) return;
            await forget(record.file);
            await writeRecord(goal.id, { file, src: remote });
        });
    } else if (haveLocal) {
        answer = local;
        // A cover from before this lived somewhere iOS may clear; move it.
        if (record.file && !record.file.startsWith(DIR)) {
            void keep(goal.id, record.file).then(file => { if (file) void writeRecord(goal.id, { file, src: record.src }); });
        }
    } else {
        answer = remote;
    }
    memory.set(goal.id, answer);
    return answer;
}

/**
 * Sets a new cover from a picked photo.
 *
 * Shown at once from the kept copy; the upload follows, and the goal is saved
 * with the URL so it reaches everyone on it. Returns the uri to draw.
 */
export async function setGoalCover(goal: Pick<Habit, 'id' | 'goalSpec'>, pickedUri: string): Promise<string> {
    const previous = await readRecord(goal.id);
    const file = await keep(goal.id, pickedUri);
    const shown = (file && absolute(file)) || pickedUri;
    memory.set(goal.id, shown);
    await writeRecord(goal.id, { file: file ?? pickedUri, src: null });
    if (file) void forget(previous.file);

    void (async () => {
        const { uploadPicture } = require('./profileSync') as typeof import('./profileSync');
        const url = await uploadPicture(shown, `goal-${goal.id}-${Date.now()}`).catch(() => null);
        if (!url) return;
        await writeRecord(goal.id, { file: file ?? pickedUri, src: url });
        const { getHabits, updateHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        // The freshest spec, not the one this screen opened with.
        const latest = (await getHabits().catch(() => [])).find(item => item.id === goal.id) ?? goal;
        let spec: Record<string, unknown> = {};
        try { spec = latest.goalSpec ? JSON.parse(latest.goalSpec) : {}; } catch { spec = {}; }
        await updateHabit({ id: goal.id, goalSpec: JSON.stringify({ ...spec, cover: url }) }).catch(() => undefined);
    })();

    return shown;
}

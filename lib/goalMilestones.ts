import { generateId, getDatabase, isSQLiteAvailable, nowISO } from './database';
import { getLocalUserId } from './localUser';
import { emit } from './appEvents';

/**
 * A goal's milestones: the checkpoints between today and the goal's end
 * that keep it on track. "Read 24 books by December 31" might be Book 1 by
 * Nov 2, Book 2 by Nov 9, … Each has a day it is due and is reached with a
 * tick. They belong to the goal only: never on the timeline, in a task list
 * or in the day's count. Backed up with everything else (goal_milestones).
 */
export interface Milestone {
    id: string;
    goalId: string;
    title: string;
    /** YYYY-MM-DD it should be reached by, if it has one. */
    dueDate?: string;
    /** When it was reached; absent while still ahead. */
    doneAt?: string;
    position: number;
}

export type MilestoneState = 'done' | 'next' | 'late' | 'ahead';

const rowToMilestone = (row: any): Milestone => ({
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    dueDate: row.due_date ?? undefined,
    doneAt: row.done_at ?? undefined,
    position: row.position ?? 0,
});

/** Due first (no date last), then the order they were made in. */
export function sortMilestones(list: Milestone[]): Milestone[] {
    return [...list].sort((a, b) =>
        (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') || a.position - b.position);
}

/**
 * Where each one stands today: reached, the next one to reach, overdue, or
 * further ahead. Only one is "next": the earliest not yet reached and not late.
 */
export function milestoneStates(list: Milestone[], today: string): Record<string, MilestoneState> {
    const out: Record<string, MilestoneState> = {};
    let nextGiven = false;
    for (const milestone of sortMilestones(list)) {
        if (milestone.doneAt) out[milestone.id] = 'done';
        else if (milestone.dueDate && milestone.dueDate < today) out[milestone.id] = 'late';
        else if (!nextGiven) { out[milestone.id] = 'next'; nextGiven = true; }
        else out[milestone.id] = 'ahead';
    }
    return out;
}

/**
 * Evenly spaced checkpoints for a goal with an amount and an end date:
 * "24 books" from Oct 26 to Dec 31 becomes Book 1 … Book 24, each due on its
 * share of the time. A big amount is grouped so there are never more than
 * twelve ("Read 3000 pages" is 250 pages a step). Pure, for the tests.
 */
export function splitIntoMilestones(input: {
    target: number; unit?: string | null; verb?: string; start: string; end: string; max?: number;
}): { title: string; dueDate: string }[] {
    const { target, start, end } = input;
    const max = input.max ?? 12;
    if (!(target > 0) || !start || !end || end < start) return [];
    const steps = Math.min(Math.round(target), max);
    if (steps < 1) return [];
    const from = new Date(`${start}T12:00:00`).getTime();
    const to = new Date(`${end}T12:00:00`).getTime();
    const unit = (input.unit ?? '').trim();
    const singular = /ies$/i.test(unit) ? unit.replace(/ies$/i, 'y') : /ss$/i.test(unit) ? unit : unit.replace(/s$/i, '');
    const label = singular ? singular.charAt(0).toUpperCase() + singular.slice(1) : 'Step';
    const verb = input.verb ? `${input.verb.charAt(0).toUpperCase()}${input.verb.slice(1)} ` : '';
    const out: { title: string; dueDate: string }[] = [];
    for (let step = 1; step <= steps; step++) {
        const at = new Date(from + ((to - from) * step) / steps);
        const dueDate = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
        const reached = Math.round((target * step) / steps);
        // One per unit: "Book 3". Grouped: "750 pages".
        const title = steps === Math.round(target)
            ? `${verb}${label} ${step}`
            : `${verb}${reached} ${unit || 'done'}`;
        out.push({ title: title.trim(), dueDate });
    }
    return out;
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * A milestone's name as typed or said, with its date read out of it: "Finish
 * book 1 by October 31" is "Finish book 1", due Oct 31 (the date wheels jump
 * there). Reads "by/before/on <date>", "Oct 31st", "12/15", "next Friday",
 * "in 2 weeks", and "by the end of November / the month / the year". Pure.
 */
export function readMilestoneText(text: string, today: Date = new Date()): { title: string; dueDate?: string } {
    const { findDate, findDeadline } = require('./dateWords') as typeof import('./dateWords');
    let found: { date: string; phrase: string } | null = null;
    const endOf = text.match(new RegExp(String.raw`\b(?:by|before|until|for)?\s*(?:the\s+)?end\s+of\s+(?:the\s+|this\s+)?(week|month|year|${MONTH_NAMES.join('|')}|${MONTH_NAMES.map(m => m.slice(0, 3)).join('|')})\b`, 'i'));
    if (endOf) {
        const what = endOf[1].toLowerCase();
        let end: Date;
        if (what === 'week') end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - today.getDay()));
        else if (what === 'month') end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        else if (what === 'year') end = new Date(today.getFullYear(), 11, 31);
        else {
            const month = MONTH_NAMES.findIndex(name => name.startsWith(what.slice(0, 3)));
            const year = month < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
            end = new Date(year, month + 1, 0);
        }
        found = { date: keyOf(end), phrase: endOf[0] };
    }
    found = found ?? findDeadline(text, today) ?? findDate(text, today);
    if (!found) return { title: text.trim() };
    const escaped = found.phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const title = text
        .replace(new RegExp(String.raw`(?:\b(?:by|before|until|on|due)\s+)?${escaped}`, 'i'), ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/[\s,.;:-]+$/, '')
        .trim();
    return { title: title || text.trim(), dueDate: found.date };
}

/* -------------------------------------------------------------------------- */
/*  Reading and writing                                                        */
/* -------------------------------------------------------------------------- */

export async function getMilestones(goalId: string): Promise<Milestone[]> {
    if (!isSQLiteAvailable() || !goalId) return [];
    const db = await getDatabase();
    if (!db) return [];
    const uid = await getLocalUserId().catch(() => null);
    const rows = await db.getAllAsync(
        'SELECT * FROM milestones WHERE goal_id = ? AND deleted = 0 AND (user_id = ? OR user_id IS NULL)', goalId, uid,
    );
    return sortMilestones((rows ?? []).map(rowToMilestone));
}

export async function addMilestones(goalId: string, items: { title: string; dueDate?: string }[]): Promise<void> {
    const db = await getDatabase();
    if (!db) throw new Error('Milestones could not be saved on this phone.');
    const uid = await getLocalUserId().catch(() => null);
    const existing = await getMilestones(goalId);
    let position = existing.reduce((max, m) => Math.max(max, m.position), 0);
    const now = nowISO();
    await db.withTransactionAsync(async () => {
        for (const item of items) {
            const title = item.title.trim();
            if (!title) continue;
            position += 1;
            await db.runAsync(
                `INSERT INTO milestones (id, user_id, goal_id, title, due_date, done_at, position, created_at, updated_at, deleted, synced)
                 VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, 0)`,
                generateId(), uid, goalId, title, item.dueDate ?? null, position, now, now,
            );
        }
    });
    emit('milestones_changed', { goalId });
}

export async function updateMilestone(milestone: Milestone, patch: { title?: string; dueDate?: string | null; done?: boolean }): Promise<void> {
    const db = await getDatabase();
    if (!db) throw new Error('Milestones could not be saved on this phone.');
    const title = patch.title !== undefined ? patch.title.trim() || milestone.title : milestone.title;
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : milestone.dueDate ?? null;
    const doneAt = patch.done === undefined ? milestone.doneAt ?? null : patch.done ? nowISO() : null;
    await db.runAsync(
        'UPDATE milestones SET title = ?, due_date = ?, done_at = ?, updated_at = ?, synced = 0 WHERE id = ?',
        title, dueDate, doneAt, nowISO(), milestone.id,
    );
    emit('milestones_changed', { goalId: milestone.goalId });
}

export async function deleteMilestone(milestone: Milestone): Promise<void> {
    const db = await getDatabase();
    if (!db) return;
    await db.runAsync('UPDATE milestones SET deleted = 1, updated_at = ?, synced = 0 WHERE id = ?', nowISO(), milestone.id);
    emit('milestones_changed', { goalId: milestone.goalId });
}

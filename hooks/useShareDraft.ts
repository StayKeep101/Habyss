import { useCallback, useState } from 'react';
import { FriendsService } from '@/lib/friendsService';

type Kind = 'habit' | 'task' | 'goal';

/** Who is on it now. A goal's participants are its own row, not its habits'. */
async function current(kind: Kind, id: string): Promise<string[]> {
    const rows = kind === 'task' ? await FriendsService.getTaskSharedWith(id)
        : kind === 'goal' ? await FriendsService.getGoalSharedWith(id)
        : await FriendsService.getHabitSharedWith(id);
    return rows.map(friend => friend.id);
}

async function apply(kind: Kind, id: string, added: string[], removed: string[]): Promise<void> {
    if (kind === 'goal') {
        // A goal's habits follow the goal: sharing the target without the work
        // that reaches it shows somebody a number they cannot help move.
        const { getHabits } = require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite');
        const linked = (await getHabits()).filter(habit => habit.goalId === id && !habit.isGoal);
        const work: Promise<boolean>[] = [];
        if (added.length) work.push(FriendsService.batchShareGoal(id, added));
        if (removed.length) work.push(FriendsService.batchUnshareGoal(id, removed));
        for (const friendId of added) {
            for (const habit of linked) work.push(FriendsService.shareHabitWithFriend(habit.id, friendId, false));
        }
        for (const friendId of removed) {
            for (const habit of linked) work.push(FriendsService.unshareHabit(habit.id, friendId));
        }
        if ((await Promise.all(work)).some(ok => ok === false)) throw new Error('participants could not be saved');
        return;
    }

    const results = await Promise.all([
        ...added.map(friendId => kind === 'task'
            ? FriendsService.shareTaskWithFriend(id, friendId)
            : FriendsService.shareHabitWithFriend(id, friendId)),
        ...removed.map(friendId => kind === 'task'
            ? FriendsService.unshareTask(id, friendId)
            : FriendsService.unshareHabit(id, friendId)),
    ]);
    // These report failure by returning false rather than throwing.
    if (results.some(ok => ok === false)) throw new Error('participants could not be saved');
}

/**
 * Inviting somebody to a habit, task or goal while you are still writing it.
 *
 * Sharing used to be reachable only from a detail page, which means only after
 * the thing existed — so deciding to do it with somebody meant making it,
 * leaving the sheet, opening it again and sharing. The decision is usually made
 * at the same moment as the habit.
 *
 * A thing that does not exist yet has no id to write a share row against, so
 * the choice is **held** until it is saved and `applyTo` is called with the new
 * id. Editing something that already exists goes straight to the server, which
 * is what the detail page always did.
 *
 * `pending` is what the header badge counts, so the sheet can say somebody is
 * coming along before there is anything to come along to.
 */
export function useShareDraft(kind: Kind, existingId?: string) {
    const [picking, setPicking] = useState(false);
    const [pending, setPending] = useState<string[]>([]);

    const loadShared = useCallback(
        async () => (existingId ? current(kind, existingId) : pending),
        [kind, existingId, pending],
    );

    const applyChanges = useCallback(async (added: string[], removed: string[]) => {
        if (!existingId) {
            setPending(prev => [...prev.filter(id => !removed.includes(id)), ...added]);
            return;
        }
        await apply(kind, existingId, added, removed);
    }, [kind, existingId]);

    /**
     * Sends the held invitations, now that the thing has an id.
     *
     * Never throws: the habit is already saved, and failing to reach a friend
     * is not a reason to tell somebody their habit was lost. It resets either
     * way so a second save cannot invite the same people twice.
     */
    const applyTo = useCallback(async (id: string) => {
        if (pending.length === 0) return;
        const invited = pending;
        setPending([]);
        await apply(kind, id, invited, []).catch(() => undefined);
    }, [kind, pending]);

    return {
        picking,
        pending,
        open: () => setPicking(true),
        close: () => setPicking(false),
        loadShared,
        applyChanges,
        applyTo,
    };
}

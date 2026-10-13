import React, { useCallback } from 'react';
import { FriendsService } from '@/lib/friendsService';
import { getHabits } from '@/lib/habitsSQLite';
import { ShareParticipantsSheet } from '@/components/Social/ShareParticipantsSheet';

interface ShareGoalModalProps {
    visible: boolean;
    goalId: string;
    goalName: string;
    onClose: () => void;
}

export const ShareGoalModal: React.FC<ShareGoalModalProps> = ({ visible, goalId, goalName, onClose }) => {
    const loadShared = useCallback(
        async () => (await FriendsService.getGoalSharedWith(goalId)).map(friend => friend.id),
        [goalId],
    );

    const applyChanges = useCallback(async (added: string[], removed: string[]) => {
        // Habits under the goal follow the goal, so they are updated together.
        const habits = await getHabits();
        const linked = habits.filter(habit => habit.goalId === goalId && !habit.isGoal);

        const operations: Promise<boolean>[] = [];
        if (added.length) operations.push(FriendsService.batchShareGoal(goalId, added));
        if (removed.length) operations.push(FriendsService.batchUnshareGoal(goalId, removed));
        for (const friendId of added) {
            for (const habit of linked) operations.push(FriendsService.shareHabitWithFriend(habit.id, friendId));
        }
        for (const friendId of removed) {
            for (const habit of linked) operations.push(FriendsService.unshareHabit(habit.id, friendId));
        }

        const results = await Promise.all(operations);
        // These calls report failure by returning false rather than throwing.
        if (results.some(ok => ok === false)) throw new Error('Goal participants could not be saved');
    }, [goalId]);

    return (
        <ShareParticipantsSheet
            visible={visible}
            title="Share goal"
            subtitle={goalName}
            loadShared={loadShared}
            applyChanges={applyChanges}
            onClose={onClose}
        />
    );
};

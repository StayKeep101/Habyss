import React, { useCallback } from 'react';
import { FriendsService } from '@/lib/friendsService';
import { ShareParticipantsSheet } from '@/components/Social/ShareParticipantsSheet';

interface ShareItemModalProps {
    visible: boolean;
    /** The habit or task being shared. */
    itemId: string;
    itemName: string;
    kind?: 'habit' | 'task';
    onClose: () => void;
}

/**
 * Doing one thing together.
 *
 * Habits and tasks share this sheet because they share the rule — it is not
 * done until everyone on it has done it — and the only difference is which
 * table the participants are written to.
 */
export const ShareItemModal: React.FC<ShareItemModalProps> = ({ visible, itemId, itemName, kind = 'habit', onClose }) => {
    const isTask = kind === 'task';

    const loadShared = useCallback(
        async () => (isTask
            ? await FriendsService.getTaskSharedWith(itemId)
            : await FriendsService.getHabitSharedWith(itemId)).map(friend => friend.id),
        [itemId, isTask],
    );

    const applyChanges = useCallback(async (added: string[], removed: string[]) => {
        const results = await Promise.all([
            ...added.map(friendId => isTask
                ? FriendsService.shareTaskWithFriend(itemId, friendId)
                : FriendsService.shareHabitWithFriend(itemId, friendId)),
            ...removed.map(friendId => isTask
                ? FriendsService.unshareTask(itemId, friendId)
                : FriendsService.unshareHabit(itemId, friendId)),
        ]);
        // These calls report failure by returning false rather than throwing.
        if (results.some(ok => ok === false)) throw new Error(`${isTask ? 'Task' : 'Habit'} participants could not be saved`);
    }, [itemId, isTask]);

    return (
        <ShareParticipantsSheet
            visible={visible}
            title={isTask ? 'SHARE TASK' : 'SHARE HABIT'}
            subtitle={itemName}
            loadShared={loadShared}
            applyChanges={applyChanges}
            onClose={onClose}
        />
    );
};

/** The name the habit detail page has always used. */
export const ShareHabitModal: React.FC<{
    visible: boolean; habitId: string; habitName: string; onClose: () => void;
}> = ({ visible, habitId, habitName, onClose }) => (
    <ShareItemModal visible={visible} itemId={habitId} itemName={habitName} kind="habit" onClose={onClose} />
);

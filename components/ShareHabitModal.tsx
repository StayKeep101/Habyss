import React, { useCallback } from 'react';
import { FriendsService } from '@/lib/friendsService';
import { ShareParticipantsSheet } from '@/components/Social/ShareParticipantsSheet';

interface ShareHabitModalProps {
    visible: boolean;
    habitId: string;
    habitName: string;
    onClose: () => void;
}

export const ShareHabitModal: React.FC<ShareHabitModalProps> = ({ visible, habitId, habitName, onClose }) => {
    const loadShared = useCallback(
        async () => (await FriendsService.getHabitSharedWith(habitId)).map(friend => friend.id),
        [habitId],
    );

    const applyChanges = useCallback(async (added: string[], removed: string[]) => {
        const results = await Promise.all([
            ...added.map(friendId => FriendsService.shareHabitWithFriend(habitId, friendId)),
            ...removed.map(friendId => FriendsService.unshareHabit(habitId, friendId)),
        ]);
        // These calls report failure by returning false rather than throwing.
        if (results.some(ok => ok === false)) throw new Error('Habit participants could not be saved');
    }, [habitId]);

    return (
        <ShareParticipantsSheet
            visible={visible}
            title="SHARE HABIT"
            subtitle={habitName}
            loadShared={loadShared}
            applyChanges={applyChanges}
            onClose={onClose}
        />
    );
};

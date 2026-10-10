import React from 'react';
import { Pressable } from 'react-native';
import { Avatar, ProgressRing } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';

/** Your picture inside today's ring: closed and green once the day is done. */
export const ProgressAvatar: React.FC<{
    uri?: string | null;
    done: number;
    total: number;
    onPress: () => void;
}> = ({ uri, done, total, onPress }) => {
    const t = useTokens();
    const complete = total > 0 && done >= total;
    return (
        <Pressable accessibilityRole="button" onPress={onPress}
            accessibilityLabel={total > 0 ? `Your profile. ${done} of ${total} done today.` : 'Your profile'}>
            <ProgressRing progress={total > 0 ? done / total : 0} tone={complete ? 'success' : 'accent'}>
                <Avatar uri={uri} size={t.space['4xl'] + t.space.xs} />
            </ProgressRing>
        </Pressable>
    );
};

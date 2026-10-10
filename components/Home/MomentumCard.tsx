import React from 'react';
import { Card, ProgressBar, StatTile } from '@/components/ui';
import type { Momentum } from '@/lib/momentum';

/** How steadily habits are kept, and which way it is moving. */
export const MomentumCard: React.FC<{ momentum: Momentum; onPress: () => void }> = ({ momentum, onPress }) => {
    const { rate, delta, direction, comparable } = momentum;
    const tone = !comparable ? 'accent' : direction === 'up' ? 'success' : direction === 'down' ? 'warning' : 'accent';
    const icon = !comparable ? 'pulse' : direction === 'up' ? 'trending-up' : direction === 'down' ? 'trending-down' : 'remove';
    return (
        <Card grow centered padding="md" gap="sm" onPress={onPress}
            accessibilityLabel={comparable ? `Momentum ${rate} percent, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} on the previous ${momentum.days} days` : `Momentum ${rate} percent`}>
            <StatTile icon={icon as never} iconTone={tone} value={`${rate}%`} label="Momentum"
                corner={comparable && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}` : undefined} />
            <ProgressBar progress={rate / 100} tone={tone} thickness="thin" />
        </Card>
    );
};

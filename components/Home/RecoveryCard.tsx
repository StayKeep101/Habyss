import React from 'react';
import { Card, StatTile } from '@/components/ui';
import type { Recovery } from '@/lib/recovery';

/** How often a missed habit comes back the next day, or what is about to slip twice. */
export const RecoveryCard: React.FC<{ recovery: Recovery; onPress: () => void }> = ({ recovery, onPress }) => {
    const { rate, atRisk } = recovery;
    const risk = atRisk.length > 0;
    const tone = risk ? 'warning' : rate === null ? 'accent' : rate >= 70 ? 'success' : rate >= 40 ? 'accent' : 'warning';
    return (
        <Card grow centered padding="md" onPress={onPress}
            accessibilityLabel={risk ? `${atRisk.length} habit${atRisk.length === 1 ? '' : 's'} about to be missed twice. Open recovery.`
                : rate === null ? 'Recovery, nothing missed yet' : `Recovery ${rate} percent`}>
            <StatTile icon={risk ? 'alert' : 'refresh'} iconTone={tone} tone={risk ? 'warning' : 'primary'}
                value={risk ? String(atRisk.length) : rate === null ? '—' : `${rate}%`} label={risk ? 'To protect' : 'Recovery'} />
        </Card>
    );
};

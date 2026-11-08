import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { TimeWheels } from '@/components/ui/TimeWheels';
import { AppButton } from '@/components/ui/AppButton';
import { useHaptics } from '@/hooks/useHaptics';
import { clockLabel, type FlowInput } from '@/lib/dayFlow';
import { Spacing } from '@/theme/designSystem';

const hhmm = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const minuteOf = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };

/**
 * Held on the timeline: pin a habit or task at an exact time ("I need this at
 * 3:00"). The wheels open on where it sits now; one tap pins it there or at the
 * time turned to. Pinned already: it can be let go back into the flow.
 */
export function PinSheet({ item, onPin, onUnpin, onClose }: {
    /** The habit or task held, with where it sits now (`start`); null when closed. */
    item: (FlowInput & { start: number }) | null;
    onPin: (item: FlowInput, minute: number) => void;
    onUnpin: (item: FlowInput) => void;
    onClose: () => void;
}) {
    const { selectionFeedback } = useHaptics();
    const [time, setTime] = useState('09:00');
    // The last one held, so the sheet keeps its words while it slides away.
    const [held, setHeld] = useState(item);
    // A new item held: the wheels start at where it sits on the line.
    if (item && item !== held) { setHeld(item); setTime(hhmm(item.start)); }
    const pin = () => { if (!item) return; selectionFeedback(); onClose(); onPin(item, minuteOf(time)); };
    const unpin = () => { if (!item) return; selectionFeedback(); onClose(); onUnpin(item); };
    return (
        <VoidSheet visible={!!item} onClose={onClose} title={held?.title ?? ''} caption={`${held?.locked ? 'Pinned at an exact time' : 'Pin at an exact time'}${held?.kind === 'habit' ? ', every day it repeats' : ''}`}>
            <View style={styles.body}>
                <TimeWheels value={time} onChange={setTime} />
                <AppButton label={`Pin at ${clockLabel(minuteOf(time))}`} icon="lock-closed" onPress={pin} />
                {held?.locked ? <AppButton label="Unpin" variant="ghost" onPress={unpin} /> : null}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.md, paddingBottom: Spacing.sm },
});

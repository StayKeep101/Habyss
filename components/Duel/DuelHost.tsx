import React, { useEffect, useState } from 'react';
import { on } from '@/lib/appEvents';
import { DuelSheet } from './DuelSheet';

/** "Duel a friend", from the + on Community or the Duels section. Mounted once over the app. */
export function DuelHost() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const sub = on('show_duel', () => setVisible(true));
        return () => sub.remove();
    }, []);
    return <DuelSheet visible={visible} onClose={() => setVisible(false)} />;
}

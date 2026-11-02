import React, { useEffect, useState } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { answer, type CheckInKind } from '@/lib/checkIns';
import { CheckInPopup } from './CheckInPopup';

/**
 * Echo's one-tap question, asked when you ask for it: the + on Home (mood,
 * energy). Mounted once over the app, so it works from any tab.
 */
export function CheckInHost() {
    const { successFeedback } = useHaptics();
    const [kind, setKind] = useState<CheckInKind | null>(null);
    useEffect(() => {
        const sub = on('show_check_in', ({ kind: asked }) => setKind(asked));
        return () => sub.remove();
    }, []);
    return (
        <CheckInPopup kind={kind} onClose={() => setKind(null)}
            onAnswer={(asked, value) => { void answer(asked, value); setKind(null); successFeedback(); }} />
    );
}

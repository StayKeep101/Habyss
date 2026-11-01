import React, { useEffect, useState } from 'react';
import { AppState, Text, type StyleProp, type TextStyle } from 'react-native';
import { deadlineCountdown } from '@/lib/deadlineCountdown';

/** Only this small label renders every second, never the goal's calendar. */
export function DeadlineCountdown({ deadline, style }: { deadline: string; style?: StyleProp<TextStyle> }) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        const update = (state: string) => {
            clearInterval(timer);
            if (state === 'active') {
                setNow(Date.now());
                timer = setInterval(() => setNow(Date.now()), 1000);
            }
        };
        update(AppState.currentState);
        const sub = AppState.addEventListener('change', update);
        return () => { clearInterval(timer); sub.remove(); };
    }, []);
    return <Text style={[style, { fontVariant: ['tabular-nums'] }]}>{deadlineCountdown(deadline, now)}</Text>;
}

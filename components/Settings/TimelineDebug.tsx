import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTokens } from '@/hooks/useTokens';
import { Text } from '@/components/ui/Text';
import { clockLabel, type DayFlow } from '@/lib/dayFlow';

/**
 * What today's timeline sees, read every five seconds: each thing's place, the
 * place it was last shown in (kept), whether it has had its turn (lapsed), and
 * how it is fixed. For finding why something stays "now" on a real phone.
 */
export function TimelineDebug() {
    const t = useTokens();
    const [state, setState] = useState<{ at: string; flow: DayFlow | null; memory: import('@/lib/dayMemory').DayMemory | null }>({ at: '', flow: null, memory: null });
    useEffect(() => {
        let alive = true;
        const read = async () => {
            const { todayFlow } = require('@/lib/todayFlow') as typeof import('@/lib/todayFlow');
            const { currentMemory, loadMemory } = require('@/lib/dayMemory') as typeof import('@/lib/dayMemory');
            await loadMemory();
            const now = new Date();
            const flow = await todayFlow(now).catch(() => null);
            if (alive) setState({ at: now.toLocaleTimeString(), flow, memory: currentMemory() });
        };
        void read();
        const timer = setInterval(() => void read(), 5000);
        return () => { alive = false; clearInterval(timer); };
    }, []);
    const slot = (span?: { start: number; end: number }) => (span ? `${clockLabel(span.start)}–${clockLabel(span.end)}` : '—');
    const line = (text: string, key: string) => <Text key={key} variant="caption" tone="muted" selectable>{text}</Text>;
    const memory = state.memory;
    return (
        <View style={{ gap: t.space.xs, paddingVertical: t.space.sm }}>
            {line(`Read at ${state.at} · memory day ${memory?.day ?? '—'} · current ${state.flow?.current?.title ?? 'none'}`, 'head')}
            {(state.flow?.timeline ?? []).filter(item => item.kind === 'habit' || item.kind === 'task').map((item, index) =>
                line(`${item.title} [${item.kind}] ${slot(item)} ${item.state}${item.done ? ' done' : ''}${item.locked ? ' locked' : ''}${item.lapsed ? ' lapsed' : ''}`
                    + ` · kept ${slot(memory?.slots[item.id])}${memory?.lapsed?.[item.id] ? ' · memLapsed' : ''} · len ${item.minutes}`, `${item.id}:${index}`))}
            {(state.flow?.unfit ?? []).map(item => line(`NO ROOM: ${item.title}${memory?.lapsed?.[item.id] ? ' · memLapsed' : ''}`, `unfit:${item.id}`))}
        </View>
    );
}

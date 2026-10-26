import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { AppTextField } from '@/components/ui/AppTextField';
import { AppButton } from '@/components/ui/AppButton';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { DateWheels } from '@/components/ui/DateWheels';
import { IconButton } from '@/components/ui/IconButton';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalLogs } from '@/hooks/useGoalLogs';
import { addGoalLog, removeGoalLog } from '@/lib/goalLogs';
import { localDateKey } from '@/lib/habitSchedule';

export type LogMode = 'sum' | 'best' | 'latest';

const COPY: Record<LogMode, { title: string; field: string; hint: string }> = {
    sum: { title: 'Add progress', field: 'How much', hint: 'Added to what you have so far.' },
    best: { title: 'Your best today', field: 'Your best effort', hint: 'The best one counts: a shorter day never takes it back.' },
    latest: { title: 'Where you are now', field: 'Current value', hint: 'The latest one counts, up or down.' },
};

/**
 * Writing progress straight onto a goal, for anything measured rather than
 * ticked: ran 4 km (one go: the best counts), saved $300 (adds up), weighed
 * 82 kg (a level: the latest counts). Today by default, yesterday or any
 * earlier day too; recent entries listed, each removable.
 */
export function LogProgressSheet({ visible, goalId, goalName, unit, mode, onClose }: {
    visible: boolean;
    goalId: string;
    goalName: string;
    unit: string;
    mode: LogMode;
    onClose: () => void;
}) {
    const t = useTokens();
    const { successFeedback, lightFeedback } = useHaptics();
    const logs = useGoalLogs()[goalId] ?? [];
    const [amount, setAmount] = useState('');
    const [when, setWhen] = useState<'today' | 'yesterday' | 'other'>('today');
    const [date, setDate] = useState(new Date());
    useEffect(() => { if (visible) { setAmount(''); setWhen('today'); setDate(new Date()); } }, [visible]);

    const value = Number(amount.replace(',', '.'));
    const valid = amount.trim() !== '' && Number.isFinite(value) && value >= 0;
    const dayKey = () => {
        if (when === 'today') return localDateKey(new Date());
        if (when === 'yesterday') { const d = new Date(); d.setDate(d.getDate() - 1); return localDateKey(d); }
        return localDateKey(date);
    };
    const save = async () => {
        if (!valid) return;
        await addGoalLog(goalId, dayKey(), value);
        successFeedback();
        onClose();
    };
    const copy = COPY[mode];
    const shown = [...logs].reverse().slice(0, 6);
    const pretty = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

    return (
        <VoidSheet visible={visible} onClose={onClose} title={copy.title} caption={goalName} maxShare={0.85}
            footer={<View style={styles.footer}><AppButton label="Save" onPress={() => void save()} disabled={!valid} /></View>}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <AppTextField label={`${copy.field}${unit ? ` (${unit})` : ''}`} value={amount} onChangeText={setAmount}
                    keyboardType="decimal-pad" placeholder="0" autoFocus returnKeyType="done" onSubmitEditing={() => void save()} />
                <Text style={[styles.hint, { color: t.color.textMuted }]}>{copy.hint}</Text>
                <ChoiceRow accessibilityLabel="Which day" value={when} onChange={setWhen}
                    options={[{ id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'other', label: 'Other day' }]} />
                {when === 'other' ? <DateWheels value={date} onChange={setDate} minYear={new Date().getFullYear() - 2} maxDate={new Date()} /> : null}
                {shown.length ? (
                    <View style={styles.list}>
                        <Text style={[styles.listTitle, { color: t.color.textPrimary }]}>Recent</Text>
                        {shown.map(log => (
                            <View key={log.id} style={styles.row}>
                                <Text style={[styles.rowDate, { color: t.color.textMuted }]}>{pretty(log.date)}</Text>
                                <Text style={[styles.rowAmount, { color: t.color.textPrimary }]}>{`${log.amount}${unit ? ` ${unit}` : ''}`}</Text>
                                <IconButton icon="trash-outline" label={`Remove ${log.amount} on ${pretty(log.date)}`} size={16}
                                    onPress={() => { lightFeedback(); void removeGoalLog(goalId, log.id); }} />
                            </View>
                        ))}
                    </View>
                ) : null}
            </ScrollView>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    scroll: { flexGrow: 0 },
    body: { gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    hint: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: -Spacing.xs },
    list: { gap: Spacing.xs, marginTop: Spacing.sm },
    listTitle: { fontSize: 15, fontFamily: FontFamily.semibold },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rowDate: { flex: 1, fontSize: 14, fontFamily: FontFamily.regular },
    rowAmount: { fontSize: 15, fontFamily: FontFamily.semibold },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});

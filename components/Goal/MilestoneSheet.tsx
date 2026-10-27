import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { AppTextField } from '@/components/ui/AppTextField';
import { AppButton } from '@/components/ui/AppButton';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { DateWheels } from '@/components/ui/DateWheels';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { localDateKey } from '@/lib/habitSchedule';
import { addMilestones, deleteMilestone, readMilestoneText, updateMilestone, type Milestone } from '@/lib/goalMilestones';
import { DictateField } from '@/components/Create/DictateField';
import { useTokens } from '@/hooks/useTokens';

const dateOf = (key: string) => new Date(`${key}T12:00:00`);

/**
 * Adding or changing one milestone: its name and, if it has one, the day it
 * should be reached by. A new one starts dated a week out, or at the goal's
 * end if that is sooner. Typing or saying the date in the name ("Finish book
 * 1 by October 31") sets the wheels to it, and the name is saved without it.
 * The keyboard waits for a tap on the name, so the sheet opens with the date
 * wheels in full view; turning them puts the keyboard away again.
 */
export function MilestoneSheet({ visible, goalId, goalEnd, milestone, onClose }: {
    visible: boolean;
    goalId: string;
    /** YYYY-MM-DD the goal ends, if it does. */
    goalEnd?: string;
    /** Set when changing one; absent when adding. */
    milestone?: Milestone | null;
    onClose: () => void;
}) {
    const [title, setTitle] = useState('');
    const [dated, setDated] = useState<'date' | 'none'>('date');
    const [date, setDate] = useState(new Date());
    const [saving, setSaving] = useState(false);
    const t = useTokens();
    // The date said in the name; the wheels follow it each time it changes.
    const read = useMemo(() => readMilestoneText(title), [title]);
    const lastRead = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!read.dueDate || read.dueDate === lastRead.current) return;
        lastRead.current = read.dueDate;
        setDated('date');
        setDate(dateOf(read.dueDate));
    }, [read.dueDate]);

    useEffect(() => {
        if (!visible) return;
        const weekOut = new Date(); weekOut.setDate(weekOut.getDate() + 7);
        const suggested = goalEnd && dateOf(goalEnd) < weekOut ? dateOf(goalEnd) : weekOut;
        setTitle(milestone?.title ?? '');
        lastRead.current = undefined;
        setDated(milestone && !milestone.dueDate ? 'none' : 'date');
        setDate(milestone?.dueDate ? dateOf(milestone.dueDate) : suggested);
    }, [visible, milestone, goalEnd]);

    const save = async () => {
        // Saved clean: "Finish book 1", the date in its own field.
        const name = (read.dueDate ? read.title : title).trim();
        if (!name) return;
        setSaving(true);
        try {
            const dueDate = dated === 'date' ? localDateKey(date) : null;
            if (milestone) await updateMilestone(milestone, { title: name, dueDate });
            else await addMilestones(goalId, [{ title: name, dueDate: dueDate ?? undefined }]);
            onClose();
        } catch {
            Alert.alert('Milestone not saved', 'Something went wrong saving it on this phone. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const remove = () => {
        if (!milestone) return;
        Alert.alert('Delete milestone?', milestone.title, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { void deleteMilestone(milestone).then(onClose); } },
        ]);
    };

    const far = new Date(); far.setFullYear(far.getFullYear() + 10);
    return (
        <VoidSheet visible={visible} onClose={onClose} title={milestone ? 'Edit milestone' : 'New milestone'} maxShare={0.85}
            footer={
                <View style={styles.footer}>
                    <AppButton label={milestone ? 'Save' : 'Add milestone'} onPress={() => void save()} disabled={!title.trim()} loading={saving} />
                    {milestone ? <AppButton label="Delete milestone" variant="danger" onPress={remove} /> : null}
                </View>
            }>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <DictateField text={title} onText={setTitle}>
                    <AppTextField label="Name" value={title} onChangeText={setTitle} placeholder="Finish book 1 by Oct 31"
                        returnKeyType="done" onSubmitEditing={() => void save()} maxLength={200} />
                </DictateField>
                {read.dueDate ? (
                    <Text style={[styles.read, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">
                        {`“${read.title}”, due ${dateOf(read.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: dateOf(read.dueDate).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}`}
                    </Text>
                ) : null}
                <ChoiceRow accessibilityLabel="Due date" value={dated} onChange={setDated}
                    options={[{ id: 'date', label: 'By a date' }, { id: 'none', label: 'No date' }]} />
                {dated === 'date' ? <DateWheels value={date} onChange={setDate} minYear={new Date().getFullYear()} maxDate={far} /> : null}
            </ScrollView>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    scroll: { flexGrow: 0 },
    read: { fontSize: 13, fontFamily: FontFamily.medium, marginTop: -Spacing.sm },
    body: { gap: Spacing.lg, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    footer: { gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});

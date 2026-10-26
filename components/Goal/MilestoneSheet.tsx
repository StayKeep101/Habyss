import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { AppTextField } from '@/components/ui/AppTextField';
import { AppButton } from '@/components/ui/AppButton';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { DateWheels } from '@/components/ui/DateWheels';
import { Spacing } from '@/theme/designSystem';
import { localDateKey } from '@/lib/habitSchedule';
import { addMilestones, deleteMilestone, updateMilestone, type Milestone } from '@/lib/goalMilestones';

const dateOf = (key: string) => new Date(`${key}T12:00:00`);

/**
 * Adding or changing one milestone: its name and, if it has one, the day it
 * should be reached by. A new one starts dated a week out, or at the goal's
 * end if that is sooner.
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

    useEffect(() => {
        if (!visible) return;
        const weekOut = new Date(); weekOut.setDate(weekOut.getDate() + 7);
        const suggested = goalEnd && dateOf(goalEnd) < weekOut ? dateOf(goalEnd) : weekOut;
        setTitle(milestone?.title ?? '');
        setDated(milestone && !milestone.dueDate ? 'none' : 'date');
        setDate(milestone?.dueDate ? dateOf(milestone.dueDate) : suggested);
    }, [visible, milestone, goalEnd]);

    const save = async () => {
        const name = title.trim();
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
                <AppTextField label="Name" value={title} onChangeText={setTitle} placeholder="Finish book 1" autoFocus={!milestone}
                    returnKeyType="done" onSubmitEditing={() => void save()} maxLength={200} />
                <ChoiceRow accessibilityLabel="Due date" value={dated} onChange={setDated}
                    options={[{ id: 'date', label: 'By a date' }, { id: 'none', label: 'No date' }]} />
                {dated === 'date' ? <DateWheels value={date} onChange={setDate} minYear={new Date().getFullYear()} maxDate={far} /> : null}
            </ScrollView>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    scroll: { flexGrow: 0 },
    body: { gap: Spacing.lg, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    footer: { gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});

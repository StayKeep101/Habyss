import React from 'react';
import { SettingsGroup, SettingsRow, SheetSection, VoidSheet } from '@/components/ui';
import { PerfectLadder } from '@/components/Marks/PerfectLadder';
import { useTokens } from '@/hooks/useTokens';
import { SHARDS } from '@/lib/shards';

const signed = (points: number) => `${points > 0 ? '+' : '−'}${Math.abs(points)}`;

/**
 * How Shards work, as the app explains anything: a sheet of titled sections
 * and settings-style rows (a tile, what it is, what it is worth). First, that
 * Shards are a game currency and not money; then every rule, nothing to take
 * on trust.
 */
export function ShardsRules({ visible, onClose, multiplier, perfectRun }: { visible: boolean; onClose: () => void; multiplier: number; perfectRun: number }) {
    const t = useTokens();
    const rules = SHARDS.rules;
    const earn = t.color.success;
    const lose = t.color.danger;
    const fair = t.color.accent;
    return (
        <VoidSheet visible={visible} onClose={onClose} title="How Shards work" caption="Your currency. Marks are your XP." scrollable maxShare={0.85}>
            <SheetSection first title="Game currency only"
                description="Shards are for fun inside Habyss. They aren’t real money and have no cash value. They can’t be bought, sold, cashed out, transferred outside the app or exchanged for money or prizes. Bets are a game between friends." />

            <SettingsGroup title="Earn">
                <SettingsRow icon="add-circle" color={earn} label="Add a habit · task · goal" value={`${signed(rules.add.habit)} · ${signed(rules.add.task)} · ${signed(rules.add.goal)}`} />
                <SettingsRow icon="checkmark-circle" color={earn} label="Finish a habit · task · goal" value={`${signed(rules.complete.habit)} · ${signed(rules.complete.task)} · ${signed(rules.complete.goal)}`} />
                <SettingsRow icon="flag" color={earn} label="Reach a milestone" value={signed(rules.complete.milestone)} />
                <SettingsRow icon="moon" color={earn} label="Sleep your goal" value={signed(rules.complete.sleep)} />
            </SettingsGroup>

            <SettingsGroup title="Lose">
                <SettingsRow icon="close-circle" color={lose} label="Miss a habit · task · goal" value={`${signed(rules.miss.habit)} · ${signed(rules.miss.task)} · ${signed(rules.miss.goal)}`} />
                <SettingsRow icon="moon" color={lose} label="Sleep short of your goal" value={signed(rules.miss.sleep)} />
            </SettingsGroup>

            <SheetSection title="Perfect days" description="Everything due done, day after day, multiplies what finishing earns.">
                <PerfectLadder multiplier={multiplier} run={perfectRun} />
            </SheetSection>

            <SettingsGroup title="Fair play">
                <SettingsRow icon="today" color={fair} label="Made and finished the same day" value="0" />
                <SettingsRow icon="time" color={fair} label="Habit ticked days later" value="0" />
                <SettingsRow icon="trophy" color={fair} label={`Goal younger than ${SHARDS.goalMinDays} days`} value="0" />
                <SettingsRow icon="add-circle" color={fair} label="Adding things, per day" value={`Up to ${SHARDS.addCap}`} />
                <SettingsRow icon="flag" color={fair} label="Milestones, per day" value={`Up to ${SHARDS.milestonesPerDay}`} />
                <SettingsRow icon="speedometer" color={fair} label="Any one day" value={`Up to ${SHARDS.dailyCap}`} />
                <SettingsRow icon="trash" color={fair} label="Deleting something" value="Takes back what it earned" />
            </SettingsGroup>

            <SheetSection title="Betting" description={`Put Shards on whether a friend makes their goal. Win and you take a share of the other side’s Shards. Everyone starts with ${SHARDS.starter}, and Shards never go below zero.`} />
        </VoidSheet>
    );
}

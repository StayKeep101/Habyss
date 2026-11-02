import React, { useEffect, useSyncExternalStore } from 'react';
import { SettingsGroup, SettingsRow, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import {
    MAX_PLUS, PLUS_ACTIONS, PLUS_TABS, currentPlus, loadPlus, savePlus, subscribePlus, togglePlus, type PlusActionId,
} from '@/lib/plusActions';

/**
 * What the + offers on each tab, switched on and off. A tab always keeps at
 * least one (its last one can't be switched off) and at most five; with one,
 * the + does it straight away. On Settings the + is always search.
 */
export function PlusButtonSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const t = useTokens();
    const plus = useSyncExternalStore(subscribePlus, currentPlus, currentPlus);
    useEffect(() => { void loadPlus(); }, []);
    const tone = { accent: t.color.accent, success: t.color.success, warning: t.color.warning, danger: t.color.danger };
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Plus button" caption={`Up to ${MAX_PLUS} per tab`} scrollable>
            {PLUS_TABS.map(tab => (
                <SettingsGroup key={tab.id} title={tab.label}>
                    {(Object.keys(PLUS_ACTIONS) as PlusActionId[]).map(id => {
                        const on = plus[tab.id].includes(id);
                        const locked = (on && plus[tab.id].length === 1) || (!on && plus[tab.id].length >= MAX_PLUS);
                        return (
                            <SettingsRow key={id} icon={PLUS_ACTIONS[id].icon} color={tone[PLUS_ACTIONS[id].tone]} label={PLUS_ACTIONS[id].label}
                                toggle={on} disabled={locked} onToggle={() => void savePlus(togglePlus(plus, tab.id, id))} />
                        );
                    })}
                </SettingsGroup>
            ))}
            <SettingsGroup title="Settings">
                <SettingsRow icon="search" color={t.color.accent} label="Search" value="Always" />
            </SettingsGroup>
        </VoidSheet>
    );
}

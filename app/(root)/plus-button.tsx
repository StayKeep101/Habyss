import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { Text } from '@/components/ui';
import { PlusActionRow } from '@/components/Settings/PlusActionRow';
import { useTokens } from '@/hooks/useTokens';
import {
    MAX_PLUS, PLUS_ACTIONS, PLUS_TABS, currentPlus, loadPlus, savePlus, subscribePlus, togglePlus, type PlusActionId, type PlusTab,
} from '@/lib/plusActions';
import { DEFAULT_VOICE_DESTINATION, VOICE_DESTINATIONS, getVoiceDestination, knownVoiceDestination, setVoiceDestination, type VoiceDestination } from '@/lib/voiceDestination';
import { styles } from '@/styles/screens/plus-button.styles';

/**
 * The + button, on one page like the rest of Settings: every action it can
 * offer, each with the tabs it is on (one list, not one list per tab), and
 * what holding + and speaking does with the words. A tab keeps at least one
 * action and at most five; with one, the + does it straight away. On
 * Settings the + is always search.
 */
export default function PlusButtonScreen() {
    const t = useTokens();
    const plus = useSyncExternalStore(subscribePlus, currentPlus, currentPlus);
    useEffect(() => { void loadPlus(); }, []);
    const [voice, setVoice] = useState<VoiceDestination>(() => knownVoiceDestination() ?? DEFAULT_VOICE_DESTINATION);
    useEffect(() => { void getVoiceDestination().then(setVoice); }, []);
    const tone = { accent: t.color.accent, success: t.color.success, warning: t.color.warning, danger: t.color.danger };
    const tabs = PLUS_TABS.map(tab => tab.id);
    const by = (make: (tab: PlusTab) => boolean) => Object.fromEntries(tabs.map(tab => [tab, make(tab)])) as Record<PlusTab, boolean>;

    return (
        <SheetScreen title="Plus button" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Actions">
                    {(Object.keys(PLUS_ACTIONS) as PlusActionId[]).map(id => (
                        <PlusActionRow key={id} label={PLUS_ACTIONS[id].label} icon={PLUS_ACTIONS[id].icon} color={tone[PLUS_ACTIONS[id].tone]}
                            on={by(tab => plus[tab].includes(id))}
                            locked={by(tab => (plus[tab].includes(id) ? plus[tab].length === 1 : plus[tab].length >= MAX_PLUS))}
                            onToggle={tab => void savePlus(togglePlus(plus, tab, id))} />
                    ))}
                </SettingsGroup>
                <Text variant="caption" tone="muted">{`Home, Roadmap and Community, up to ${MAX_PLUS} each. On Settings the + is always search.`}</Text>
                {/* Hold + and speak: where the words go. */}
                <SettingsGroup title="Hold + to say">
                    <SettingsRow icon="mic" color={t.color.accent} label="Words go to"
                        choices={VOICE_DESTINATIONS} chosen={voice}
                        onChoose={id => { setVoice(id as VoiceDestination); void setVoiceDestination(id as VoiceDestination); }} />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

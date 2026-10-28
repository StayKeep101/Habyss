import React, { useEffect, useSyncExternalStore } from 'react';
import { Linking } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useHaptics } from '@/hooks/useHaptics';
import { useClockStyle } from '@/hooks/useClockStyle';
import { CLOCK_STYLES, setClockStyle, type ClockStyle } from '@/lib/focusClock';
import { setFocusBlocking, useFocusBlocking } from '@/lib/focusBlocking';
import { FOCUS_SOUNDS, currentFocusSound, loadFocusSound, setFocusSound, subscribeFocusSound } from '@/lib/focusSounds';

/** The sound chosen to focus to, kept in step everywhere. */
export function useFocusSoundChoice() {
    useEffect(() => { void loadFocusSound(); }, []);
    return useSyncExternalStore(subscribeFocusSound, currentFocusSound, currentFocusSound);
}

/**
 * Focus settings, from the focus page itself: how the clock looks and
 * blocking apps. The same switches as in Settings.
 */
export function FocusSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { lightFeedback } = useHaptics();
    const clock = useClockStyle();
    const blocking = useFocusBlocking();
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Focus settings">
            <SettingsGroup>
                <SettingsRow icon="timer" color="#5E5CE6" label="Clock" choices={CLOCK_STYLES} chosen={clock}
                    onChoose={id => { lightFeedback(); void setClockStyle(id as ClockStyle); }} />
                <SettingsRow icon="hand-left" color="#FF375F" label="Block apps while focusing"
                    toggle={blocking} onToggle={value => { lightFeedback(); void setFocusBlocking(value); }} />
            </SettingsGroup>
        </VoidSheet>
    );
}

/** Sounds to focus to: silence, rain, waves, a deep even noise. One tap plays it. */
export function FocusSoundSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { selectionFeedback } = useHaptics();
    const chosen = useFocusSoundChoice();
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Focus sound">
            <SettingsGroup>
                {FOCUS_SOUNDS.map(sound => (
                    <SettingsRow key={sound.id} icon={sound.icon} color={sound.id === 'off' ? '#8E8E93' : '#0A84FF'} label={sound.label}
                        value={chosen === sound.id ? 'Chosen' : undefined}
                        onPress={() => { selectionFeedback(); void setFocusSound(sound.id); }} />
                ))}
            </SettingsGroup>
            {/* Your own music: opens the app to your library, the focus clock running on.
                Habyss's sound goes quiet so the two never play over each other. */}
            <SettingsGroup title="Your music">
                {MUSIC_APPS.map(app => (
                    <SettingsRow key={app.id} icon="musical-notes" color={app.color} label={app.label}
                        onPress={() => {
                            selectionFeedback();
                            void setFocusSound('off');
                            onClose();
                            void Linking.openURL(app.url).catch(() => Linking.openURL(app.store).catch(() => undefined));
                        }} />
                ))}
            </SettingsGroup>
        </VoidSheet>
    );
}

/** The music apps a focus can be played from: their app if installed, else their App Store page. */
const MUSIC_APPS = [
    { id: 'spotify', label: 'Spotify', color: '#1DB954', url: 'spotify:', store: 'https://apps.apple.com/app/id324684580' },
    { id: 'apple', label: 'Apple Music', color: '#FA2D48', url: 'music://', store: 'https://apps.apple.com/app/id1108187390' },
];

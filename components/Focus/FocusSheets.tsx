import React, { useEffect, useSyncExternalStore } from 'react';
import { Linking } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { useClockStyle } from '@/hooks/useClockStyle';
import { CLOCK_STYLES, setClockStyle, type ClockStyle } from '@/lib/focusClock';
import { FOCUS_SOUNDS, currentFocusSound, loadFocusSound, setFocusSound, subscribeFocusSound } from '@/lib/focusSounds';

/** The sound chosen to focus to, kept in step everywhere. */
export function useFocusSoundChoice() {
    useEffect(() => { void loadFocusSound(); }, []);
    return useSyncExternalStore(subscribeFocusSound, currentFocusSound, currentFocusSound);
}

/** How the clock looks: the same row in Settings → Focus and on the focus page. */
export function FocusClockRow({ label = 'Clock' }: { label?: string }) {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const clock = useClockStyle();
    return (
        <SettingsRow icon="timer" color={t.color.accent} label={label} choices={CLOCK_STYLES} chosen={clock}
            onChoose={id => { lightFeedback(); void setClockStyle(id as ClockStyle); }} />
    );
}

/**
 * What to focus to: a sound of Habyss's (silence, rain, waves, a deep even
 * noise), one tap plays it; or your own music, which opens its app to your
 * library, the focus clock running on, and quiets Habyss's sound so the two
 * never play over each other. The same groups in Settings → Focus and on the
 * focus page.
 */
export function FocusSoundGroups({ onMusic }: { onMusic?: () => void }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const chosen = useFocusSoundChoice();
    return (
        <>
            <SettingsGroup title="Sound">
                {FOCUS_SOUNDS.map(sound => (
                    <SettingsRow key={sound.id} icon={sound.icon} color={sound.id === 'off' ? t.color.textMuted : t.color.cobalt} label={sound.label}
                        value={chosen === sound.id ? 'Chosen' : undefined}
                        onPress={() => { selectionFeedback(); void setFocusSound(sound.id); }} />
                ))}
            </SettingsGroup>
            <SettingsGroup title="Your music">
                {MUSIC_APPS.map(app => (
                    <SettingsRow key={app.id} icon="musical-notes" color={app.color} label={app.label}
                        onPress={() => {
                            selectionFeedback();
                            void setFocusSound('off');
                            onMusic?.();
                            void Linking.openURL(app.url).catch(() => Linking.openURL(app.store).catch(() => undefined));
                        }} />
                ))}
            </SettingsGroup>
        </>
    );
}

/** Focus settings, from the focus page itself: how the clock looks. Focus always blocks your apps (App blocking). */
export function FocusSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Focus settings">
            <SettingsGroup>
                <FocusClockRow />
            </SettingsGroup>
        </VoidSheet>
    );
}

/** Sounds and music to focus to, from the focus page. */
export function FocusSoundSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Focus sound">
            <FocusSoundGroups onMusic={onClose} />
        </VoidSheet>
    );
}

/** The music apps a focus can be played from: their app if installed, else their App Store page. Their own brand colours. */
const MUSIC_APPS = [
    { id: 'spotify', label: 'Spotify', color: '#1DB954', url: 'spotify:', store: 'https://apps.apple.com/app/id324684580' },
    { id: 'apple', label: 'Apple Music', color: '#FA2D48', url: 'music://', store: 'https://apps.apple.com/app/id1108187390' },
];

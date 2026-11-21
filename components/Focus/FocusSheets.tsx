import React, { useEffect, useSyncExternalStore } from 'react';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { useClockStyle } from '@/hooks/useClockStyle';
import { CLOCK_STYLES, setClockStyle, type ClockStyle } from '@/lib/focusClock';
import { MUSIC_SOURCES, currentFocusMusic, loadFocusMusic, setFocusMusicSource, subscribeFocusMusic } from '@/lib/focusMusic';
import { currentFocusBackground, loadFocusBackground, setFocusBackground, subscribeFocusBackground, type FocusBackground } from '@/lib/focusBackground';

/** Focus music, on or off and where it comes from, kept in step everywhere (lib/focusMusic.ts). */
export function useFocusMusic() {
    useEffect(() => { void loadFocusMusic(); }, []);
    return useSyncExternalStore(subscribeFocusMusic, currentFocusMusic, currentFocusMusic);
}

/** Focus's background, kept in step everywhere (lib/focusBackground.ts). */
export function useFocusBackground(): FocusBackground {
    useEffect(() => { void loadFocusBackground(); }, []);
    return useSyncExternalStore(subscribeFocusBackground, currentFocusBackground, currentFocusBackground);
}

/** The landscape (Home's scene, the temple for the hourglass) or none, plain black: the same row in Settings → Focus and on the focus page. */
export function FocusBackgroundRow() {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const background = useFocusBackground();
    return (
        <SettingsRow icon="image" color={t.color.accent} label="Background"
            choices={[{ id: 'landscape', label: 'Landscape' }, { id: 'plain', label: 'None' }]} chosen={background}
            onChoose={id => { lightFeedback(); setFocusBackground(id as FocusBackground); }} />
    );
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
 * Where focus music comes from: Habyss's own track, or Spotify or Apple Music
 * (choosing one opens it). The music button on the focus page turns it on or off.
 * The same group in Settings → Focus and in the focus page's settings.
 */
export function FocusMusicGroup() {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const music = useFocusMusic();
    return (
        <SettingsGroup title="Music">
            {MUSIC_SOURCES.map(source => (
                <SettingsRow key={source.id} icon={source.icon} color={source.color ?? t.color.accent} label={source.label}
                    value={music.source === source.id ? 'Chosen' : undefined}
                    onPress={() => { selectionFeedback(); setFocusMusicSource(source.id); }} />
            ))}
        </SettingsGroup>
    );
}

/** Focus settings, from the focus page itself: the clock, the background, and where the music comes from. */
export function FocusSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Focus settings">
            <SettingsGroup>
                <FocusClockRow />
                <FocusBackgroundRow />
            </SettingsGroup>
            <FocusMusicGroup />
        </VoidSheet>
    );
}

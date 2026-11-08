import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { vs } from '@/theme/scale';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { ALL_SHARED, SHARING_LABELS, getSharing, setSharing, type Sharing } from '@/lib/profileSync';
import { PREF_LABELS, getNotificationPrefs, setNotificationPrefs, type NotificationPrefs } from '@/lib/notificationPrefs';
import { styles } from '@/styles/screens/sharing.styles';
import { TimeRow } from '@/components/ui/TimeRow';
import { FeedService } from '@/lib/feedService';

/**
 * What friends see of you, and what they are allowed to interrupt you about.
 *
 * Two lists rather than one switch. "Everything or nothing" is not a privacy
 * setting, it is an ultimatum — somebody may happily show their streak and
 * never their face, and there is no reason the app should make them choose.
 *
 * Turning something off takes it off the server too, rather than hiding it in
 * an interface that might be older than the switch.
 */
export default function SharingScreen() {
    const router = useRouter();
    const { primary: accent } = useAccentGradient();
    const { selectionFeedback } = useHaptics();

    const [sharing, setSharingState] = useState<Sharing | null>(null);
    const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
    // Your day card goes to the feed at this time each day (the server posts it).
    const [post, setPost] = useState<{ time: string; enabled: boolean }>({ time: '21:00', enabled: true });
    useEffect(() => { void FeedService.shareSettings().then(found => { if (found) setPost(found); }); }, []);
    const changePost = (change: { time?: string; enabled?: boolean }) => {
        selectionFeedback();
        setPost(current => ({ ...current, ...change }));
        void FeedService.setShareSettings(change);
    };

    useEffect(() => {
        let alive = true;
        Promise.all([getSharing(), getNotificationPrefs()])
            .then(([found, told]) => { if (alive) { setSharingState(found); setPrefs(told); } })
            .catch(() => { if (alive) setSharingState(ALL_SHARED); });
        return () => { alive = false; };
    }, []);

    const flip = useCallback(async (key: keyof Sharing, value: boolean) => {
        selectionFeedback();
        setSharingState(current => (current ? { ...current, [key]: value } : current));
        setSharingState(await setSharing({ [key]: value }));
    }, [selectionFeedback]);

    const tell = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
        selectionFeedback();
        setPrefs(current => (current ? { ...current, [key]: value } : current));
        setPrefs(await setNotificationPrefs({ [key]: value }));
    }, [selectionFeedback]);

    if (!sharing || !prefs) {
        return (
            <SheetScreen title="Friends & sharing" onBack={() => router.back()}>
                <ActivityIndicator color={accent} style={{ marginTop: vs(40) }} />
            </SheetScreen>
        );
    }

    return (
        <SheetScreen title="Friends & sharing" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Daily post">
                    <SettingsRow icon="newspaper" color={accent} label="Post my day to the feed"
                        toggle={post.enabled} onToggle={value => changePost({ enabled: value })} />
                    {post.enabled ? (
                        <TimeRow icon="time" label="At" value={post.time} accent={accent} onChange={time => changePost({ time })} />
                    ) : null}
                </SettingsGroup>

                {/* Only accepted friends ever see any of this. */}
                <SettingsGroup title="Friends see">
                    {SHARING_LABELS.map(item => (
                        <SettingsRow key={item.id} icon={SEE_ICON[item.id].icon} color={SEE_ICON[item.id].color} label={item.label}
                            toggle={sharing[item.id]} onToggle={value => void flip(item.id, value)} />
                    ))}
                </SettingsGroup>

                <SettingsGroup title="Tell me when">
                    {PREF_LABELS.map(item => (
                        <SettingsRow key={item.id} icon={TELL_ICON[item.id].icon} color={TELL_ICON[item.id].color} label={item.label}
                            toggle={prefs[item.id]} onToggle={value => void tell(item.id, value)} />
                    ))}
                </SettingsGroup>

                <SettingsGroup>
                    <SettingsRow icon="hand-left" color="#8A8A94" label="Blocked" onPress={() => router.push('/(root)/blocked')} />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

const SEE_ICON: Record<keyof Sharing, { icon: string; color: string }> = {
    name: { icon: 'person', color: '#5B8CFF' },
    photo: { icon: 'image', color: '#BF5AF2' },
    bio: { icon: 'text', color: '#64D2FF' },
    progress: { icon: 'trending-up', color: '#30D158' },
    habits: { icon: 'repeat', color: '#FF9F0A' },
    tasks: { icon: 'checkmark-done', color: '#FF453A' },
};
const TELL_ICON: Record<Exclude<keyof NotificationPrefs, 'dayGuide' | 'alarms'>, { icon: string; color: string }> = {
    sharedDone: { icon: 'checkmark-circle', color: '#30D158' },
    shareOffers: { icon: 'gift', color: '#BF5AF2' },
    reactions: { icon: 'heart', color: '#FF375F' },
    friendRequests: { icon: 'person-add', color: '#5B8CFF' },
};

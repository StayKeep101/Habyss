import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import { useAppSettings } from '@/context/AppSettingsContext';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { authenticateAppLock } from '@/lib/biometricLock';
import { IconButton } from '@/components/ui/IconButton';

/** Covers native sheets too, and keeps navigation mounted after unlocking. */
export const BiometricGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAppLockEnabled, isLoaded, appLockVerifiedAt } = useAppSettings();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [locked, setLocked] = useState(true);
    const [obscured, setObscured] = useState(AppState.currentState !== 'active');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasUnlocked, setHasUnlocked] = useState(false);
    const authenticating = useRef(false);
    const appState = useRef(AppState.currentState);
    const backgroundGeneration = useRef(0);
    const needsAuthentication = useRef(true);
    const enabled = useRef(isAppLockEnabled);
    const mounted = useRef(true);
    useEffect(() => { enabled.current = isAppLockEnabled; }, [isAppLockEnabled]);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    const authenticate = useCallback(async () => {
        if (authenticating.current || appState.current !== 'active' || !enabled.current) return;
        authenticating.current = true;
        const generation = backgroundGeneration.current;
        setBusy(true);
        setError(null);
        try {
            const result = await authenticateAppLock();
            if (!mounted.current || generation !== backgroundGeneration.current) return;
            if (result.success && enabled.current) {
                needsAuthentication.current = false;
                setLocked(false);
                setObscured(false);
                setHasUnlocked(true);
            } else if (!result.success) {
                setError(['user_cancel', 'system_cancel', 'app_cancel'].includes(result.error)
                    ? 'Habyss stays locked until you authenticate.'
                    : 'Couldn’t verify you. Try again or use your device passcode.');
            }
        } finally {
            authenticating.current = false;
            if (mounted.current) setBusy(false);
        }
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        // This effect synchronizes the persisted lock policy with native auth;
        // defer neither the cover nor the authentication behind a UI interaction.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(null);
        if (!isAppLockEnabled || appLockVerifiedAt > 0) {
            // Enabling the switch already verified the owner; don’t prompt twice.
            setLocked(false);
            needsAuthentication.current = false;
            setHasUnlocked(true);
        } else {
            needsAuthentication.current = true;
            setLocked(true);
            void authenticate();
        }
    }, [isLoaded, isAppLockEnabled, appLockVerifiedAt, authenticate]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', next => {
            appState.current = next;
            if (!enabled.current) return;
            if (next === 'background') {
                backgroundGeneration.current++;
                needsAuthentication.current = true;
                setLocked(true);
                setObscured(true);
                setError(null);
            } else if (next === 'inactive') {
                // Face ID and Apple sign-in create brief inactive transitions.
                // Cover the app switcher without starting a competing prompt.
                setObscured(true);
            } else if (next === 'active') {
                setObscured(false);
                if (needsAuthentication.current) void authenticate();
            }
        });
        return () => sub.remove();
    }, [authenticate]);

    const covered = !isLoaded || (isAppLockEnabled && (locked || obscured));
    // Like Phantom: a plain dark screen, and the system's Face ID prompt on
    // top of it — no title, no paragraph. If the prompt is dismissed, one
    // matte lock button brings it back.
    const lockScreen = <View style={[styles.container, { backgroundColor: colors.background }]}>
        {isLoaded && error && !busy ? (
            <IconButton icon="lock-closed" label="Unlock Habyss" onPress={authenticate} diameter={56} size={24} />
        ) : null}
    </View>;

    // On first launch, do not render private content while settings are loading.
    if (!isLoaded || (isAppLockEnabled && !hasUnlocked)) return lockScreen;
    return <View style={styles.flex}>
        <View style={styles.flex} pointerEvents={covered ? 'none' : 'auto'} accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>{children}</View>
        <Modal visible={covered} animationType="none" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => undefined}>
            {lockScreen}
        </Modal>
    </View>;
};
const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { setPasscode } from '@/lib/appPasscode';
import { PasscodePad } from './PasscodePad';

/**
 * Choosing Habyss's passcode: type four digits, then once more to be sure.
 * Full screen, the same keypad the lock uses, so it looks the same both times.
 */
export function PasscodeSetup({ visible, onDone, onCancel }: { visible: boolean; onDone: () => void; onCancel: () => void }) {
    const t = useTokens();
    const { successFeedback } = useHaptics();
    const [first, setFirst] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => { if (visible) { setFirst(null); setMessage(null); } }, [visible]);

    const onCode = async (code: string) => {
        if (first === null) { setFirst(code); setMessage(null); return true; }
        if (code !== first) { setFirst(null); setMessage('They didn’t match. Start again.'); return false; }
        await setPasscode(code);
        successFeedback();
        onDone();
        return true;
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
            <View style={[styles.screen, { backgroundColor: t.color.background }]}>
                {/* A new key each step, so the dots start empty. */}
                <PasscodePad key={first === null ? 'first' : 'again'} title={first === null ? 'Choose a passcode' : 'Type it again'}
                    subtitle={first === null ? 'For when Face ID doesn’t work' : 'To be sure'} message={message} onCode={onCode}
                    footer={<AppButton label="Cancel" variant="ghost" onPress={onCancel} />} />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });

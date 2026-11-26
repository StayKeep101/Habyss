import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { onAccountChange } from '@/lib/account';
import { answerConnect, connectRequest, mcpAvailable } from '@/lib/mcpKeys';
import { styles } from '@/styles/screens/connect.styles';

type Step =
    | { kind: 'loading' }
    | { kind: 'signedOut' }
    | { kind: 'expired' }
    | { kind: 'ask'; client: string }
    | { kind: 'done'; client: string; allowed: boolean }
    | { kind: 'error'; message: string };

/**
 * "Open Habyss" on Claude's or ChatGPT's sign-in page lands here
 * (habyss://connect?authorization_id=…). Already signed in, so one tap:
 * Allow, then back to the assistant, whose page carries on by itself.
 */
export default function ConnectScreen() {
    const t = useTokens();
    const { lightFeedback, successFeedback } = useHaptics();
    const { authorization_id: id } = useLocalSearchParams<{ authorization_id?: string }>();
    const [step, setStep] = useState<Step>({ kind: 'loading' });
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!id) return setStep({ kind: 'expired' });
        if (!(await mcpAvailable())) return setStep({ kind: 'signedOut' });
        const request = await connectRequest(id);
        setStep(request ? { kind: 'ask', client: request.client } : { kind: 'expired' });
    }, [id]);
    useEffect(() => {
        void load();
        return onAccountChange(() => void load());
    }, [load]);

    const answer = async (client: string, allow: boolean) => {
        if (!id || busy) return;
        lightFeedback();
        setBusy(true);
        try {
            await answerConnect(id, allow);
            if (allow) successFeedback();
            setStep({ kind: 'done', client, allowed: allow });
        } catch (error) {
            setStep({ kind: 'error', message: error instanceof Error ? error.message : 'Start again in the assistant.' });
        } finally {
            setBusy(false);
        }
    };

    const close = () => router.back();
    return (
        <SheetScreen title="" onBack={close}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {step.kind === 'signedOut' ? (
                    <EmptyState icon="person-circle-outline" title="Sign in first"
                        message="Your plan lives in your account. Sign in, then tap Open Habyss again."
                        actionLabel="Sign in" onAction={() => router.push('/(root)/account')} />
                ) : null}
                {step.kind === 'expired' ? (
                    <EmptyState icon="time-outline" title="This request expired"
                        message="Start again in Claude or ChatGPT." actionLabel="Done" onAction={close} />
                ) : null}
                {step.kind === 'error' ? (
                    <EmptyState icon="alert-circle-outline" title="Not connected" message={step.message} actionLabel="Done" onAction={close} />
                ) : null}
                {step.kind === 'done' ? (
                    <EmptyState icon={step.allowed ? 'checkmark-circle-outline' : 'close-circle-outline'}
                        title={step.allowed ? 'Connected' : 'Not connected'}
                        message={step.allowed ? `Go back to ${step.client}. It's ready.` : `${step.client} can't see your plan.`}
                        actionLabel="Done" onAction={close} />
                ) : null}
                {step.kind === 'ask' ? (
                    <>
                        <View style={styles.head}>
                            <Image source={require('@/assets/images/habyss-mark.png')} style={styles.mark} resizeMode="contain"
                                accessibilityIgnoresInvertColors accessibilityLabel="Habyss" />
                            <Text variant="title" align="center">{`Allow ${step.client} to use Habyss?`}</Text>
                        </View>
                        <SettingsGroup title="It can">
                            <SettingsRow icon="eye" color={t.color.accent} label="See your plan, habits and tasks" />
                            <SettingsRow icon="add-circle" color={t.color.success} label="Add tasks and habits" />
                            <SettingsRow icon="checkmark-circle" color={t.color.warning} label="Tick things done" />
                        </SettingsGroup>
                        <View style={styles.actions}>
                            <AppButton variant="primary" label={busy ? 'Allowing…' : 'Allow'} disabled={busy}
                                onPress={() => void answer(step.client, true)} />
                            <AppButton variant="ghost" label="Don't allow" disabled={busy}
                                onPress={() => void answer(step.client, false)} />
                        </View>
                    </>
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}

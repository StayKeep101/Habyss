import React, { useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { AppButton } from '@/components/ui/AppButton';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { copyText } from '@/lib/copyText';
import { Control, FontFamily, Spacing } from '@/theme/designSystem';

export type Assistant = 'Claude' | 'ChatGPT';

/** Where each assistant adds a connection, and the three steps there. */
const GUIDE: Record<Assistant, { url: string; steps: string[] }> = {
    Claude: {
        url: 'https://claude.ai/settings/connectors',
        steps: ['Tap Add custom connector', 'Name it Habyss', 'Paste, then Add'],
    },
    ChatGPT: {
        url: 'https://chatgpt.com/#settings/Connectors',
        steps: ['Advanced: turn on Developer mode', 'Tap Create, name it Habyss', 'Paste, choose No authentication, then Create'],
    },
};

/**
 * A new assistant connection, shown the one time its address can be: one
 * button copies it and opens the assistant's connector settings, then three
 * steps to paste it. The address itself stays out of sight.
 */
export function McpKeySheet({ address, assistant, onClose }: { address: string | null; assistant: Assistant; onClose: () => void }) {
    const t = useTokens();
    const { successFeedback } = useHaptics();
    const [copied, setCopied] = useState(false);
    const guide = GUIDE[assistant];
    const close = () => { setCopied(false); onClose(); };
    const copyAndOpen = async () => {
        if (!address) return;
        const done = await copyText(address);
        setCopied(done);
        if (!done) return;
        successFeedback();
        await Linking.openURL(guide.url).catch(() => undefined);
    };
    return (
        <VoidSheet visible={!!address} onClose={close} title={`Connect ${assistant}`}
            caption="Your private link. Anyone with it can see and change your plan.">
            <View style={{ gap: t.space.lg }}>
                <View style={{ gap: t.space.md }}>
                    {guide.steps.map((step, index) => (
                        <View key={step} style={[styles.step, { gap: t.space.md }]}>
                            <View style={[styles.number, { backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.full }]}>
                                <Text style={[t.type.caption, styles.strong, { color: t.color.textPrimary }]}>{index + 1}</Text>
                            </View>
                            <Text style={[t.type.body, styles.grow, { color: t.color.textPrimary }]}>{step}</Text>
                        </View>
                    ))}
                </View>
                <View style={{ gap: t.space.xs }}>
                    <AppButton variant="primary" label={copied ? `Copied · open ${assistant}` : `Copy link & open ${assistant}`}
                        icon={copied ? 'checkmark' : 'copy-outline'} onPress={() => void copyAndOpen()} />
                    <AppButton variant="ghost" label="Share link" icon="share-outline"
                        onPress={() => { if (address) void Share.share({ message: address }).catch(() => undefined); }} />
                </View>
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    step: { flexDirection: 'row', alignItems: 'center' },
    number: { width: Control.icon + Spacing.sm, height: Control.icon + Spacing.sm, alignItems: 'center', justifyContent: 'center' },
    grow: { flex: 1 },
    strong: { fontFamily: FontFamily.semibold },
});

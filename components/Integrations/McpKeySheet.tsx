import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppButton } from '@/components/ui/AppButton';
import { useTokens } from '@/hooks/useTokens';
import { copyText } from '@/lib/copyText';
import { FontFamily } from '@/theme/designSystem';

/**
 * A new assistant key, shown the one time it can be: the address to paste
 * into the assistant, Copy and Share, and where to paste it.
 */
export function McpKeySheet({ address, onClose }: { address: string | null; onClose: () => void }) {
    const t = useTokens();
    const [copied, setCopied] = useState(false);
    const close = () => { setCopied(false); onClose(); };
    return (
        <VoidSheet visible={!!address} onClose={close} title="Connect your assistant"
            caption="Shown once. Anyone with this address can see and change your habits and tasks, so keep it to yourself.">
            <View style={{ gap: t.space.md }}>
                <MatteSurface radius={t.radius.md} level="control" style={{ padding: t.space.md }}>
                    <Text selectable style={[t.type.caption, styles.mono, { color: t.color.textPrimary }]}>{address}</Text>
                </MatteSurface>
                <View style={[styles.row, { gap: t.space.sm }]}>
                    <AppButton label={copied ? 'Copied' : 'Copy address'} icon={copied ? 'checkmark' : 'copy-outline'} fullWidth={false} style={styles.flex}
                        onPress={() => { if (address) void copyText(address).then(setCopied); }} />
                    <AppButton label="Share" icon="share-outline" fullWidth={false} style={styles.flex}
                        onPress={() => { if (address) void Share.share({ message: address }).catch(() => undefined); }} />
                </View>
                <View style={{ gap: t.space.xs }}>
                    <Text style={[t.type.bodySmall, styles.strong, { color: t.color.textPrimary }]}>Where to paste it</Text>
                    <Text style={[t.type.caption, { color: t.color.textMuted }]}>Claude: Settings → Connectors → Add custom connector.</Text>
                    <Text style={[t.type.caption, { color: t.color.textMuted }]}>ChatGPT: Settings → Connectors → Create (developer mode).</Text>
                    <Text style={[t.type.caption, { color: t.color.textMuted }]}>Claude Code: claude mcp add --transport http habyss followed by the address.</Text>
                    <Text style={[t.type.caption, { color: t.color.textSubtle }]}>Then ask things like "What's on my plan today?" or "Add a task to call the dentist tomorrow at 10".</Text>
                </View>
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    mono: { fontFamily: FontFamily.medium },
    row: { flexDirection: 'row' },
    flex: { flex: 1 },
    strong: { fontFamily: FontFamily.semibold },
});

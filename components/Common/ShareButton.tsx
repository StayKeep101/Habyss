import React, { useState } from 'react';
import { ActivityIndicator, Alert, Share, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccentGradient } from '@/constants/AccentContext';

export interface ShareSummary { title: string; value: string; subtitle: string; }

export const ShareButton = ({ summary, onPress, variant = 'share' }: {
    summary?: ShareSummary;
    onPress?: () => void;
    variant?: 'share' | 'friend';
}) => {
    const { primary } = useAccentGradient();
    const [busy, setBusy] = useState(false);
    const share = async () => {
        if (busy) return;
        if (onPress) { onPress(); return; }
        if (!summary) return;
        setBusy(true);
        try {
            await Share.share({ title: summary.title, message: `${summary.title}: ${summary.value}\n${summary.subtitle}\n\nTracked with Habyss` });
        } catch {
            Alert.alert('Unable to share', 'Please try sharing again.');
        } finally { setBusy(false); }
    };
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={variant === 'friend' ? 'Add friend' : 'Share progress'} disabled={busy}
            onPress={share} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: primary + '20', alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color={primary} size="small" /> : <Ionicons name={variant === 'friend' ? 'person-add-outline' : 'share-outline'} size={20} color={primary} />}
        </TouchableOpacity>
    );
};

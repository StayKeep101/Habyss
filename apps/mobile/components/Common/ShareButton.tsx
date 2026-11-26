import { useState } from 'react';
import { Alert, Share } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';

export interface ShareSummary { title: string; value: string; subtitle: string; }

export const ShareButton = ({ summary, onPress, variant = 'share' }: {
    summary?: ShareSummary;
    onPress?: () => void;
    variant?: 'share' | 'friend';
}) => {
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
        <IconButton icon={variant === 'friend' ? 'person-add-outline' : 'share-outline'}
            label={variant === 'friend' ? 'Add friend' : 'Share progress'} onPress={share} loading={busy} />
    );
};

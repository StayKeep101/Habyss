import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface SyncStatusBadgeProps {
    status: 'idle' | 'syncing' | 'error';
    lastSync?: string;
    serviceName?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
    status,
    lastSync,
    serviceName,
}) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'abyss'];

    const getStatusColor = () => {
        switch (status) {
            case 'idle':
                return colors.success;
            case 'syncing':
                return colors.warning;
            case 'error':
                return colors.error;
            default:
                return colors.textSecondary;
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'idle':
                return 'checkmark-circle';
            case 'syncing':
                return 'sync';
            case 'error':
                return 'alert-circle';
            default:
                return 'help-circle';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'idle':
                return 'Synced';
            case 'syncing':
                return 'Syncing...';
            case 'error':
                return 'Sync failed';
            default:
                return 'Unknown';
        }
    };

    const getLastSyncText = () => {
        if (!lastSync) return '';

        const syncDate = new Date(lastSync);
        const now = new Date();
        const diffMs = now.getTime() - syncDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    return (
        <View className="flex-row items-center">
            <Ionicons
                name={getStatusIcon() as any}
                size={16}
                color={getStatusColor()}
            />
            <Text
                className="text-xs ml-1 font-medium"
                style={{ color: getStatusColor() }}
            >
                {getStatusText()}
            </Text>
            {lastSync && status === 'idle' && (
                <Text className="text-xs ml-1" style={{ color: colors.textSecondary }}>
                    • {getLastSyncText()}
                </Text>
            )}
        </View>
    );
};

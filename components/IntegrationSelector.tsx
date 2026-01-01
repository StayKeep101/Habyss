import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export interface IntegrationOption {
    serviceName: string;
    displayName: string;
    icon: string;
    dataTypes: {
        value: string;
        label: string;
        unit: string;
        description: string;
    }[];
    isConnected: boolean;
}

interface IntegrationSelectorProps {
    selectedIntegrations: { serviceName: string; dataType: string }[];
    onToggleIntegration: (serviceName: string, dataType: string) => void;
    availableIntegrations: IntegrationOption[];
}

export const IntegrationSelector: React.FC<IntegrationSelectorProps> = ({
    selectedIntegrations,
    onToggleIntegration,
    availableIntegrations,
}) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'abyss'];

    const isSelected = (serviceName: string, dataType: string) => {
        return selectedIntegrations.some(
            (si) => si.serviceName === serviceName && si.dataType === dataType
        );
    };

    return (
        <View className="mb-6">
            <Text className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>
                Linked Data Sources
            </Text>
            <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                Connect this habit to your integration data for automatic tracking
            </Text>

            <ScrollView className="max-h-96">
                {availableIntegrations.map((integration) => (
                    <View
                        key={integration.serviceName}
                        className="mb-4 p-4 rounded-2xl"
                        style={{ backgroundColor: colors.surfaceSecondary }}
                    >
                        <View className="flex-row items-center mb-3">
                            <View
                                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                style={{ backgroundColor: colors.primary + '20' }}
                            >
                                <Ionicons name={integration.icon as any} size={20} color={colors.primary} />
                            </View>
                            <View className="flex-1">
                                <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                                    {integration.displayName}
                                </Text>
                                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                                    {integration.isConnected ? 'Connected' : 'Not connected'}
                                </Text>
                            </View>
                        </View>

                        {integration.isConnected ? (
                            <View className="space-y-2">
                                {integration.dataTypes.map((dataType) => {
                                    const selected = isSelected(integration.serviceName, dataType.value);

                                    return (
                                        <TouchableOpacity
                                            key={dataType.value}
                                            className="p-3 rounded-xl flex-row items-center justify-between"
                                            style={{
                                                backgroundColor: selected
                                                    ? colors.primary + '20'
                                                    : colors.background,
                                            }}
                                            onPress={() => onToggleIntegration(integration.serviceName, dataType.value)}
                                        >
                                            <View className="flex-1 mr-3">
                                                <Text
                                                    className="font-medium"
                                                    style={{ color: selected ? colors.primary : colors.textPrimary }}
                                                >
                                                    {dataType.label}
                                                </Text>
                                                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                                    {dataType.description}
                                                </Text>
                                            </View>
                                            <View
                                                className="w-6 h-6 rounded-full items-center justify-center"
                                                style={{
                                                    backgroundColor: selected ? colors.primary : colors.border,
                                                }}
                                            >
                                                {selected && (
                                                    <Ionicons name="checkmark" size={16} color="white" />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <Text className="text-sm italic" style={{ color: colors.textSecondary }}>
                                Connect this integration in Settings to use it with habits
                            </Text>
                        )}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

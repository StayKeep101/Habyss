import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';

interface ColorPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectColor: (color: string) => void;
    currentColor: string;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
    visible,
    onClose,
    onSelectColor,
    currentColor,
}) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'abyss'];
    const [hexInput, setHexInput] = useState(currentColor.replace('#', ''));
    const [selectedHue, setSelectedHue] = useState(0);

    const hueToHex = (hue: number): string => {
        const h = hue / 360;
        const s = 1;
        const v = 1;

        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        let r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
            default: r = 0; g = 0; b = 0;
        }

        const toHex = (n: number) => {
            const hex = Math.round(n * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const handleConfirm = () => {
        const finalColor = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
        if (/^#[0-9A-F]{6}$/i.test(finalColor)) {
            onSelectColor(finalColor);
            onClose();
        }
    };

    const handleHueSelect = (hue: number) => {
        setSelectedHue(hue);
        const hexColor = hueToHex(hue);
        setHexInput(hexColor.replace('#', ''));
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View className="rounded-t-[40px] pb-10" style={{ backgroundColor: colors.background, maxHeight: '80%' }}>
                    {/* Header */}
                    <View className="flex-row justify-between items-center px-6 pt-6 pb-4 border-b" style={{ borderColor: colors.border }}>
                        <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                            Custom Color
                        </Text>
                        <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceSecondary }}>
                            <Ionicons name="close" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="px-6 py-6">
                        {/* Color Preview */}
                        <View className="items-center mb-6">
                            <View
                                className="w-32 h-32 rounded-3xl border-4 mb-4"
                                style={{
                                    backgroundColor: hexInput.startsWith('#') ? hexInput : `#${hexInput}`,
                                    borderColor: colors.border
                                }}
                            />
                            <Text className="text-sm" style={{ color: colors.textSecondary }}>
                                Preview
                            </Text>
                        </View>

                        {/* Hex Input */}
                        <View className="mb-6">
                            <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>
                                HEX CODE
                            </Text>
                            <View className="flex-row items-center rounded-2xl border px-4" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                                <Text className="text-lg font-bold" style={{ color: colors.textSecondary }}>#</Text>
                                <TextInput
                                    value={hexInput}
                                    onChangeText={(text) => setHexInput(text.toUpperCase())}
                                    placeholder="6B46C1"
                                    placeholderTextColor={colors.textTertiary}
                                    maxLength={6}
                                    autoCapitalize="characters"
                                    className="flex-1 py-4 px-2 text-lg font-semibold"
                                    style={{ color: colors.textPrimary }}
                                />
                            </View>
                        </View>

                        {/* Hue Selector */}
                        <View className="mb-6">
                            <Text className="text-sm font-semibold mb-3" style={{ color: colors.textSecondary }}>
                                QUICK SELECT
                            </Text>
                            <View className="h-12 rounded-full overflow-hidden mb-2">
                                <LinearGradient
                                    colors={[
                                        '#FF0000', '#FF7F00', '#FFFF00', '#00FF00',
                                        '#0000FF', '#4B0082', '#9400D3', '#FF0000'
                                    ]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    className="flex-1"
                                />
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                {[0, 30, 60, 120, 180, 240, 270, 300, 330].map((hue) => (
                                    <TouchableOpacity
                                        key={hue}
                                        onPress={() => handleHueSelect(hue)}
                                        className="w-10 h-10 rounded-full border-2"
                                        style={{
                                            backgroundColor: hueToHex(hue),
                                            borderColor: selectedHue === hue ? colors.textPrimary : 'transparent'
                                        }}
                                    />
                                ))}
                            </ScrollView>
                        </View>

                        {/* Confirm Button */}
                        <TouchableOpacity
                            onPress={handleConfirm}
                            className="py-4 rounded-2xl items-center"
                            style={{ backgroundColor: colors.primary }}
                        >
                            <Text className="text-lg font-bold text-white">Confirm Color</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

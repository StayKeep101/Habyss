import { useAccentGradient } from '@/constants/AccentContext';
import { FontFamily } from '@/constants/DesignSystem';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { SettingsModal } from '@/components/SettingsModal';

interface ScrollPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (value: string) => void;
    title: string;
    items: string[];
    selectedValue?: string;
}

/**
 * Simple option list.
 *
 * This used to render a FlatList inside SettingsModal, which already wraps its
 * children in a ScrollView. React Native warns that VirtualizedLists must never
 * be nested inside a plain ScrollView with the same orientation, and the wheel
 * scrolled unpredictably as a result. The option sets here are short, so a plain
 * mapped list is both correct and easier to tap.
 */
export const ScrollPickerModal: React.FC<ScrollPickerModalProps> = ({ visible, onClose, onSelect, title, items, selectedValue }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { foreground: accent } = useAccentGradient();
    const isLight = theme === 'light';
    const { selectionFeedback } = useHaptics();

    if (!visible) return null;

    return (
        <SettingsModal visible={visible} onClose={onClose} title={title}>
            <View style={styles.list}>
                {items.map((item) => {
                    const isSelected = item === selectedValue;
                    return (
                        <TouchableOpacity
                            key={item}
                            activeOpacity={0.8}
                            style={[
                                styles.row,
                                {
                                    backgroundColor: isSelected
                                        ? accent + '1A'
                                        : isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                                    borderColor: isSelected ? accent + '55' : 'transparent',
                                },
                            ]}
                            onPress={() => {
                                selectionFeedback();
                                onSelect(item);
                            }}
                        >
                            <Text
                                style={[
                                    styles.rowText,
                                    { color: isSelected ? accent : colors.textPrimary },
                                ]}
                            >
                                {item}
                            </Text>
                            {isSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color={accent} />
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </SettingsModal>
    );
};

const styles = StyleSheet.create({
    list: {
        paddingVertical: 4,
        gap: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
    },
    rowText: {
        fontSize: 16,
        fontFamily: FontFamily.medium,
    },
});

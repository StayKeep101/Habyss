import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
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

const ITEM_HEIGHT = 50;

export const ScrollPickerModal: React.FC<ScrollPickerModalProps> = ({ visible, onClose, onSelect, title, items, selectedValue }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();

    if (!visible) return null;

    return (
        <SettingsModal visible={visible} onClose={onClose} title={title}>
            <View style={styles.pickerContainer}>
                <FlatList
                    data={items}
                    keyExtractor={(item) => item}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    contentContainerStyle={{ paddingVertical: 100 }}
                    getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                    initialScrollIndex={items.indexOf(selectedValue || '') > -1 ? items.indexOf(selectedValue || '') : 0}
                    renderItem={({ item }) => {
                        const isSelected = item === selectedValue;
                        return (
                            <TouchableOpacity
                                style={[styles.item, { height: ITEM_HEIGHT }]}
                                onPress={() => {
                                    selectionFeedback();
                                    onSelect(item);
                                }}
                            >
                                <Text style={[
                                    styles.itemText,
                                    {
                                        color: isSelected ? colors.primary : colors.textSecondary,
                                        fontWeight: isSelected ? '700' : '400',
                                        fontSize: isSelected ? 20 : 16
                                    }
                                ]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                />

                {/* Selection Highlight Overlay */}
                <View style={[styles.selectionOverlay, { borderColor: colors.primary + '30' }]} pointerEvents="none" />
            </View>
        </SettingsModal>
    );
};

const styles = StyleSheet.create({
    pickerContainer: {
        height: 300,
        position: 'relative',
    },
    item: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemText: {
        fontFamily: 'Lexend',
    },
    selectionOverlay: {
        position: 'absolute',
        top: 100 + ITEM_HEIGHT / 2,
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        marginTop: 50,
        alignSelf: 'center',
        pointerEvents: 'none',
        transform: [{ translateY: -ITEM_HEIGHT / 2 }]
    }
});

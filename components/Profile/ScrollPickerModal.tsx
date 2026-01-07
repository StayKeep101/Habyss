import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, FlatList, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';

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
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />

                <BlurView intensity={theme === 'dark' ? 20 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={styles.blurContainer}>
                    <View style={[styles.container, { backgroundColor: theme === 'dark' ? '#1A1A1A' : '#ffffff' }]}>
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Text style={{ color: colors.primary, fontFamily: 'Lexend_600SemiBold' }}>Done</Text>
                            </TouchableOpacity>
                        </View>

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
                    </View>
                </BlurView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    blurContainer: {
        width: '100%',
    },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        height: 400,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    pickerContainer: {
        flex: 1,
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
        top: 100 + ITEM_HEIGHT / 2, // approximate center alignment adjustment
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        marginTop: 50, // half padding
        alignSelf: 'center',
        pointerEvents: 'none',
        transform: [{ translateY: -ITEM_HEIGHT / 2 }]
    }
});

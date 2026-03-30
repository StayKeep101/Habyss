import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Platform,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { AppButton } from '@/components/Common/AppButton';

export type InputMode = 'date' | 'time' | 'numeric' | 'text';

interface UnifiedInputModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (value: any) => void;
    initialValue: any;
    mode: InputMode;
    title: string;
    unit?: string;
    options?: { label: string; value: string }[];
    color?: string;
    showClear?: boolean;
    onClear?: () => void;
}

export const UnifiedInputModal: React.FC<UnifiedInputModalProps> = ({
    visible,
    onClose,
    onConfirm,
    initialValue,
    mode,
    title,
    unit,
    options,
    color = '#6B46C1',
    showClear = false,
    onClear,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    const [currentValue, setCurrentValue] = useState(initialValue);

    useEffect(() => {
        if (visible) {
            setCurrentValue(initialValue);
        }
    }, [visible, initialValue]);

    const handleConfirm = () => {
        onConfirm(currentValue);
        onClose();
    };

    const handleClear = () => {
        onClear?.();
        onClose();
    };

    const renderDateInput = () => (
        <View style={styles.dateWrap}>
            <DateTimePicker
                value={currentValue instanceof Date ? currentValue : new Date()}
                mode={mode === 'date' ? 'date' : 'time'}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                    if (date) setCurrentValue(date);
                }}
                textColor={colors.textPrimary}
                style={{ width: '100%', height: 220 }}
            />
        </View>
    );

    const renderNumericInput = () => (
        <View style={styles.numericWrap}>
            <TouchableOpacity
                onPress={() => setCurrentValue(Math.max(0, (Number(currentValue) || 0) - 1))}
                style={[styles.stepperButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
                <Ionicons name="remove" size={28} color={color} />
            </TouchableOpacity>

            <View style={styles.numericCenter}>
                <TextInput
                    value={String(currentValue)}
                    onChangeText={(text) => setCurrentValue(text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    style={[styles.numericInput, { color: colors.textPrimary }]}
                />
                {unit ? <Text style={[styles.numericUnit, { color: colors.textSecondary }]}>{unit}</Text> : null}
            </View>

            <TouchableOpacity
                onPress={() => setCurrentValue((Number(currentValue) || 0) + 1)}
                style={[styles.stepperButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
                <Ionicons name="add" size={28} color={color} />
            </TouchableOpacity>
        </View>
    );

    const renderTextInput = () => (
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {options?.map((option) => {
                const selected = currentValue === option.value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => setCurrentValue(option.value)}
                        style={[
                            styles.optionRow,
                            {
                                backgroundColor: selected ? color + '15' : colors.surfaceSecondary,
                                borderColor: selected ? color : colors.border,
                            },
                        ]}
                    >
                        <Text style={[styles.optionLabel, { color: selected ? color : colors.textPrimary }]}>
                            {option.label}
                        </Text>
                        {selected ? <Ionicons name="checkmark-circle" size={20} color={color} /> : null}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.55}>
            <View style={styles.container}>
                <ModalHeader title={title} subtitle="EDIT VALUE" onBack={onClose} />

                <View style={styles.content}>
                    {(mode === 'date' || mode === 'time') && renderDateInput()}
                    {mode === 'numeric' && renderNumericInput()}
                    {mode === 'text' && renderTextInput()}
                </View>

                <View style={styles.footer}>
                    {showClear ? (
                        <AppButton label="Clear" onPress={handleClear} variant="ghost" style={styles.actionButton} fullWidth={false} />
                    ) : null}
                    <AppButton label="Confirm" onPress={handleConfirm} style={styles.primaryAction} fullWidth />
                </View>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    dateWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 12,
    },
    numericWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingTop: 36,
    },
    stepperButton: {
        width: 58,
        height: 58,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    numericCenter: {
        flex: 1,
        alignItems: 'center',
    },
    numericInput: {
        fontSize: 46,
        lineHeight: 52,
        fontWeight: '900',
        textAlign: 'center',
        fontFamily: 'Lexend',
        minWidth: 120,
    },
    numericUnit: {
        marginTop: 6,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontFamily: 'Lexend_400Regular',
    },
    optionsList: {
        maxHeight: 320,
    },
    optionRow: {
        minHeight: 56,
        borderRadius: 18,
        borderWidth: 1,
        marginBottom: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    optionLabel: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 28,
    },
    actionButton: {
        minWidth: 110,
    },
    primaryAction: {
        flex: 1,
    },
});

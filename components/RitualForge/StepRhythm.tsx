import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface StepRhythmProps {
    days: string[];
    time: Date;
    onUpdate: (data: any) => void;
    colors: any;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const StepRhythm: React.FC<StepRhythmProps> = ({ days, time, onUpdate, colors }) => {

    const toggleDay = (key: string) => {
        if (days.includes(key)) {
            if (days.length > 1) {
                onUpdate({ days: days.filter(d => d !== key) });
            }
        } else {
            onUpdate({ days: [...days, key] });
        }
    };

    return (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Set the rhythm</Text>

            <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>REPEAT</Text>
                <View style={styles.daysRow}>
                    {DAYS.map((label, index) => {
                        const key = DAY_KEYS[index];
                        const isSelected = days.includes(key);
                        return (
                            <TouchableOpacity
                                key={key}
                                onPress={() => toggleDay(key)}
                                style={[
                                    styles.dayBtn,
                                    {
                                        backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                                        borderColor: isSelected ? colors.primary : colors.border
                                    }
                                ]}
                            >
                                <Text style={[
                                    styles.dayText,
                                    { color: isSelected ? 'white' : colors.textSecondary }
                                ]}>
                                    {label.charAt(0)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>TIME</Text>
                <View style={[styles.timeBox, { backgroundColor: colors.surfaceSecondary }]}>
                    <DateTimePicker
                        value={time}
                        mode="time"
                        display="spinner"
                        onChange={(_, date) => date && onUpdate({ time: date })}
                        textColor={colors.textPrimary}
                    />
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 40,
        textAlign: 'center',
    },
    section: {
        marginBottom: 32,
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 16,
    },
    daysRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    dayBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    dayText: {
        fontWeight: '700',
    },
    timeBox: {
        borderRadius: 24,
        overflow: 'hidden',
        width: 200,
    }
});

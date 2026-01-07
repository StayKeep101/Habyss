import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { TechModal } from './TechModal';
import { useHaptics } from '@/hooks/useHaptics';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// --- Types ---
interface PickerProps {
    visible: boolean;
    onClose: () => void;
    color: string;
}

interface MeasurementProps extends PickerProps {
    value: number;
    unit: string;
    onSave: (val: number, unit: string) => void;
}

interface TimeProps extends PickerProps {
    startTime: Date;
    endTime: Date;
    onSave: (start: Date, end: Date) => void;
}

interface ColorProps extends PickerProps {
    selected: string;
    onSelect: (color: string) => void;
    colors: string[];
}

interface IconProps extends PickerProps {
    selected: string;
    onSelect: (icon: string) => void;
    icons: string[];
}

// --- Unit Categories ---
const UNIT_CATEGORIES = [
    { id: 'count', label: 'Count', units: [{ id: 'times', label: 'times' }, { id: 'reps', label: 'reps' }] },
    { id: 'time', label: 'Time', units: [{ id: 'minutes', label: 'min' }, { id: 'hours', label: 'hrs' }, { id: 'seconds', label: 'sec' }] },
    { id: 'volume', label: 'Volume', units: [{ id: 'ml', label: 'ml' }, { id: 'liters', label: 'L' }, { id: 'cups', label: 'cups' }, { id: 'glasses', label: 'glasses' }] },
    { id: 'reading', label: 'Reading', units: [{ id: 'pages', label: 'pages' }, { id: 'chapters', label: 'chapters' }, { id: 'books', label: 'books' }] },
    { id: 'activity', label: 'Activity', units: [{ id: 'steps', label: 'steps' }, { id: 'km', label: 'km' }, { id: 'miles', label: 'miles' }, { id: 'calories', label: 'cal' }] },
];

// --- Components ---

export const TechMeasurementPicker: React.FC<MeasurementProps> = ({ visible, onClose, value: initVal, unit: initUnit, onSave, color }) => {
    const [value, setValue] = useState(initVal);
    const [unit, setUnit] = useState(initUnit);
    const [activeCategory, setActiveCategory] = useState(() => {
        // Find the category for the initial unit
        const cat = UNIT_CATEGORIES.find(c => c.units.some(u => u.id === initUnit));
        return cat?.id || 'count';
    });
    const { selectionFeedback } = useHaptics();

    // Technical Slider Visualization
    const MAX_VAL = 100;
    const percentage = Math.min((value / MAX_VAL) * 100, 100);

    const currentCategory = UNIT_CATEGORIES.find(c => c.id === activeCategory);

    const handleDone = () => {
        onSave(value, unit);
        onClose();
    };

    return (
        <TechModal visible={visible} onClose={onClose} title="TARGET & UNIT" subtitle="Set your daily goal" showCloseBtn={false}>
            <View style={styles.techControlDeck}>
                {/* Value Display */}
                <View style={styles.valueDisplay}>
                    <Text style={[styles.mainValue, { color }]}>{value}</Text>
                    <Text style={styles.mainUnit}>{currentCategory?.units.find(u => u.id === unit)?.label || unit}</Text>
                </View>

                {/* Slider Controls */}
                <View style={styles.sliderContainer}>
                    <View style={styles.track}>
                        <View style={[styles.progress, { width: `${percentage}%`, backgroundColor: color }]} />
                    </View>
                    <View style={styles.sliderControls}>
                        <TouchableOpacity onPress={() => { selectionFeedback(); setValue(Math.max(1, value - 10)); }} style={styles.fineTuneBtn}><Text style={styles.fineTuneText}>-10</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { selectionFeedback(); setValue(Math.max(1, value - 1)); }} style={styles.fineTuneBtn}><Text style={styles.fineTuneText}>-1</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { selectionFeedback(); setValue(value + 1); }} style={styles.fineTuneBtn}><Text style={styles.fineTuneText}>+1</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { selectionFeedback(); setValue(value + 10); }} style={styles.fineTuneBtn}><Text style={styles.fineTuneText}>+10</Text></TouchableOpacity>
                    </View>
                </View>

                {/* Category Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {UNIT_CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat.id}
                            onPress={() => { selectionFeedback(); setActiveCategory(cat.id); }}
                            style={[styles.categoryTab, activeCategory === cat.id && { backgroundColor: color + '20', borderColor: color }]}
                        >
                            <Text style={[styles.categoryText, { color: activeCategory === cat.id ? color : 'rgba(255,255,255,0.5)' }]}>
                                {cat.label.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Units List */}
                <View style={styles.unitsList}>
                    {currentCategory?.units.map(u => (
                        <TouchableOpacity
                            key={u.id}
                            onPress={() => { selectionFeedback(); setUnit(u.id); }}
                            style={[styles.unitRow, unit === u.id && { backgroundColor: color + '15', borderColor: color }]}
                        >
                            <Text style={[styles.unitLabel, { color: unit === u.id ? color : 'rgba(255,255,255,0.7)' }]}>
                                {u.label}
                            </Text>
                            {unit === u.id && <Ionicons name="checkmark-circle" size={20} color={color} />}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Done Button */}
                <TouchableOpacity onPress={handleDone}>
                    <LinearGradient
                        colors={['#3B82F6', '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.doneBtn}
                    >
                        <Text style={styles.doneBtnText}>Done</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </TechModal>
    );
};

export const TechTimePicker: React.FC<TimeProps> = ({ visible, onClose, startTime: initStart, endTime: initEnd, onSave, color }) => {
    const [start, setStart] = useState(initStart);
    const [end, setEnd] = useState(initEnd);

    // Calculate duration
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const durationText = `${hours}h ${mins}m`;

    const handleDone = () => {
        onSave(start, end);
        onClose();
    };

    return (
        <TechModal visible={visible} onClose={onClose} title="TEMPORAL WINDOW" subtitle={`Duration: ${durationText}`} showCloseBtn={false}>
            <View style={styles.timeContainer}>
                <View style={styles.timeCol}>
                    <View style={styles.timeLabelBox}>
                        <Ionicons name="play" size={12} color="#10B981" />
                        <Text style={styles.timeLabel}>START</Text>
                    </View>
                    <DateTimePicker value={start} mode="time" display="spinner" onChange={(_, d) => d && setStart(d)} textColor="white" style={{ height: 120 }} />
                </View>

                <View style={styles.timeDivider}>
                    <View style={[styles.connectorLine, { backgroundColor: color }]} />
                </View>

                <View style={styles.timeCol}>
                    <View style={styles.timeLabelBox}>
                        <Ionicons name="square" size={10} color="#EF4444" />
                        <Text style={styles.timeLabel}>END</Text>
                    </View>
                    <DateTimePicker value={end} mode="time" display="spinner" onChange={(_, d) => d && setEnd(d)} textColor="white" style={{ height: 120 }} />
                </View>
            </View>

            <TouchableOpacity onPress={handleDone}>
                <LinearGradient
                    colors={['#3B82F6', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.doneBtn}
                >
                    <Text style={styles.doneBtnText}>Done</Text>
                </LinearGradient>
            </TouchableOpacity>
        </TechModal>
    );
};

export const TechColorPicker: React.FC<ColorProps> = ({ visible, onClose, selected, onSelect, colors }) => {
    const { selectionFeedback } = useHaptics();
    return (
        <TechModal visible={visible} onClose={onClose} title="VISUAL SPECTRUM" subtitle="Select unique identifier" showCloseBtn={false}>
            <View style={styles.grid}>
                {colors.map(c => (
                    <TouchableOpacity
                        key={c}
                        onPress={() => { selectionFeedback(); onSelect(c); onClose(); }}
                        style={[styles.colorCell, { borderColor: selected === c ? '#fff' : 'transparent' }]}
                    >
                        <View style={[styles.colorDot, { backgroundColor: c }]} />
                    </TouchableOpacity>
                ))}
            </View>
        </TechModal>
    );
};

export const TechIconPicker: React.FC<IconProps> = ({ visible, onClose, selected, onSelect, icons, color }) => {
    const { selectionFeedback } = useHaptics();
    return (
        <TechModal visible={visible} onClose={onClose} title="ICONOGRAPHY" subtitle="Select visual representation" height={'80%'} showCloseBtn={false}>
            <ScrollView contentContainerStyle={styles.grid}>
                {icons.map(icon => (
                    <TouchableOpacity
                        key={icon}
                        onPress={() => { selectionFeedback(); onSelect(icon); onClose(); }}
                        style={[
                            styles.iconCell,
                            selected === icon && { backgroundColor: color + '20', borderColor: color }
                        ]}
                    >
                        <Ionicons name={icon as any} size={24} color={selected === icon ? color : 'rgba(255,255,255,0.4)'} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </TechModal>
    );
};

const styles = StyleSheet.create({
    techControlDeck: {
        gap: 20,
    },
    valueDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
    },
    mainValue: {
        fontSize: 56,
        fontWeight: '900',
        fontFamily: 'Lexend',
    },
    mainUnit: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.5)',
        marginLeft: 8,
        fontFamily: 'Lexend_400Regular',
    },
    sliderContainer: {
        gap: 12,
    },
    track: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progress: {
        height: '100%',
        borderRadius: 3,
    },
    sliderControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    fineTuneBtn: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    fineTuneText: {
        color: 'white',
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    },
    categoryScroll: {
        maxHeight: 44,
    },
    categoryTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginRight: 8,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        fontFamily: 'Lexend',
    },
    unitsList: {
        gap: 8,
    },
    unitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    unitLabel: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    doneBtn: {
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    doneBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
        fontFamily: 'Lexend',
    },
    // Time
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    timeCol: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        padding: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    timeLabelBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
        marginTop: 8,
        opacity: 0.7,
    },
    timeLabel: {
        color: 'white',
        fontSize: 10,
        letterSpacing: 1,
        fontWeight: '700',
    },
    timeDivider: {
        width: 20,
        alignItems: 'center',
    },
    connectorLine: {
        width: 20,
        height: 2,
        borderRadius: 1,
    },
    // Grid
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    colorCell: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    colorDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    iconCell: {
        width: 60,
        height: 60,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    }
});

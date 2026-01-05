import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { TechModal } from './TechModal';
import { useHaptics } from '@/hooks/useHaptics';

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

// --- Components ---

export const TechMeasurementPicker: React.FC<MeasurementProps> = ({ visible, onClose, value: initVal, unit: initUnit, onSave, color }) => {
    const [value, setValue] = useState(initVal);
    const [unit, setUnit] = useState(initUnit);
    const { selectionFeedback } = useHaptics();

    // Technical Slider Visualization
    const MAX_VAL = 100;
    const percentage = Math.min((value / MAX_VAL) * 100, 100);

    const UNITS = [
        { id: 'times', label: 'times' }, { id: 'minutes', label: 'min' }, { id: 'hours', label: 'hrs' },
        { id: 'ml', label: 'ml' }, { id: 'liters', label: 'L' }, { id: 'pages', label: 'pgs' },
        { id: 'steps', label: 'steps' }
    ];

    return (
        <TechModal visible={visible} onClose={onClose} title="QUANTITY CONTROL" subtitle="Set your target output">
            <View style={styles.techControlDeck}>
                <View style={styles.valueDisplay}>
                    <Text style={[styles.mainValue, { color }]}>{value}</Text>
                    <Text style={styles.mainUnit}>{UNITS.find(u => u.id === unit)?.label || unit}</Text>
                </View>

                <View style={styles.sliderContainer}>
                    <View style={styles.track}>
                        <View style={[styles.progress, { width: `${percentage}%`, backgroundColor: color }]} />
                    </View>
                    <View style={styles.sliderControls}>
                        <TouchableOpacity onPress={() => { selectionFeedback(); setValue(Math.max(1, value - 5)); }} style={styles.fineTuneBtn}><Text style={styles.fineTuneText}>-5</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { selectionFeedback(); setValue(Math.max(1, value - 1)); }} style={styles.fineTuneBtn}><Text style={styles.fineTuneText}>-1</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { selectionFeedback(); setValue(value + 1); }} style={styles.fineTuneBtn}><Text style={styles.fineTuneText}>+1</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { selectionFeedback(); setValue(value + 5); }} style={styles.fineTuneBtn}><Text style={styles.fineTuneText}>+5</Text></TouchableOpacity>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                    {UNITS.map(u => (
                        <TouchableOpacity
                            key={u.id}
                            onPress={() => { selectionFeedback(); setUnit(u.id); }}
                            style={[styles.unitChip, unit === u.id && { backgroundColor: color + '30', borderColor: color }]}
                        >
                            <Text style={{ color: unit === u.id ? color : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' }}>{u.label.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <TouchableOpacity onPress={() => { onSave(value, unit); onClose(); }} style={[styles.saveBtn, { backgroundColor: color }]}>
                    <Text style={styles.saveBtnText}>CONFIRM PARAMETERS</Text>
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

    return (
        <TechModal visible={visible} onClose={onClose} title="TEMPORAL WINDOW" subtitle={`Duration: ${durationText}`}>
            <View style={styles.timeContainer}>
                <View style={styles.timeCol}>
                    <View style={styles.timeLabelBox}>
                        <Ionicons name="play" size={12} color="#10B981" />
                        <Text style={styles.timeLabel}>INITIATE</Text>
                    </View>
                    <DateTimePicker value={start} mode="time" display="spinner" onChange={(_, d) => d && setStart(d)} textColor="white" style={{ height: 120 }} />
                </View>

                <View style={styles.timeDivider}>
                    <View style={[styles.connectorLine, { backgroundColor: color }]} />
                </View>

                <View style={styles.timeCol}>
                    <View style={styles.timeLabelBox}>
                        <Ionicons name="square" size={10} color="#EF4444" />
                        <Text style={styles.timeLabel}>TERMINATE</Text>
                    </View>
                    <DateTimePicker value={end} mode="time" display="spinner" onChange={(_, d) => d && setEnd(d)} textColor="white" style={{ height: 120 }} />
                </View>
            </View>

            <TouchableOpacity onPress={() => { onSave(start, end); onClose(); }} style={[styles.saveBtn, { backgroundColor: color }]}>
                <Text style={styles.saveBtnText}>SYNC TIMELINE</Text>
            </TouchableOpacity>
        </TechModal>
    );
};

export const TechColorPicker: React.FC<ColorProps> = ({ visible, onClose, selected, onSelect, colors }) => {
    const { selectionFeedback } = useHaptics();
    return (
        <TechModal visible={visible} onClose={onClose} title="VISUAL SPECTRUM" subtitle="Select unique identifier">
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
        <TechModal visible={visible} onClose={onClose} title="ICONOGRAPHY" subtitle="Select visual representation" height={'80%'}>
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
        gap: 24,
    },
    valueDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
    },
    mainValue: {
        fontSize: 64,
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
        gap: 16,
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
    unitScroll: {
        maxHeight: 40,
    },
    unitChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginRight: 8,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    saveBtn: {
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    saveBtnText: {
        color: 'white',
        fontWeight: '900',
        letterSpacing: 1,
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

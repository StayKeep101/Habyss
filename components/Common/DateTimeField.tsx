import { useState } from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

/** Android pickers are dialogs: mount only after a deliberate tap. */
export const DateTimeField = ({ value, onChange, mode, label }: {
    value: Date; onChange: (date: Date) => void; mode: 'date' | 'time'; label: string;
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [open, setOpen] = useState(false);
    if (Platform.OS === 'ios') return <DateTimePicker accessibilityLabel={label} value={value} mode={mode} display="compact" themeVariant={theme === 'light' ? 'light' : 'dark'} onChange={(_, date) => date && onChange(date)} />;
    return <>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={{ padding: 12, borderRadius: 10, backgroundColor: colors.surfaceSecondary }}>
            <Text style={{ color: colors.text }}>{mode === 'time' ? value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : value.toLocaleDateString()}</Text>
        </TouchableOpacity>
        {open && <DateTimePicker value={value} mode={mode} onChange={(_, date) => { setOpen(false); if (date) onChange(date); }} />}
    </>;
};

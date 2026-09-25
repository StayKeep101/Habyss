import { View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Spacing } from '@/constants/DesignSystem';

export const TopDragHandle = () => {
    const { theme } = useTheme();
    return (
        <View accessible={false} style={{ alignItems: 'center', paddingBottom: Spacing.xl }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors[theme].textTertiary }} />
        </View>
    );
};

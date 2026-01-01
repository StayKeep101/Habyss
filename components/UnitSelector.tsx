import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface UnitMeasurement {
    value: string;
    label: string;
    category: string;
}

const UNIT_MEASUREMENTS: UnitMeasurement[] = [
    // Count & Frequency
    { value: 'count', label: 'Count', category: 'Count & Frequency' },
    { value: 'times', label: 'Times', category: 'Count & Frequency' },
    { value: 'sessions', label: 'Sessions', category: 'Count & Frequency' },
    { value: 'reps', label: 'Reps', category: 'Count & Frequency' },
    { value: 'sets', label: 'Sets', category: 'Count & Frequency' },

    // Time Duration
    { value: 'minutes', label: 'Minutes', category: 'Time Duration' },
    { value: 'hours', label: 'Hours', category: 'Time Duration' },
    { value: 'seconds', label: 'Seconds', category: 'Time Duration' },

    // Distance
    { value: 'meters', label: 'Meters', category: 'Distance' },
    { value: 'km', label: 'Kilometers', category: 'Distance' },
    { value: 'miles', label: 'Miles', category: 'Distance' },
    { value: 'steps', label: 'Steps', category: 'Distance' },
    { value: 'yards', label: 'Yards', category: 'Distance' },

    // Weight & Mass
    { value: 'kg', label: 'Kilograms', category: 'Weight & Mass' },
    { value: 'lbs', label: 'Pounds', category: 'Weight & Mass' },
    { value: 'grams', label: 'Grams', category: 'Weight & Mass' },

    // Volume
    { value: 'ml', label: 'Milliliters', category: 'Volume' },
    { value: 'liters', label: 'Liters', category: 'Volume' },
    { value: 'cups', label: 'Cups', category: 'Volume' },
    { value: 'glasses', label: 'Glasses', category: 'Volume' },
    { value: 'oz', label: 'Ounces', category: 'Volume' },

    // Reading & Learning
    { value: 'pages', label: 'Pages', category: 'Reading & Learning' },
    { value: 'chapters', label: 'Chapters', category: 'Reading & Learning' },
    { value: 'books', label: 'Books', category: 'Reading & Learning' },
    { value: 'lessons', label: 'Lessons', category: 'Reading & Learning' },
    { value: 'courses', label: 'Courses', category: 'Reading & Learning' },
    { value: 'xp', label: 'XP (Experience Points)', category: 'Reading & Learning' },

    // Food & Nutrition
    { value: 'calories', label: 'Calories', category: 'Food & Nutrition' },
    { value: 'kcal', label: 'Kilocalories', category: 'Food & Nutrition' },
    { value: 'meals', label: 'Meals', category: 'Food & Nutrition' },
    { value: 'servings', label: 'Servings', category: 'Food & Nutrition' },

    // Financial
    { value: 'dollars', label: 'Dollars ($)', category: 'Financial' },
    { value: 'euros', label: 'Euros (€)', category: 'Financial' },
    { value: 'pounds', label: 'Pounds (£)', category: 'Financial' },

    // Health & Wellness
    { value: 'breaths', label: 'Breaths', category: 'Health & Wellness' },
    { value: 'heartbeats', label: 'Heartbeats', category: 'Health & Wellness' },
    { value: 'bpm', label: 'BPM (Heart Rate)', category: 'Health & Wellness' },

    // Productivity
    { value: 'tasks', label: 'Tasks', category: 'Productivity' },
    { value: 'projects', label: 'Projects', category: 'Productivity' },
    { value: 'emails', label: 'Emails', category: 'Productivity' },
    { value: 'calls', label: 'Calls', category: 'Productivity' },

    // Creative
    { value: 'words', label: 'Words', category: 'Creative' },
    { value: 'lines', label: 'Lines of Code', category: 'Creative' },
    { value: 'commits', label: 'Commits', category: 'Creative' },
    { value: 'drawings', label: 'Drawings', category: 'Creative' },
    { value: 'songs', label: 'Songs', category: 'Creative' },

    // Social
    { value: 'messages', label: 'Messages', category: 'Social' },
    { value: 'posts', label: 'Posts', category: 'Social' },
    { value: 'connections', label: 'Connections', category: 'Social' },

    // Other
    { value: 'percent', label: 'Percent (%)', category: 'Other' },
    { value: 'points', label: 'Points', category: 'Other' },
    { value: 'score', label: 'Score', category: 'Other' },
];

interface UnitSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (unit: string) => void;
    currentUnit?: string;
    currentValue?: number;
    onValueChange?: (value: number) => void;
}

export const UnitSelector: React.FC<UnitSelectorProps> = ({
    visible,
    onClose,
    onSelect,
    currentUnit = 'count',
    currentValue = 1,
    onValueChange,
}) => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'abyss'];

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Get unique categories
    const categories = useMemo(() => {
        const cats = Array.from(new Set(UNIT_MEASUREMENTS.map(u => u.category)));
        return cats;
    }, []);

    // Filter measurements
    const filteredMeasurements = useMemo(() => {
        let filtered = UNIT_MEASUREMENTS;

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                m.label.toLowerCase().includes(query) ||
                m.value.toLowerCase().includes(query) ||
                m.category.toLowerCase().includes(query)
            );
        }

        // Filter by category
        if (selectedCategory) {
            filtered = filtered.filter(m => m.category === selectedCategory);
        }

        return filtered;
    }, [searchQuery, selectedCategory]);

    // Group by category
    const groupedMeasurements = useMemo(() => {
        const groups: Record<string, UnitMeasurement[]> = {};
        filteredMeasurements.forEach(m => {
            if (!groups[m.category]) {
                groups[m.category] = [];
            }
            groups[m.category].push(m);
        });
        return groups;
    }, [filteredMeasurements]);

    const handleSelect = (unit: string) => {
        onSelect(unit);
        setSearchQuery('');
        setSelectedCategory(null);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View
                    className="rounded-t-3xl pb-10"
                    style={{
                        backgroundColor: colors.background,
                        maxHeight: '85%'
                    }}
                >
                    {/* Header */}
                    <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b" style={{ borderColor: colors.border }}>
                        <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                            Select Unit
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.surfaceSecondary }}
                        >
                            <Ionicons name="close" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* Value Stepper (if onValueChange provided) */}
                    {onValueChange && (
                        <View className="px-6 py-4 border-b" style={{ borderColor: colors.border }}>
                            <Text className="text-xs font-semibold mb-3 uppercase" style={{ color: colors.textSecondary }}>
                                Target Value
                            </Text>
                            <View className="flex-row items-center justify-between rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surfaceSecondary }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (currentValue > 1) onValueChange(currentValue - 1);
                                    }}
                                    className="px-8 py-5 items-center justify-center active:opacity-70"
                                    style={{ backgroundColor: colors.primary + '15' }}
                                >
                                    <Ionicons name="remove" size={24} color={colors.primary} />
                                </TouchableOpacity>

                                <View className="flex-1 items-center">
                                    <View className="flex-row items-end">
                                        <Text className="text-4xl font-bold" style={{ color: colors.textPrimary }}>
                                            {currentValue}
                                        </Text>
                                        <Text className="text-sm font-bold mb-2 ml-2 uppercase opacity-60" style={{ color: colors.textSecondary }}>
                                            {currentUnit}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={() => onValueChange(currentValue + 1)}
                                    className="px-8 py-5 items-center justify-center active:opacity-70"
                                    style={{ backgroundColor: colors.primary + '15' }}
                                >
                                    <Ionicons name="add" size={24} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Search Bar */}
                    <View className="px-6 py-3">
                        <View
                            className="flex-row items-center px-4 py-3 rounded-2xl"
                            style={{ backgroundColor: colors.surfaceSecondary }}
                        >
                            <Ionicons name="search" size={20} color={colors.textSecondary} />
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Search units..."
                                placeholderTextColor={colors.textSecondary}
                                style={{
                                    flex: 1,
                                    marginLeft: 12,
                                    color: colors.textPrimary,
                                    fontSize: 16
                                }}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Category Filter */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="px-6 pb-3"
                        contentContainerStyle={{ gap: 8 }}
                    >
                        <TouchableOpacity
                            onPress={() => setSelectedCategory(null)}
                            className="px-4 py-2 rounded-full border"
                            style={{
                                backgroundColor: !selectedCategory ? colors.primary + '20' : colors.surfaceSecondary,
                                borderColor: !selectedCategory ? colors.primary : colors.border
                            }}
                        >
                            <Text
                                className="font-semibold"
                                style={{ color: !selectedCategory ? colors.primary : colors.textSecondary }}
                            >
                                All
                            </Text>
                        </TouchableOpacity>

                        {categories.map(category => (
                            <TouchableOpacity
                                key={category}
                                onPress={() => setSelectedCategory(category)}
                                className="px-4 py-2 rounded-full border"
                                style={{
                                    backgroundColor: selectedCategory === category ? colors.primary + '20' : colors.surfaceSecondary,
                                    borderColor: selectedCategory === category ? colors.primary : colors.border
                                }}
                            >
                                <Text
                                    className="font-semibold"
                                    style={{ color: selectedCategory === category ? colors.primary : colors.textSecondary }}
                                >
                                    {category}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Units List */}
                    <ScrollView className="px-6">
                        {Object.entries(groupedMeasurements).map(([category, measurements]) => (
                            <View key={category} className="mb-6">
                                <Text
                                    className="text-xs font-bold uppercase tracking-wider mb-2"
                                    style={{ color: colors.textSecondary }}
                                >
                                    {category}
                                </Text>
                                {measurements.map(measurement => {
                                    const isSelected = currentUnit === measurement.value;
                                    return (
                                        <TouchableOpacity
                                            key={measurement.value}
                                            onPress={() => handleSelect(measurement.value)}
                                            className="flex-row items-center justify-between p-3 rounded-xl mb-2"
                                            style={{
                                                backgroundColor: isSelected ? colors.primary + '20' : colors.surfaceSecondary
                                            }}
                                        >
                                            <Text
                                                className="text-base font-medium"
                                                style={{ color: isSelected ? colors.primary : colors.textPrimary }}
                                            >
                                                {measurement.label}
                                            </Text>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

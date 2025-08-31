import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';

const Create = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [habitName, setHabitName] = useState('');

  const categories = [
    { id: 'health', name: 'Health', icon: 'medical', color: colors.success },
    { id: 'productivity', name: 'Productivity', icon: 'briefcase', color: colors.primary },
    { id: 'fitness', name: 'Fitness', icon: 'fitness', color: colors.warning },
    { id: 'mindfulness', name: 'Mindfulness', icon: 'leaf', color: colors.accent },
    { id: 'learning', name: 'Learning', icon: 'school', color: colors.secondary },
    { id: 'social', name: 'Social', icon: 'people', color: colors.error },
  ];

  const quickHabits = [
    { name: 'Drink 8 glasses of water', category: 'health', icon: 'water' },
    { name: 'Read 30 minutes', category: 'learning', icon: 'book' },
    { name: 'Exercise for 30 minutes', category: 'fitness', icon: 'fitness' },
    { name: 'Meditate for 10 minutes', category: 'mindfulness', icon: 'leaf' },
    { name: 'Call a friend', category: 'social', icon: 'call' },
    { name: 'Plan tomorrow', category: 'productivity', icon: 'calendar' },
  ];

  const handleCreateHabit = () => {
    if (!habitName.trim() || !selectedCategory) {
      mediumFeedback();
      Alert.alert('Missing Information', 'Please enter a habit name and select a category.');
      return;
    }

    lightFeedback();
    Alert.alert(
      'Habit Created!',
      `"${habitName}" has been added to your habits. You'll receive reminders and can track your progress.`,
      [
        { text: 'OK', onPress: () => {
          setHabitName('');
          setSelectedCategory(null);
        }}
      ]
    );
  };

  const handleQuickHabit = (habit: any) => {
    lightFeedback();
    Alert.alert(
      'Quick Habit Added!',
      `"${habit.name}" has been added to your habits. You can customize the settings and reminders.`,
      [{ text: 'OK' }]
    );
  };

  const handleHelp = () => {
    lightFeedback();
    Alert.alert(
      'Create Help',
      'Create new habits, routines, and goals to improve your life. Choose from categories or use our quick suggestions.',
      [{ text: 'OK' }]
    );
  };

  const handleTemplate = (template: any) => {
    lightFeedback();
    Alert.alert(
      'Template Applied!',
      `The "${template.name}" template has been applied. You can now customize the habits and schedule.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            Create
          </Text>
          <TouchableOpacity 
            className="w-12 h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: colors.surfaceSecondary }}
            onPress={handleHelp}
          >
            <Ionicons name="help-circle" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Create New Habit */}
        <View className="mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Create New Habit
          </Text>
          
          <View 
            className="p-5 rounded-2xl"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {/* Habit Name Input */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                Habit Name
              </Text>
              <TextInput
                className="p-4 rounded-2xl text-base"
                style={{
                  backgroundColor: colors.background,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                placeholder="Enter habit name..."
                placeholderTextColor={colors.textTertiary}
                value={habitName}
                onChangeText={setHabitName}
              />
            </View>

            {/* Category Selection */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-3" style={{ color: colors.textPrimary }}>
                Category
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    className={`w-[48%] p-4 rounded-2xl mb-3 items-center ${
                      selectedCategory === category.id ? 'border-2' : ''
                    }`}
                    style={{
                      backgroundColor: selectedCategory === category.id 
                        ? category.color + '20' 
                        : colors.background,
                      borderColor: selectedCategory === category.id ? category.color : 'transparent'
                    }}
                    onPress={() => {
                      lightFeedback();
                      setSelectedCategory(category.id);
                    }}
                  >
                    <View 
                      className="w-12 h-12 rounded-2xl items-center justify-center mb-2"
                      style={{ backgroundColor: category.color + '20' }}
                    >
                      <Ionicons name={category.icon as any} size={24} color={category.color} />
                    </View>
                    <Text 
                      className="text-sm font-bold"
                      style={{ 
                        color: selectedCategory === category.id ? category.color : colors.textPrimary 
                      }}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              className="p-4 rounded-2xl items-center"
              style={{ backgroundColor: colors.primary }}
              onPress={handleCreateHabit}
            >
              <Text className="text-base font-bold text-white">Create Habit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Habits */}
        <View className="mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Quick Habits
          </Text>
          
          <View 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            {quickHabits.map((habit, index) => (
              <View key={habit.name}>
                <TouchableOpacity
                  className="flex-row items-center p-4"
                  onPress={() => handleQuickHabit(habit)}
                >
                  <View 
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                    style={{ backgroundColor: colors.primary + '20' }}
                  >
                    <Ionicons name={habit.icon as any} size={24} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                      {habit.name}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {habit.category}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
                {index < quickHabits.length - 1 && (
                  <View 
                    className="h-[0.5px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Templates */}
        <View className="mb-6">
          <Text className="text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>
            Habit Templates
          </Text>
          
          <View className="flex-row flex-wrap justify-between">
            {[
              { name: 'Morning Routine', icon: 'sunny', color: colors.warning },
              { name: 'Evening Routine', icon: 'moon', color: colors.secondary },
              { name: 'Workout Plan', icon: 'fitness', color: colors.success },
              { name: 'Study Schedule', icon: 'school', color: colors.primary },
            ].map((template, index) => (
              <TouchableOpacity
                key={template.name}
                className="w-[48%] p-5 rounded-2xl mb-4 items-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={() => handleTemplate(template)}
              >
                <View 
                  className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
                  style={{ backgroundColor: template.color + '20' }}
                >
                  <Ionicons name={template.icon as any} size={32} color={template.color} />
                </View>
                <Text className="font-bold text-base text-center" style={{ color: colors.textPrimary }}>
                  {template.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tips */}
        <View className="mb-6">
          <View 
            className="p-5 rounded-2xl"
            style={{ backgroundColor: colors.success + '20' }}
          >
            <View className="flex-row items-center mb-3">
              <Ionicons name="bulb" size={24} color={colors.success} />
              <Text className="ml-3 text-lg font-bold" style={{ color: colors.success }}>
                Pro Tips
              </Text>
            </View>
            <Text className="text-base" style={{ color: colors.textSecondary }}>
              • Start with small, achievable habits{'\n'}
              • Be specific about your goals{'\n'}
              • Track your progress daily{'\n'}
              • Celebrate small wins
            </Text>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Create;
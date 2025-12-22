import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, DeviceEventEmitter, Platform, Dimensions, ScrollView, Modal, Switch, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addHabit, HabitCategory } from '@/lib/habits';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { cn } from '@/lib/utils';
import { useRouter } from 'expo-router';

const categories: { key: HabitCategory; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'productivity', label: 'Productivity', color: '#60A5FA', icon: 'briefcase' },
  { key: 'health', label: 'Health', color: '#34D399', icon: 'medical' },
  { key: 'fitness', label: 'Fitness', color: '#FBBF24', icon: 'fitness' },
  { key: 'mindfulness', label: 'Mindfulness', color: '#A78BFA', icon: 'leaf' },
];

export default function CreateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HabitCategory>('productivity');
  const [duration, setDuration] = useState<string>('');
  const [iconName, setIconName] = useState<keyof typeof Ionicons.glyphMap | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const wheelHeight = Math.min(140, Math.floor(Dimensions.get('window').height * 0.22));
  const [showIconPicker, setShowIconPicker] = useState(false);
  
  // Goal creation states
  const [isGoal, setIsGoal] = useState(false);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (isGoal && !targetDate) return; 
    try {
      setSaving(true);
      const parsed = duration.trim() ? Math.max(1, Math.min(1440, parseInt(duration.trim(), 10) || 0)) : undefined;
      const fmt = (d: Date | null) => (d ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : undefined);
      const targetDateISO = targetDate ? targetDate.toISOString() : undefined;
      await addHabit(name.trim(), category, iconName, parsed, fmt(startAt), fmt(endAt), isGoal, targetDateISO);
      DeviceEventEmitter.emit('habit_created');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View className="px-6 pt-6 pb-4 flex-row justify-between items-center" style={{ backgroundColor: colors.background }}>
        <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>New Habit</Text>
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Name Input with Icon */}
        <View className="mt-4 flex-row items-center rounded-2xl border px-4 py-3" 
              style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
            <TouchableOpacity
              onPress={() => setShowIconPicker(true)}
              className="mr-3"
            >
               <Ionicons name={(iconName ?? 'time-outline') as any} size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Read 20 minutes"
                placeholderTextColor={colors.textTertiary}
                style={{ color: colors.textPrimary, fontSize: 16, flex: 1, fontWeight: '500' }}
                autoFocus
                returnKeyType="done"
            />
        </View>

        {/* Category Section */}
        <View className="mt-8">
          <Text className="text-base font-semibold mb-4" style={{ color: colors.textSecondary }}>Category</Text>
          <View className="flex-row flex-wrap gap-3">
            {categories.map(c => {
                const isSelected = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    className={cn(
                        "flex-row items-center px-4 py-2.5 rounded-full border",
                        isSelected ? "border-transparent" : "border-transparent"
                    )}
                    style={{
                        backgroundColor: isSelected ? colors.primary + '20' : colors.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.surfaceSecondary
                    }}
                  >
                    <Ionicons name={c.icon} size={18} color={isSelected ? colors.primary : c.color} />
                    <Text className="ml-2 font-semibold" style={{ color: isSelected ? colors.primary : colors.textPrimary }}>{c.label}</Text>
                  </TouchableOpacity>
                )
            })}
          </View>
        </View>

        {/* Duration Input */}
        <View className="mt-8">
          <Text className="text-base font-semibold mb-3" style={{ color: colors.textSecondary }}>Estimated Duration (minutes)</Text>
          <View className="rounded-2xl border px-4 py-3" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
            <TextInput
                value={duration}
                onChangeText={setDuration}
                placeholder="e.g., 20"
                placeholderTextColor={colors.textTertiary}
                style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '500' }}
                keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Goal Toggle Card */}
        <View className="mt-8">
          <View 
            className="flex-row items-center p-4 rounded-2xl border"
            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: colors.surfaceTertiary }}>
              <Ionicons name="trophy-outline" size={20} color={colors.textSecondary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>This is a Goal</Text>
              <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>Set a target date to achieve this goal</Text>
            </View>
            <Switch
                value={isGoal}
                onValueChange={setIsGoal}
                trackColor={{ false: colors.surfaceTertiary, true: colors.primary }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : colors.primary}
            />
          </View>
        </View>

        {/* Target Date Picker - Animate or conditional render */}
        {isGoal && (
          <View className="mt-4">
            <TouchableOpacity
              className="p-4 rounded-2xl border flex-row items-center justify-between"
              style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
              onPress={() => setShowTargetDatePicker(true)}
            >
               <View>
                  <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Target Date</Text>
                  <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                    {targetDate ? targetDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Select date'}
                  </Text>
               </View>
               <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            {showTargetDatePicker && (
              <DateTimePicker
                value={targetDate ?? new Date()}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, d) => {
                  if (Platform.OS !== 'ios') setShowTargetDatePicker(false);
                  if (d) setTargetDate(d);
                }}
                style={Platform.OS === 'ios' ? { height: wheelHeight } : undefined}
              />
            )}
          </View>
        )}

        {/* Time Pickers */}
        <View className="mt-6 flex-row justify-between gap-3">
          <View className="flex-1 overflow-hidden">
            <TouchableOpacity
              className="p-4 rounded-2xl border mb-2"
              style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
              onPress={() => setShowStartPicker(!showStartPicker)}
            >
              <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Start Time</Text>
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                {startAt ? `${String(startAt.getHours()).padStart(2,'0')}:${String(startAt.getMinutes()).padStart(2,'0')}` : 'Select start'}
              </Text>
            </TouchableOpacity>
            {showStartPicker && (
                <View className="rounded-2xl overflow-hidden bg-white dark:bg-black border border-gray-100 dark:border-gray-800">
                  <DateTimePicker
                    value={startAt ?? new Date()}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS !== 'ios') setShowStartPicker(false);
                      if (d) setStartAt(d);
                    }}
                    style={Platform.OS === 'ios' ? { height: wheelHeight, width: '100%', backgroundColor: colors.surfaceSecondary } : undefined}
                    textColor={colors.textPrimary}
                  />
                </View>
            )}
          </View>

          <View className="flex-1 overflow-hidden">
            <TouchableOpacity
              className="p-4 rounded-2xl border mb-2"
              style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
              onPress={() => setShowEndPicker(!showEndPicker)}
            >
              <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>End Time</Text>
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                {endAt ? `${String(endAt.getHours()).padStart(2,'0')}:${String(endAt.getMinutes()).padStart(2,'0')}` : 'Select end'}
              </Text>
            </TouchableOpacity>
            {showEndPicker && (
                <View className="rounded-2xl overflow-hidden bg-white dark:bg-black border border-gray-100 dark:border-gray-800">
                  <DateTimePicker
                    value={endAt ?? new Date()}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS !== 'ios') setShowEndPicker(false);
                      if (d) setEndAt(d);
                    }}
                    style={Platform.OS === 'ios' ? { height: wheelHeight, width: '100%', backgroundColor: colors.surfaceSecondary } : undefined}
                    textColor={colors.textPrimary}
                  />
                </View>
            )}
          </View>
        </View>

        {/* Icon Picker Modal */}
        <Modal
          visible={showIconPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowIconPicker(false)}
        >
          <TouchableOpacity
            className="flex-1 bg-black/60 items-center justify-center"
            activeOpacity={1}
            onPress={() => setShowIconPicker(false)}
          >
            <View className="w-11/12 rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center mb-5">
                  <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Choose an icon</Text>
                  <TouchableOpacity onPress={() => setShowIconPicker(false)} className="p-1 bg-gray-100 rounded-full" style={{ backgroundColor: colors.surfaceSecondary }}>
                    <Ionicons name="close" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap gap-3">
                  {[
                    { k: 'book' as const, label: 'Read' },
                    { k: 'fitness' as const, label: 'Workout' },
                    { k: 'leaf' as const, label: 'Meditate' },
                    { k: 'water' as const, label: 'Water' },
                    { k: 'timer' as const, label: 'Timer' },
                    { k: 'create' as const, label: 'Write' },
                    { k: 'briefcase' as const, label: 'Work' },
                    { k: 'cafe' as const, label: 'Break' },
                    { k: 'bed' as const, label: 'Sleep' },
                    { k: 'school' as const, label: 'Study' },
                    { k: 'walk' as const, label: 'Walk' },
                    { k: 'bicycle' as const, label: 'Bike' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.k}
                      className="w-[47%] p-3 rounded-2xl flex-row items-center border"
                      style={{ 
                          backgroundColor: iconName === opt.k ? colors.primary + '15' : colors.surfaceSecondary, 
                          borderColor: iconName === opt.k ? colors.primary : colors.surfaceSecondary
                      }}
                      onPress={() => { setIconName(opt.k); setShowIconPicker(false); }}
                    >
                      <Ionicons name={opt.k} size={20} color={iconName === opt.k ? colors.primary : colors.textSecondary} />
                      <Text className="ml-2 font-medium" style={{ color: iconName === opt.k ? colors.primary : colors.textPrimary }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
            </View>
          </TouchableOpacity>
        </Modal>

      </ScrollView>

      {/* Floating Bottom Button */}
      <View className="absolute bottom-10 left-0 right-0 px-6">
        <TouchableOpacity
            disabled={!name.trim() || (isGoal && !targetDate) || saving}
            onPress={handleCreate}
            className="w-full py-4 rounded-full items-center shadow-lg"
            style={{ 
                backgroundColor: (!name.trim() || (isGoal && !targetDate)) ? colors.surfaceSecondary : colors.primary,
                opacity: saving ? 0.7 : 1
            }}
        >
            <Text className="text-lg font-bold" style={{ color: (!name.trim() || (isGoal && !targetDate)) ? colors.textTertiary : 'white' }}>
                Create Habit
            </Text>
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}

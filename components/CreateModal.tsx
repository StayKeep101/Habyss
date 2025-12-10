import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, DeviceEventEmitter, Platform, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addHabit, HabitCategory } from '@/lib/habits';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption?: (option: 'routine' | 'habit' | 'task') => void; // backward compat
}

const categories: { key: HabitCategory; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'productivity', label: 'Productivity', color: '#3B82F6', icon: 'briefcase' },
  { key: 'health', label: 'Health', color: '#10B981', icon: 'medical' },
  { key: 'fitness', label: 'Fitness', color: '#F59E0B', icon: 'fitness' },
  { key: 'mindfulness', label: 'Mindfulness', color: '#8B5CF6', icon: 'leaf' },
];

const CreateModal: React.FC<CreateModalProps> = ({ visible, onClose }) => {
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
    if (isGoal && !targetDate) return; // Goal requires target date
    try {
      setSaving(true);
      const parsed = duration.trim() ? Math.max(1, Math.min(1440, parseInt(duration.trim(), 10) || 0)) : undefined;
      const fmt = (d: Date | null) => (d ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : undefined);
      const targetDateISO = targetDate ? targetDate.toISOString() : undefined;
      await addHabit(name.trim(), category, iconName, parsed, fmt(startAt), fmt(endAt), isGoal, targetDateISO);
      DeviceEventEmitter.emit('habit_created');
      setName('');
      setCategory('productivity');
      setDuration('');
      setIconName(undefined);
      setStartAt(null);
      setEndAt(null);
      setIsGoal(false);
      setTargetDate(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        className="flex-1 bg-black/50 justify-end"
        activeOpacity={1}
        onPress={onClose}
      >
        <Card className="rounded-t-3xl">
          <CardHeader>
            <View className="flex-row justify-between items-center">
              <CardTitle>New Habit</CardTitle>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </CardHeader>

          <CardContent>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          <View className="space-y-4">
            <View className="flex-row items-center space-x-3">
              <TouchableOpacity
                className="w-12 h-12 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={() => setShowIconPicker(true)}
                accessibilityLabel="Choose icon"
              >
                <Ionicons name={(iconName ?? 'timer') as any} size={20} color={colors.primary} />
              </TouchableOpacity>
              <View className="flex-1">
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Read 20 minutes"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />
              </View>
            </View>
          </View>

          <View className="mt-6">
            <Text className="text-sm mb-3 font-medium" style={{ color: colors.textSecondary }}>Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {categories.map(c => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                >
                  <Badge
                    variant={category === c.key ? "default" : "outline"}
                    className={cn(
                      "flex-row items-center px-4 py-2 rounded-2xl",
                      category === c.key && "border-2"
                    )}
                    style={{
                      backgroundColor: category === c.key ? c.color + '20' : colors.surfaceSecondary,
                      borderColor: category === c.key ? c.color : colors.border,
                    }}
                  >
                    <Ionicons name={c.icon} size={16} color={c.color} />
                    <Text className="ml-2 font-medium" style={{ color: colors.textPrimary }}>{c.label}</Text>
                  </Badge>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="mt-6">
            <Input
              label="Estimated Duration (minutes)"
              value={duration}
              onChangeText={setDuration}
              placeholder="e.g., 20"
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
          </View>

          {/* Goal Toggle */}
          <View className="mt-6">
            <TouchableOpacity
              className="flex-row items-center p-4 rounded-2xl"
              style={{ backgroundColor: isGoal ? colors.primary + '20' : colors.surfaceSecondary, borderWidth: isGoal ? 2 : 1, borderColor: isGoal ? colors.primary : colors.border }}
              onPress={() => setIsGoal(!isGoal)}
            >
              <View className="w-8 h-8 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: isGoal ? colors.primary + '40' : colors.border }}>
                <Ionicons name="trophy" size={18} color={isGoal ? colors.primary : colors.textTertiary} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: colors.textPrimary }}>This is a Goal</Text>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>Set a target date to achieve this goal</Text>
              </View>
              <View 
                className="w-6 h-6 rounded-full items-center justify-center"
                style={{ backgroundColor: isGoal ? colors.primary : colors.border }}
              >
                {isGoal && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
            </TouchableOpacity>
          </View>

          {/* Target Date Picker - only show if goal is selected */}
          {isGoal && (
            <View className="mt-6">
              <TouchableOpacity
                className="p-4 rounded-2xl"
                style={{ backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowTargetDatePicker(true)}
              >
                <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                  {targetDate ? targetDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : 'Select target date'}
                </Text>
              </TouchableOpacity>
              {showTargetDatePicker && (
                <DateTimePicker
                  value={targetDate ?? new Date()}
                  mode="date"
                  minimumDate={new Date()} // Can't set target date in the past
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

          <View className="mt-6 flex-row justify-between space-x-3">
            <View className="flex-1">
              <TouchableOpacity
                className="p-4 rounded-2xl"
                style={{ backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowStartPicker(true)}
              >
                <Text className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Start Time</Text>
                <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                  {startAt ? `${String(startAt.getHours()).padStart(2,'0')}:${String(startAt.getMinutes()).padStart(2,'0')}` : 'Select start'}
                </Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startAt ?? new Date()}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => {
                    if (Platform.OS !== 'ios') setShowStartPicker(false);
                    if (d) setStartAt(d);
                  }}
                  style={Platform.OS === 'ios' ? { height: wheelHeight } : undefined}
                />
              )}
            </View>

            <View className="flex-1">
              <TouchableOpacity
                className="p-4 rounded-2xl"
                style={{ backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowEndPicker(true)}
              >
                <Text className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>End Time</Text>
                <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                  {endAt ? `${String(endAt.getHours()).padStart(2,'0')}:${String(endAt.getMinutes()).padStart(2,'0')}` : 'Select end'}
                </Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endAt ?? new Date()}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => {
                    if (Platform.OS !== 'ios') setShowEndPicker(false);
                    if (d) setEndAt(d);
                  }}
                  style={Platform.OS === 'ios' ? { height: wheelHeight } : undefined}
                />
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
              className="flex-1 bg-black/50 items-center justify-center"
              activeOpacity={1}
              onPress={() => setShowIconPicker(false)}
            >
              <Card className="w-11/12">
                <CardHeader>
                  <View className="flex-row justify-between items-center">
                    <CardTitle>Choose an icon</CardTitle>
                    <TouchableOpacity onPress={() => setShowIconPicker(false)}>
                      <Ionicons name="close" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </CardHeader>
                <CardContent>
                  <View className="flex-row flex-wrap gap-2">
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
                        className="w-[48%] p-3 rounded-2xl mb-3 flex-row items-center"
                        style={{ backgroundColor: iconName === opt.k ? colors.primary + '20' : colors.surfaceSecondary, borderWidth: iconName === opt.k ? 2 : 1, borderColor: iconName === opt.k ? colors.primary : colors.border }}
                        onPress={() => { setIconName(opt.k); setShowIconPicker(false); }}
                      >
                        <Ionicons name={opt.k} size={18} color={colors.primary} />
                        <Text className="ml-2 font-semibold" style={{ color: colors.textPrimary }}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>
          </Modal>

          <View className="mt-8">
            <Button
              label={isGoal ? 'Create Goal' : 'Create Habit'}
              disabled={!name.trim() || (isGoal && !targetDate) || saving}
              onPress={handleCreate}
              className="w-full"
            />
          </View>
          </ScrollView>
          </CardContent>
        </Card>
      </TouchableOpacity>
    </Modal>
  );
};

export default CreateModal;
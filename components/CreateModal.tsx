import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, DeviceEventEmitter, Platform, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addHabit, HabitCategory } from '@/lib/habits';
import DateTimePicker from '@react-native-community/datetimepicker';

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

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setSaving(true);
      const parsed = duration.trim() ? Math.max(1, Math.min(1440, parseInt(duration.trim(), 10) || 0)) : undefined;
      const fmt = (d: Date | null) => (d ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : undefined);
      await addHabit(name.trim(), category, iconName, parsed, fmt(startAt), fmt(endAt));
      DeviceEventEmitter.emit('habit_created');
      setName('');
      setCategory('productivity');
      setDuration('');
      setIconName(undefined);
      setStartAt(null);
      setEndAt(null);
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
        <View className="bg-white rounded-t-3xl p-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">New Habit</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          <View>
            <Text className="text-sm mb-2 text-gray-600">Name</Text>
            <View className="flex-row items-center">
              <TouchableOpacity
                className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: '#E5F0FF' }}
                onPress={() => setShowIconPicker(true)}
                accessibilityLabel="Choose icon"
              >
                <Ionicons name={(iconName ?? 'timer') as any} size={20} color="#3B82F6" />
              </TouchableOpacity>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Read 20 minutes"
                className="flex-1 p-4 rounded-xl"
                style={{ backgroundColor: '#F1F5F9' }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-sm mb-2 text-gray-600">Category</Text>
            <View className="flex-row flex-wrap justify-between">
              {categories.map(c => (
                <TouchableOpacity
                  key={c.key}
                  className="w-[48%] p-4 rounded-xl mb-3 flex-row items-center"
                  style={{ backgroundColor: category === c.key ? c.color + '20' : '#F8FAFC', borderWidth: category === c.key ? 2 : 0, borderColor: c.color }}
                  onPress={() => setCategory(c.key)}
                >
                  <View className="w-8 h-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: c.color + '20' }}>
                    <Ionicons name={c.icon} size={18} color={c.color} />
                  </View>
                  <Text className="font-semibold" style={{ color: '#0F172A' }}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-sm mb-2 text-gray-600">Estimated Duration (minutes)</Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              placeholder="e.g., 20"
              keyboardType="number-pad"
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#F1F5F9' }}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
          </View>

          <View className="mt-3 flex-row justify-between">
            <View className="w-[48%]">
              <Text className="text-sm mb-2 text-gray-600">Start Time</Text>
              <TouchableOpacity
                className="p-4 rounded-xl"
                style={{ backgroundColor: '#F1F5F9' }}
                onPress={() => setShowStartPicker(true)}
              >
                <Text className="font-semibold" style={{ color: '#0F172A' }}>
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

            <View className="w-[48%]">
              <Text className="text-sm mb-2 text-gray-600">End Time</Text>
              <TouchableOpacity
                className="p-4 rounded-xl"
                style={{ backgroundColor: '#F1F5F9' }}
                onPress={() => setShowEndPicker(true)}
              >
                <Text className="font-semibold" style={{ color: '#0F172A' }}>
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
              <View className="bg-white rounded-2xl p-5 w-11/12">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-lg font-semibold" style={{ color: '#0F172A' }}>Choose an icon</Text>
                  <TouchableOpacity onPress={() => setShowIconPicker(false)}>
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap justify-between">
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
                      className="w-[48%] p-3 rounded-xl mb-3 flex-row items-center"
                      style={{ backgroundColor: iconName === opt.k ? '#E5F0FF' : '#F8FAFC', borderWidth: iconName === opt.k ? 2 : 0, borderColor: '#3B82F6' }}
                      onPress={() => { setIconName(opt.k); setShowIconPicker(false); }}
                    >
                      <Ionicons name={opt.k} size={18} color="#3B82F6" />
                      <Text className="ml-2 font-semibold" style={{ color: '#0F172A' }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          <TouchableOpacity
            className="mt-4 p-4 rounded-xl items-center"
            style={{ backgroundColor: name.trim() && !saving ? '#3B82F6' : '#93C5FD' }}
            disabled={!name.trim() || saving}
            onPress={handleCreate}
          >
            <Text className="text-white font-semibold">Create Habit</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default CreateModal;
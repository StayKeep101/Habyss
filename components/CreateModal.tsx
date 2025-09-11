import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addHabit, HabitCategory } from '@/lib/habits';

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

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setSaving(true);
      const parsed = duration.trim() ? Math.max(1, Math.min(1440, parseInt(duration.trim(), 10) || 0)) : undefined;
      await addHabit(name.trim(), category, iconName, parsed);
      DeviceEventEmitter.emit('habit_created');
      setName('');
      setCategory('productivity');
      setDuration('');
      setIconName(undefined);
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
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-gray-900">New Habit</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View>
            <Text className="text-sm mb-2 text-gray-600">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Read 20 minutes"
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#F1F5F9' }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
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

          <View className="mt-4">
            <Text className="text-sm mb-2 text-gray-600">Icon</Text>
            <View className="flex-row flex-wrap justify-between">
              {[
                { k: 'book' as const, label: 'Read' },
                { k: 'fitness' as const, label: 'Workout' },
                { k: 'leaf' as const, label: 'Meditate' },
                { k: 'water' as const, label: 'Water' },
                { k: 'timer' as const, label: 'Timer' },
                { k: 'create' as const, label: 'Write' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.k}
                  className="w-[48%] p-3 rounded-xl mb-3 flex-row items-center"
                  style={{ backgroundColor: iconName === opt.k ? '#E5F0FF' : '#F8FAFC', borderWidth: iconName === opt.k ? 2 : 0, borderColor: '#3B82F6' }}
                  onPress={() => setIconName(opt.k)}
                >
                  <Ionicons name={opt.k} size={18} color="#3B82F6" />
                  <Text className="ml-2 font-semibold" style={{ color: '#0F172A' }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            className="mt-4 p-4 rounded-xl items-center"
            style={{ backgroundColor: name.trim() && !saving ? '#3B82F6' : '#93C5FD' }}
            disabled={!name.trim() || saving}
            onPress={handleCreate}
          >
            <Text className="text-white font-semibold">Create Habit</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default CreateModal;
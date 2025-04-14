import React from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: 'routine' | 'habit' | 'task') => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ visible, onClose, onSelectOption }) => {
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
            <Text className="text-2xl font-bold text-gray-900">Create New</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View className="space-y-4">
            <TouchableOpacity 
              className="flex-row items-center bg-blue-50 p-4 rounded-xl"
              onPress={() => onSelectOption('routine')}
            >
              <View className="bg-blue-100 p-3 rounded-lg mr-4">
                <Ionicons name="calendar" size={24} color="#2563EB" />
              </View>
              <View>
                <Text className="text-lg font-semibold text-gray-900">Routine</Text>
                <Text className="text-sm text-gray-500">Create a recurring schedule</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-row items-center bg-purple-50 p-4 rounded-xl"
              onPress={() => onSelectOption('habit')}
            >
              <View className="bg-purple-100 p-3 rounded-lg mr-4">
                <Ionicons name="repeat" size={24} color="#7C3AED" />
              </View>
              <View>
                <Text className="text-lg font-semibold text-gray-900">Habit</Text>
                <Text className="text-sm text-gray-500">Build a new habit</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-row items-center bg-green-50 p-4 rounded-xl"
              onPress={() => onSelectOption('task')}
            >
              <View className="bg-green-100 p-3 rounded-lg mr-4">
                <Ionicons name="checkmark-circle" size={24} color="#059669" />
              </View>
              <View>
                <Text className="text-lg font-semibold text-gray-900">Task</Text>
                <Text className="text-sm text-gray-500">Add a single task</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default CreateModal; 
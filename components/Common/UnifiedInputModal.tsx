import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  TouchableWithoutFeedback, 
  Animated, 
  Dimensions, 
  TextInput,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type InputMode = 'date' | 'time' | 'numeric' | 'text';

interface UnifiedInputModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (value: any) => void;
  initialValue: any;
  mode: InputMode;
  title: string;
  unit?: string;
  options?: { label: string; value: string }[];
  color?: string;
  showClear?: boolean;
  onClear?: () => void;
}

export const UnifiedInputModal: React.FC<UnifiedInputModalProps> = ({
  visible,
  onClose,
  onConfirm,
  initialValue,
  mode,
  title,
  unit,
  options,
  color = '#6B46C1',
  showClear = false,
  onClear
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [currentValue, setCurrentValue] = useState(initialValue);
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      setCurrentValue(initialValue);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, initialValue]);

  const handleConfirm = () => {
    onConfirm(currentValue);
    onClose();
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
      onClose();
    }
  };

  const renderDateInput = () => (
    <View className="items-center py-4">
      <DateTimePicker
        value={currentValue instanceof Date ? currentValue : new Date()}
        mode={mode === 'date' ? 'date' : 'time'}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={(event, date) => {
          if (date) setCurrentValue(date);
        }}
        textColor={colors.textPrimary}
        style={{ width: '100%', height: 200 }}
      />
    </View>
  );

  const renderNumericInput = () => (
    <View className="items-center py-8">
      <View className="flex-row items-center justify-center gap-8">
        <TouchableOpacity 
          onPress={() => setCurrentValue(Math.max(0, (Number(currentValue) || 0) - 1))}
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <Ionicons name="remove" size={32} color={color} />
        </TouchableOpacity>
        
        <View className="items-center min-w-[100px]">
          <TextInput
            value={String(currentValue)}
            onChangeText={(text) => setCurrentValue(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            className="text-5xl font-bold text-center"
            style={{ color: colors.textPrimary }}
          />
          {unit && (
            <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>{unit}</Text>
          )}
        </View>

        <TouchableOpacity 
          onPress={() => setCurrentValue((Number(currentValue) || 0) + 1)}
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <Ionicons name="add" size={32} color={color} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTextInput = () => (
    <ScrollView className="max-h-60 mt-4" showsVerticalScrollIndicator={false}>
      {options?.map((option) => (
        <TouchableOpacity
          key={option.value}
          onPress={() => setCurrentValue(option.value)}
          className="flex-row justify-between items-center py-4 px-4 rounded-xl mb-2"
          style={{ 
            backgroundColor: currentValue === option.value ? color + '15' : 'transparent',
            borderWidth: 1,
            borderColor: currentValue === option.value ? color : colors.border
          }}
        >
          <Text 
            className="text-base font-semibold" 
            style={{ color: currentValue === option.value ? color : colors.textPrimary }}
          >
            {option.label}
          </Text>
          {currentValue === option.value && (
            <Ionicons name="checkmark-circle" size={20} color={color} />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View 
          className="flex-1 bg-black/50" 
          style={{ opacity: fadeAnim }}
        />
      </TouchableWithoutFeedback>
      
      <Animated.View 
        className="absolute bottom-0 left-0 right-0 rounded-t-[40px] px-6 pb-12 pt-8"
        style={{ 
          backgroundColor: colors.background,
          transform: [{ translateY: slideAnim }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}
      >
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>{title}</Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View className="mb-8">
          {(mode === 'date' || mode === 'time') && renderDateInput()}
          {mode === 'numeric' && renderNumericInput()}
          {mode === 'text' && renderTextInput()}
        </View>

        <View className="flex-row gap-3">
          {showClear && (
            <TouchableOpacity
              onPress={handleClear}
              className="flex-1 py-4 rounded-full items-center border"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceSecondary }}
            >
              <Text className="text-lg font-bold" style={{ color: colors.textSecondary }}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleConfirm}
            className="flex-[2] py-4 rounded-full items-center"
            style={{ backgroundColor: color }}
          >
            <Text className="text-lg font-bold text-white">Confirm</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

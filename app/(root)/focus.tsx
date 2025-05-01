import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';


export default function FocusScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sound, setSound] = useState(null);
  const [isDistractionBlocked, setIsDistractionBlocked] = useState(false);

  useEffect(() => {
    let timer;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
    
      setIsRunning(false);
      setIsBreak(!isBreak);
      setTimeLeft(isBreak ? 25 * 60 : 5 * 60);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, isBreak]);


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView className="flex-1 p-5">
      <View className="mb-8">
        <Text className={`text-2xl font-bold mb-2.5 ${isDark ? 'text-white' : 'text-black'}`}>
          Focus Mode
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className={`text-lg font-medium ${isDark ? 'text-white' : 'text-black'}`}>
            {isBreak ? 'Break Time' : 'Focus Time'}
          </Text>
          <Switch
            value={isDistractionBlocked}
            onValueChange={setIsDistractionBlocked}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isDistractionBlocked ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>
      </View>

      <View className="items-center mb-10">
        <View className={`w-64 h-64 rounded-full justify-center items-center ${isBreak ? 'bg-green-600' : 'bg-blue-600'}`}>
          <Text className="text-5xl font-bold text-white">{formatTime(timeLeft)}</Text>
          <Text className="text-white text-lg mt-2">
            {isBreak ? 'Break Time' : 'Focus Time'}
          </Text>
        </View>

        <View className="flex-row gap-5 mt-8">
          <TouchableOpacity
            className={`w-16 h-16 rounded-full justify-center items-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            onPress={() => setIsRunning(!isRunning)}
          >
            <Ionicons
              name={isRunning ? 'pause' : 'play'}
              size={24}
              color={isDark ? '#fff' : '#000'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            className={`w-16 h-16 rounded-full justify-center items-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            onPress={() => {
              setIsRunning(false);
              setTimeLeft(isBreak ? 5 * 60 : 25 * 60);
            }}
          >
            <Ionicons
              name="refresh"
              size={24}
              color={isDark ? '#fff' : '#000'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View className="mt-8">
        <Text className={`text-xl font-bold mb-5 ${isDark ? 'text-white' : 'text-black'}`}>
          Focus Settings
        </Text>
        <View className="flex-row items-center py-4 border-b border-gray-200">
          <Ionicons
            name="notifications-off"
            size={24}
            color={isDark ? '#fff' : '#000'}
          />
          <Text className={`flex-1 ml-4 text-base ${isDark ? 'text-white' : 'text-black'}`}>
            Block Notifications
          </Text>
          <Switch
            value={isDistractionBlocked}
            onValueChange={setIsDistractionBlocked}
          />
        </View>
        <View className="flex-row items-center py-4 border-b border-gray-200">
          <Ionicons
            name="musical-notes"
            size={24}
            color={isDark ? '#fff' : '#000'}
          />
          <Text className={`flex-1 ml-4 text-base ${isDark ? 'text-white' : 'text-black'}`}>
            Background Music
          </Text>
          <Switch
            value={false}
            onValueChange={() => {}}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
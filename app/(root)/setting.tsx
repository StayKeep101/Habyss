
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Setting = () => {
  return (
    <SafeAreaView className="flex-1 justify-center items-center bg-white">
      <View className="absolute top-10 left-10">
        <Text className="text-2xl font-bold text-gray-800">Setting</Text>
      </View>
    </SafeAreaView>
  );
};

export default Setting;
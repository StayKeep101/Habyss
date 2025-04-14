import React, {useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AI from "../ai";

const Home = () => {
  const bottomSheetRef = useRef<BottomSheet>(null)
  const openBottomSheet = () => {
    console.log("Opening bottom sheet...");
    if (bottomSheetRef.current) {
      bottomSheetRef.current.expand(); // Expands to the highest snap point
    }
  };
 
  return (
    <GestureHandlerRootView>
      <SafeAreaView className="flex-1 bg-gray-100 p-5">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-3xl font-bold text-gray-900">Today</Text>
        </View>

        {/* Floating Create Button */}
        <TouchableOpacity
          className="absolute bottom-20 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          onPress={openBottomSheet}
        >
          <Ionicons name="chatbox" size={28} color="white" />
        </TouchableOpacity>

        {/* Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={["100%"]}
          enablePanDownToClose={true}
          style={{ zIndex: 999 }}
        >
          <BottomSheetScrollView ref = {bottomSheetRef} >

          <AI />
          </BottomSheetScrollView>
        </BottomSheet>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export default Home;

import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Modal from "react-native-modal"; // Import react-native-modal
import { useHaptics } from "../../../hooks/useHaptics";

const Create = () => {
  const [isModalVisible, setModalVisible] = useState(false);
  const { lightFeedback, mediumFeedback } = useHaptics();

  const handleCreateButtonPress = () => {
    lightFeedback();
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    lightFeedback();
    setModalVisible(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100 p-5">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-3xl font-bold text-gray-900">Create</Text>
      </View>

      {/* Floating Create Button */}
      <TouchableOpacity
        onPress={handleCreateButtonPress}
        className="absolute bottom-20 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* Improved Modal */}
      <Modal
        isVisible={isModalVisible}
        swipeDirection="down"
        onSwipeComplete={handleCloseModal} // Close on swipe
        onBackdropPress={handleCloseModal} // Close on backdrop press
        animationIn="slideInUp"
        animationOut="slideOutDown"
        style={{ justifyContent: "flex-end", margin: 2 }}
      >
        <View className="bg-white rounded-t-2xl p-6 pb-96">
          {/* Drag Handle */}
          <View className="w-10 h-1 bg-gray-400 rounded-full self-center mb-3" />

          {/* Modal Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-800">Add New Habit</Text>
            <TouchableOpacity onPress={handleCloseModal}>
              <Ionicons name="close" size={24} color="gray" />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <Text className="text-gray-600">Enter details for your new habit.</Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Create;

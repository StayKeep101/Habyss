import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  pending?: boolean;
}

const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "1", 
      text: "Hello! I'm your AI assistant. How can I help you today?", 
      sender: "bot" 
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (input.trim() === "") return;
    const userMessage: Message = { 
      id: Date.now().toString(), 
      text: input.trim(), 
      sender: "user" as const 
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulated AI response with typing indicator
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I understand your message. I'm here to help you with any questions or tasks you have. Feel free to ask anything! 🤖",
        sender: "bot" as const
      };
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const MessageBubble = ({ message }: { message: Message }) => {
    const isUser = message.sender === "user";
    return (
      <View
        className={`flex-row ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        {!isUser && (
          <View className="w-8 h-8 rounded-full bg-emerald-600 mr-3 items-center justify-center">
            <Ionicons name="logo-github" size={20} color="white" />
          </View>
        )}
        <View
          className={`${
            isUser ? 'bg-blue-600' : 'bg-gray-200'
          } px-4 py-3 rounded-2xl max-w-[80%]`}
        >
          <Text
            className={`text-[16px] ${
              isUser ? 'text-white' : 'text-gray-800'
            }`}
          >
            {message.text}
          </Text>
        </View>
        {isUser && (
          <View className="w-8 h-8 rounded-full bg-gray-400 ml-3 items-center justify-center">
            <Ionicons name="person" size={20} color="white" />
          </View>
        )}
      </View>
    );
  };

  const TypingIndicator = () => (
    <View className="flex-row items-center mb-4">
      <View className="w-8 h-8 rounded-full bg-emerald-600 mr-3 items-center justify-center">
        <Ionicons name="logo-github" size={20} color="white" />
      </View>
      <View className="bg-gray-200 px-4 py-3 rounded-2xl">
        <ActivityIndicator color="#4B5563" size="small" />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200">
        <Text className="text-2xl font-semibold text-gray-800">AI Assistant</Text>
      </View>

      {/* Chat Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={scrollToBottom}
        />
        
        {isTyping && <TypingIndicator />}

        {/* Input Area */}
        <View className="border-t border-gray-200 p-4 bg-white">
          <View className="flex-row items-center bg-gray-100 rounded-2xl px-4">
            <TextInput
              className="flex-1 py-3 text-base text-gray-700"
              placeholder="Message AI assistant..."
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              onSubmitEditing={sendMessage}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={input.trim() === ""}
              className={`ml-2 ${input.trim() === "" ? "opacity-50" : ""}`}
            >
              <Ionicons 
                name="send" 
                size={24} 
                color={input.trim() === "" ? "#9CA3AF" : "#2563EB"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AIChat;

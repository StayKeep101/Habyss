import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface Suggestion {
  id: string;
  text: string;
  icon: string;
}

const AIChat = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your Habyss AI assistant. I can help you create habits, set goals, track your progress, and provide motivation. What would you like to work on today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const suggestions: Suggestion[] = [
    { id: '1', text: 'Create a new habit', icon: 'add-circle' },
    { id: '2', text: 'Set a goal', icon: 'flag' },
    { id: '3', text: 'Track my progress', icon: 'stats-chart' },
    { id: '4', text: 'Get motivation', icon: 'heart' },
    { id: '5', text: 'Plan my day', icon: 'calendar' },
    { id: '6', text: 'Analyze my data', icon: 'analytics' },
  ];

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    lightFeedback();
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse = generateAIResponse(text);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('habit') || input.includes('create')) {
      return "Great! Let's create a new habit. What specific habit would you like to build? For example: 'I want to exercise daily' or 'I want to read 30 minutes before bed'. I can help you set up reminders, track progress, and provide motivation along the way.";
    }
    
    if (input.includes('goal') || input.includes('set')) {
      return "Perfect! Setting goals is crucial for success. What's your goal? Be specific and measurable. For example: 'I want to lose 10 pounds in 3 months' or 'I want to read 12 books this year'. I'll help you break it down into actionable steps and track your progress.";
    }
    
    if (input.includes('progress') || input.includes('track')) {
      return "I can help you track your progress! Based on your current habits, you're doing great. Your streak is 12 days and you've completed 87% of your daily goals. Would you like to see detailed analytics or get personalized insights to improve further?";
    }
    
    if (input.includes('motivation') || input.includes('inspire')) {
      return "Remember: Every expert was once a beginner. Your consistency is building the foundation for lasting change. You've already shown incredible dedication - keep going! What's one small step you can take today? I'm here to cheer you on every step of the way.";
    }
    
    if (input.includes('plan') || input.includes('schedule')) {
      return "Let's plan your day! Based on your habits, I suggest: 6:00 AM - Morning exercise, 8:00 AM - Focus work session, 12:00 PM - Healthy lunch, 3:00 PM - Reading break, 8:00 PM - Evening reflection. Would you like me to set reminders or help you adjust this schedule?";
    }
    
    if (input.includes('help') || input.includes('support')) {
      return "I'm here to help! I can assist with habit creation, goal setting, progress tracking, motivation, and daily planning. Just tell me what you'd like to work on, and I'll provide personalized guidance and support.";
    }
    
    return "I understand you're asking about '" + userInput + "'. I'm here to help you build better habits and achieve your goals. Could you be more specific about what you'd like to work on? I can help with habit creation, goal setting, progress tracking, motivation, and much more!";
  };

  const handleSuggestionPress = (suggestion: Suggestion) => {
    sendMessage(suggestion.text);
  };

  const handleClearChat = () => {
    mediumFeedback();
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear the chat history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            setMessages([{
              id: '1',
              text: "Hello! I'm your Habyss AI assistant. I can help you create habits, set goals, track your progress, and provide motivation. What would you like to work on today?",
              isUser: false,
              timestamp: new Date()
            }]);
          }
        }
      ]
    );
  };

  const handleAISettings = () => {
    lightFeedback();
    Alert.alert(
      'AI Settings',
      'AI assistant settings coming soon! You\'ll be able to customize the AI personality, response style, and notification preferences.',
      [{ text: 'OK' }]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-4 border-b" style={{ borderColor: colors.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View 
              className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
              style={{ backgroundColor: colors.primary }}
            >
              <Ionicons name="sparkles" size={24} color="white" />
            </View>
            <View>
              <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                Habyss AI
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Your personal improvement assistant
              </Text>
            </View>
          </View>
          <View className="flex-row space-x-2">
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleAISettings}
            >
              <Ionicons name="settings" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleClearChat}
            >
              <Ionicons name="trash" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={() => {
                lightFeedback();
                router.back();
              }}
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        className="flex-1" 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              className={`mb-4 ${message.isUser ? 'items-end' : 'items-start'}`}
            >
              <View
                className={`max-w-[80%] p-4 rounded-2xl ${
                  message.isUser 
                    ? 'rounded-br-md' 
                    : 'rounded-bl-md'
                }`}
                style={{
                  backgroundColor: message.isUser 
                    ? colors.primary 
                    : colors.surfaceSecondary
                }}
              >
                <Text
                  className="text-base"
                  style={{
                    color: message.isUser 
                      ? 'white' 
                      : colors.textPrimary
                  }}
                >
                  {message.text}
                </Text>
                <Text
                  className="text-xs mt-2"
                  style={{
                    color: message.isUser 
                      ? 'rgba(255,255,255,0.7)' 
                      : colors.textTertiary
                  }}
                >
                  {formatTime(message.timestamp)}
                </Text>
              </View>
            </View>
          ))}
          
          {isTyping && (
            <View className="mb-4 items-start">
              <View
                className="max-w-[80%] p-4 rounded-2xl rounded-bl-md"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <View className="flex-row items-center">
                  <View className="flex-row space-x-1">
                    <View 
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: colors.textTertiary }}
                    />
                    <View 
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: colors.textTertiary }}
                    />
                    <View 
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: colors.textTertiary }}
                    />
                  </View>
                  <Text className="text-sm ml-2" style={{ color: colors.textSecondary }}>
                    AI is typing...
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestions */}
        {messages.length === 1 && (
          <View className="px-6 pb-4">
            <Text className="text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>
              Quick suggestions:
            </Text>
            <View className="flex-row flex-wrap">
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.id}
                  className="mr-2 mb-2 px-4 py-3 rounded-2xl"
                  style={{ backgroundColor: colors.surfaceSecondary }}
                  onPress={() => handleSuggestionPress(suggestion)}
                >
                  <View className="flex-row items-center">
                    <Ionicons 
                      name={suggestion.icon as any} 
                      size={18} 
                      color={colors.primary} 
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      {suggestion.text}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input */}
        <View className="px-6 pb-6 pt-2">
          <View className="flex-row items-end space-x-3">
            <View className="flex-1">
              <TextInput
                ref={inputRef}
                className="p-4 rounded-2xl text-base"
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                placeholder="Ask me anything about habits, goals, or productivity..."
                placeholderTextColor={colors.textTertiary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                onSubmitEditing={() => sendMessage(inputText)}
              />
            </View>
            <TouchableOpacity
              className="w-14 h-14 rounded-2xl items-center justify-center"
              style={{ 
                backgroundColor: inputText.trim() ? colors.primary : colors.surfaceSecondary 
              }}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim()}
            >
              <Ionicons 
                name="send" 
                size={24} 
                color={inputText.trim() ? 'white' : colors.textTertiary} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AIChat;

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'habits' | 'focus' | 'technical';
}

interface SupportOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  action: () => void;
}

const HelpSupport = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { lightFeedback, mediumFeedback } = useHaptics();

  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const faqs: FAQItem[] = [
    {
      id: '1',
      question: 'How do I create a new habit?',
      answer: 'Go to the Home screen and tap the "+" button to add a new habit. You can customize the name, category, and reminder settings.',
      category: 'habits'
    },
    {
      id: '2',
      question: 'How does the focus timer work?',
      answer: 'The focus timer uses the Pomodoro technique. Choose a session type (Pomodoro, Deep Focus, or Break) and start your focused work session.',
      category: 'focus'
    },
    {
      id: '3',
      question: 'Can I sync my data across devices?',
      answer: 'Yes! Enable auto-sync in Settings to keep your habits and progress synchronized across all your devices.',
      category: 'general'
    },
    {
      id: '4',
      question: 'How do I change my notification settings?',
      answer: 'Go to Settings > Notifications to customize which alerts you receive and when.',
      category: 'general'
    },
    {
      id: '5',
      question: 'What is the AI assistant for?',
      answer: 'The AI assistant helps you create habits, set goals, track progress, and provides motivation. Just chat with it to get personalized advice.',
      category: 'general'
    },
    {
      id: '6',
      question: 'How do I export my data?',
      answer: 'Go to Settings > Data & Storage > Export Data to download a copy of all your information.',
      category: 'technical'
    },
    {
      id: '7',
      question: 'Can I use the app offline?',
      answer: 'Yes! Most features work offline. Your data will sync when you\'re back online.',
      category: 'technical'
    },
    {
      id: '8',
      question: 'How do I reset my progress?',
      answer: 'Go to Settings > Data & Storage > Clear Data to reset your progress. This action cannot be undone.',
      category: 'technical'
    }
  ];

  const supportOptions: SupportOption[] = [
    {
      id: '1',
      title: 'Contact Support',
      subtitle: 'Get help from our team',
      icon: 'chatbubble-ellipses',
      color: colors.primary,
      action: () => {
        lightFeedback();
        Alert.alert(
          'Contact Support',
          'How can we help you?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Email Support', onPress: () => {
              Alert.alert('Email Support', 'support@habyss.app\nWe\'ll respond within 24 hours.');
            }},
            { text: 'Live Chat', onPress: () => {
              Alert.alert('Live Chat', 'Live chat feature coming soon!');
            }}
          ]
        );
      }
    },
    {
      id: '2',
      title: 'Report a Bug',
      subtitle: 'Help us improve the app',
      icon: 'bug',
      color: colors.warning,
      action: () => {
        lightFeedback();
        Alert.alert(
          'Report a Bug',
          'Describe the issue you encountered:',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Submit Report', onPress: () => {
              Alert.alert('Thank You', 'Your bug report has been submitted. We\'ll investigate and fix it soon!');
            }}
          ]
        );
      }
    },
    {
      id: '3',
      title: 'Feature Request',
      subtitle: 'Suggest new features',
      icon: 'lightbulb',
      color: colors.success,
      action: () => {
        lightFeedback();
        Alert.alert(
          'Feature Request',
          'What feature would you like to see in Habyss?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Submit Request', onPress: () => {
              Alert.alert('Thank You', 'Your feature request has been submitted. We\'ll consider it for future updates!');
            }}
          ]
        );
      }
    },
    {
      id: '4',
      title: 'User Guide',
      subtitle: 'Learn how to use the app',
      icon: 'book',
      color: colors.secondary,
      action: () => {
        lightFeedback();
        Alert.alert(
          'User Guide',
          'Would you like to view the complete user guide?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'View Guide', onPress: () => {
              Alert.alert('User Guide', 'User guide will open in your browser.');
            }}
          ]
        );
      }
    }
  ];

  const toggleFAQ = (id: string) => {
    lightFeedback();
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleRateApp = () => {
    lightFeedback();
    Alert.alert(
      'Rate Habyss',
      'Enjoying the app? Please rate us on the App Store!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rate Now', onPress: () => {
          Alert.alert('Thank You', 'Thank you for your feedback!');
        }}
      ]
    );
  };

  const handleShareApp = () => {
    lightFeedback();
    Alert.alert(
      'Share Habyss',
      'Share the app with friends and family!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => {
          Alert.alert('Shared', 'App shared successfully!');
        }}
      ]
    );
  };

  const groupedFAQs = faqs.reduce((acc, faq) => {
    if (!acc[faq.category]) {
      acc[faq.category] = [];
    }
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, FAQItem[]>);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity 
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={() => {
                lightFeedback();
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View>
              <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                Help & Support
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Get help and find answers
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Get Help
          </Text>
          <View className="grid grid-cols-2 gap-3">
            {supportOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                className="p-4 rounded-2xl items-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={option.action}
              >
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: option.color + '20' }}
                >
                  <Ionicons name={option.icon as any} size={24} color={option.color} />
                </View>
                <Text className="font-semibold text-sm text-center" style={{ color: colors.textPrimary }}>
                  {option.title}
                </Text>
                <Text className="text-xs text-center mt-1" style={{ color: colors.textSecondary }}>
                  {option.subtitle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Feedback */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            App Feedback
          </Text>
          <View className="flex-row space-x-3">
            <TouchableOpacity
              className="flex-1 p-4 rounded-2xl items-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleRateApp}
            >
              <Ionicons name="star" size={24} color={colors.warning} />
              <Text className="font-semibold mt-2" style={{ color: colors.textPrimary }}>
                Rate App
              </Text>
              <Text className="text-xs text-center mt-1" style={{ color: colors.textSecondary }}>
                Share your experience
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 p-4 rounded-2xl items-center"
              style={{ backgroundColor: colors.surfaceSecondary }}
              onPress={handleShareApp}
            >
              <Ionicons name="share-social" size={24} color={colors.success} />
              <Text className="font-semibold mt-2" style={{ color: colors.textPrimary }}>
                Share App
              </Text>
              <Text className="text-xs text-center mt-1" style={{ color: colors.textSecondary }}>
                Tell your friends
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Frequently Asked Questions
          </Text>
          {Object.entries(groupedFAQs).map(([category, categoryFAQs]) => (
            <View key={category} className="mb-4">
              <Text className="text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
              <View 
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                {categoryFAQs.map((faq, index) => (
                  <View key={faq.id}>
                    <TouchableOpacity
                      className="p-4"
                      onPress={() => toggleFAQ(faq.id)}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="flex-1 font-medium" style={{ color: colors.textPrimary }}>
                          {faq.question}
                        </Text>
                        <Ionicons 
                          name={expandedFAQ === faq.id ? 'chevron-up' : 'chevron-down'} 
                          size={20} 
                          color={colors.textTertiary} 
                        />
                      </View>
                      {expandedFAQ === faq.id && (
                        <Text className="text-sm mt-3" style={{ color: colors.textSecondary }}>
                          {faq.answer}
                        </Text>
                      )}
                    </TouchableOpacity>
                    {index < categoryFAQs.length - 1 && (
                      <View 
                        className="h-[0.5px] mx-4"
                        style={{ backgroundColor: colors.border }}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* App Information */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            App Information
          </Text>
          <View 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                Version
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                1.0.0
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                Build
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                2024.1.0
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                Last Updated
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                December 2024
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                Support Email
              </Text>
              <Text style={{ color: colors.primary }}>
                support@habyss.app
              </Text>
            </View>
          </View>
        </View>

        {/* Legal Links */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
            Legal
          </Text>
          <View className="space-y-3">
            {[
              { title: 'Privacy Policy', icon: 'shield-checkmark' },
              { title: 'Terms of Service', icon: 'document-text' },
              { title: 'Cookie Policy', icon: 'cafe' },
              { title: 'Licenses', icon: 'library' }
            ].map((item, index) => (
              <TouchableOpacity
                key={index}
                className="flex-row items-center p-4 rounded-2xl"
                style={{ backgroundColor: colors.surfaceSecondary }}
                onPress={() => {
                  lightFeedback();
                  Alert.alert(item.title, `${item.title} will open in your browser.`);
                }}
              >
                <Ionicons name={item.icon as any} size={20} color={colors.primary} />
                <Text className="ml-3 font-semibold" style={{ color: colors.textPrimary }}>
                  {item.title}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default HelpSupport;

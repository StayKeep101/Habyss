import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import AIAgentButton from './AIAgentButton';
import AIChatModal from './AIChatModal';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { PaywallModal } from '../Stripe/PaywallModal';
import { StripeService } from '@/lib/stripeService';
import { useAIPersonality } from '@/constants/AIPersonalityContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const AIAgentWrapper: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [hasNewSuggestion, setHasNewSuggestion] = useState(false);
  const { paywallGuard } = usePremiumStatus();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your Habyss AI Assistant. How can I help you build better habits today?",
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);

  const { personalityId } = useAIPersonality();

  // Reset conversation when personality changes
  React.useEffect(() => {
    const mode = PERSONALITY_MODES.find(m => m.id === personalityId);
    if (mode) {
      setMessages([
        {
          id: 'init',
          text: mode.systemPrompt.split('.')[0] + ". How can I help?", // Simple greeting
          sender: 'ai',
          timestamp: new Date(),
        }
      ]);
    }
  }, [personalityId]);

  const handleSendMessage = useCallback(async (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Simulate AI thinking
    setIsThinking(true);

    // Mock AI response after a delay
    setTimeout(() => {
      const mode = PERSONALITY_MODES.find(m => m.id === personalityId) || PERSONALITY_MODES[1]; // Default to normal

      let responseText = "";
      const lowerText = text.toLowerCase();

      if (lowerText.includes('complete') || lowerText.includes('done') || lowerText.includes('finished')) {
        responseText = mode.examples.success;
      } else if (lowerText.includes('missed') || lowerText.includes('fail') || lowerText.includes('forgot')) {
        responseText = mode.examples.failure;
      } else if (lowerText.includes('progress') || lowerText.includes('check') || lowerText.includes('how am i doing')) {
        responseText = mode.examples.checkin;
      } else {
        // Default / Fallback
        if (mode.id === 'friendly') {
          responseText = "That sounds interesting! Tell me more! 😊 I'm here to listen and support you!";
        } else if (mode.id === 'bully_mode') {
          responseText = "Is that all you have to say? Stop wasting my time and go do some work. Weak.";
        } else if (mode.id === 'dad_mode') {
          responseText = "I hear you. But actions speak louder than words. What's the plan?";
        } else {
          responseText = "I understand. Let's focus on your goals. What specific habit are you working on?";
        }
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsThinking(false);
      setHasNewSuggestion(true);
    }, 1500);
  }, [personalityId]);

  const handleOpenModal = () => {
    paywallGuard(
      'ai_coaching_button',
      () => {
        setIsModalVisible(true);
        setHasNewSuggestion(false);
      },
      () => router.push('/paywall')
    );
  };

  const handleSubscribe = async () => {
    setIsRedirecting(true);
    try {
      const checkoutUrl = await StripeService.createCheckoutSession();
      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl);
      } else {
        // No error thrown, just no URL - show friendly message
        Alert.alert(
          'Payment System Setup',
          'Our payment system is currently being configured. Please check back in a few moments or contact support if this persists.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      // Don't log to console - just show user-friendly message
      Alert.alert(
        'Unable to Start Checkout',
        error.message || 'Our payment system is currently being set up. Please try again in a few minutes or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRedirecting(false);
      setIsPaywallVisible(false);
    }
  };

  return (
    <>
      <AIAgentButton
        onPress={handleOpenModal}
        isThinking={isThinking}
        hasNewSuggestion={hasNewSuggestion}
      />
      <AIChatModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        isThinking={isThinking}
      />
      <PaywallModal
        visible={isPaywallVisible}
        onClose={() => setIsPaywallVisible(false)}
        onSubscribe={handleSubscribe}
        loading={isRedirecting}
      />
    </>
  );
};

export default AIAgentWrapper;

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import AIAgentButton from './AIAgentButton';
import AIChatModal from './AIChatModal';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { PaywallModal } from '../Stripe/PaywallModal';
import { StripeService } from '@/lib/stripeService';

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
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `I've received your message: "${text}". I'm analyzing your goals and progress to provide the best advice. (This is a mock response)`,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsThinking(false);
      setHasNewSuggestion(true);
    }, 2000);
  }, []);

  const handleOpenModal = () => {
    paywallGuard(
      'ai_coaching_button',
      () => {
        setIsModalVisible(true);
        setHasNewSuggestion(false);
      },
      () => setIsPaywallVisible(true)
    );
  };

  const handleSubscribe = async () => {
    setIsRedirecting(true);
    try {
      const checkoutUrl = await StripeService.createCheckoutSession();
      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl);
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
      Alert.alert('Error', 'Failed to start checkout. Please try again later.');
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

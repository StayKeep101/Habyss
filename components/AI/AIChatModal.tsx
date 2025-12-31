import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown 
} from 'react-native-reanimated';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AIChatModalProps {
  isVisible: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isThinking?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const AIChatModal: React.FC<AIChatModalProps> = ({ 
  isVisible, 
  onClose, 
  messages, 
  onSendMessage,
  isThinking = false
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { lightFeedback, mediumFeedback } = useHaptics();
  const [inputText, setInputText] = useState('');
  const [showContextBanner, setShowContextBanner] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
      mediumFeedback();
    }
  };

  const quickActions = [
    "Create habit sequence from goal",
    "Analyze my progress",
    "Suggest improvements",
    "Review my habits"
  ];

  const renderMessage = ({ item }: { item: Message }) => {
    const isAI = item.sender === 'ai';
    return (
      <View style={[
        styles.messageContainer, 
        isAI ? styles.aiMessageContainer : styles.userMessageContainer
      ]}>
        <View style={[
          styles.messageBubble, 
          isAI ? { backgroundColor: colors.surfaceSecondary } : { backgroundColor: colors.primary }
        ]}>
          <Text style={[
            styles.messageText, 
            { color: isAI ? colors.textPrimary : 'white' }
          ]}>
            {item.text}
          </Text>
        </View>
        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose} 
        />
        
        <Animated.View 
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
          style={[styles.modalContent, { backgroundColor: colors.background }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerEmoji]}>🤖</Text>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Habyss AI Assistant</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Here to help you build better habits</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Context Banner */}
          {showContextBanner && (
            <Animated.View 
              entering={FadeIn}
              exiting={FadeOut}
              style={[styles.contextBanner, { backgroundColor: colors.primary + '10', borderBottomColor: colors.border }]}
            >
              <View style={styles.contextBannerContent}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                  I can see you have 3 active goals. Ready to analyze your progress?
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowContextBanner(false)}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Conversation Area */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={isThinking ? (
              <View style={styles.thinkingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>AI is thinking...</Text>
              </View>
            ) : null}
          />

          {/* Quick Action Chips */}
          <View style={styles.quickActionsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
              {quickActions.map((action, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[styles.quickActionChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={() => {
                    setInputText(action);
                    lightFeedback();
                  }}
                >
                  <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>{action}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Area */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceSecondary }]}
                  placeholder="Ask me anything about your habits..."
                  placeholderTextColor={colors.textTertiary}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={1000}
                />
                {inputText.length > 200 && (
                  <Text style={[styles.charCounter, { color: colors.textTertiary }]}>
                    {inputText.length}/1000
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.surfaceSecondary }]}
                onPress={handleSend}
                disabled={!inputText.trim()}
              >
                <Ionicons 
                  name={inputText.trim() ? "send" : "mic"} 
                  size={20} 
                  color={inputText.trim() ? "white" : colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    height: SCREEN_HEIGHT * 0.75,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  closeButton: {
    padding: 4,
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  contextBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contextText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 32,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    marginHorizontal: 4,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  thinkingText: {
    fontSize: 12,
    marginLeft: 8,
  },
  quickActionsContainer: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  quickActionsScroll: {
    paddingHorizontal: 16,
  },
  quickActionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 12,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  input: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingRight: 40,
    maxHeight: 100,
    fontSize: 15,
  },
  charCounter: {
    position: 'absolute',
    right: 12,
    bottom: 8,
    fontSize: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AIChatModal;

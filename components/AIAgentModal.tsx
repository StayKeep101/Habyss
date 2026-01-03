import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
    withRepeat,
    Easing
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptics } from '@/hooks/useHaptics';

const { width, height } = Dimensions.get('window');

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIAgentModalProps {
    visible: boolean;
    onClose: () => void;
}

const INITIAL_MESSAGES: Message[] = [
    {
        id: '1',
        role: 'assistant',
        content: "Hey! I'm your Habyss AI assistant. I can help you create habits, set goals, and track your progress. What would you like to do?",
        timestamp: new Date(),
    }
];

// Mock AI responses
const AI_RESPONSES: Record<string, string> = {
    'create': "I'd love to help you create something new! Would you like to:\n\n• Create a new **habit** (daily rituals)\n• Create a new **goal** (long-term objectives)\n\nJust tell me which one and what you'd like to call it!",
    'habit': "Great! To create a habit, just tell me:\n\n• The name (e.g., 'Morning Meditation')\n• The category (health, productivity, mindfulness, etc.)\n• How long it takes (optional)\n\nFor example: 'Create a 10-minute morning meditation habit for health'",
    'goal': "Awesome! For a goal, I'll need:\n\n• The goal name\n• A target date\n• What habits you want to link to it\n\nFor example: 'I want to lose 10 pounds by March'",
    'help': "Here's what I can do for you:\n\n🎯 **Create habits or goals** - Just describe what you want\n📊 **Check your progress** - Ask 'How am I doing?'\n✅ **Mark habits complete** - Say 'I finished my workout'\n🔗 **Link habits to goals** - Connect related activities\n\nWhat would you like to do?",
    'help': "Here's what I can do for you:\n\n🎯 **Create habits or goals** - Just describe what you want\n📊 **Check your progress** - Ask 'How am I doing?'\n✅ **Mark habits complete** - Say 'I finished my workout'\n🔗 **Link habits to goals** - Connect related activities\n\nWhat would you like to do?",
    'default': "I understand! Let me help you with that. Could you tell me more about what you'd like to accomplish?",
};

const SUGGESTIONS = [
    "Create a workout goal",
    "Log water habit",
    "How is my streak?",
    "Add meditation",
    "Show my goals"
];

export const AIAgentModal: React.FC<AIAgentModalProps> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, successFeedback } = useHaptics();

    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Animated glow effect
    const glowOpacity = useSharedValue(0.5);

    useEffect(() => {
        glowOpacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const handleSend = async () => {
        if (!inputText.trim()) return;

        lightFeedback();

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputText.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsTyping(true);

        // Simulate AI thinking
        setTimeout(() => {
            const lowercaseInput = inputText.toLowerCase();
            let response = AI_RESPONSES['default'];

            if (lowercaseInput.includes('create') || lowercaseInput.includes('new') || lowercaseInput.includes('add')) {
                response = AI_RESPONSES['create'];
            } else if (lowercaseInput.includes('habit') || lowercaseInput.includes('ritual')) {
                response = AI_RESPONSES['habit'];
            } else if (lowercaseInput.includes('goal') || lowercaseInput.includes('target')) {
                response = AI_RESPONSES['goal'];
            } else if (lowercaseInput.includes('help') || lowercaseInput.includes('what can you')) {
                response = AI_RESPONSES['help'];
            }

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, aiMessage]);
            setIsTyping(false);
            successFeedback();
        }, 1000 + Math.random() * 1000);
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';

        return (
            <Animated.View
                entering={SlideInDown.duration(300)}
                style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                    { backgroundColor: isUser ? colors.primary : 'rgba(255,255,255,0.08)' }
                ]}
            >
                {!isUser && (
                    <View style={styles.aiAvatar}>
                        <LinearGradient
                            colors={['#10B981', '#3B82F6']}
                            style={styles.avatarGradient}
                        >
                            <Ionicons name="sparkles" size={14} color="#fff" />
                        </LinearGradient>
                    </View>
                )}
                <Text style={[
                    styles.messageText,
                    { color: isUser ? '#000' : colors.textPrimary }
                ]}>
                    {item.content}
                </Text>
            </Animated.View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="none"
            transparent
            onRequestClose={onClose}
        >
            <Animated.View
                entering={FadeIn.duration(400)}
                exiting={FadeOut.duration(300)}
                style={styles.overlay}
            >
                <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
                    {/* Animated background glow */}
                    <Animated.View style={[styles.glowEffect, glowStyle]}>
                        <LinearGradient
                            colors={['transparent', 'rgba(16, 185, 129, 0.15)', 'transparent']}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <LinearGradient
                                colors={['#10B981', '#3B82F6']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.headerIcon}
                            >
                                <Ionicons name="sparkles" size={18} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.headerTitle}>HABYSS AI</Text>
                                <Text style={styles.headerSubtitle}>Your personal assistant</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    </View>

                    {/* Messages */}
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.chatContainer}
                        keyboardVerticalOffset={0}
                    >
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.messagesList}
                            showsVerticalScrollIndicator={false}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            keyboardShouldPersistTaps="handled"
                        />

                        {/* Typing indicator */}
                        {isTyping && (
                            <Animated.View
                                entering={FadeIn}
                                exiting={FadeOut}
                                style={styles.typingIndicator}
                            >
                                <View style={styles.typingDots}>
                                    <View style={[styles.dot, { animationDelay: '0s' }]} />
                                    <View style={[styles.dot, { animationDelay: '0.2s' }]} />
                                    <View style={[styles.dot, { animationDelay: '0.4s' }]} />
                                </View>
                                <Text style={styles.typingText}>AI is thinking...</Text>
                            </Animated.View>
                        )}

                        {/* Suggestions */}
                        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                            <FlatList
                                data={SUGGESTIONS}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 8 }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setInputText(item);
                                            lightFeedback();
                                        }}
                                        style={styles.suggestionChip}
                                    >
                                        <Text style={styles.suggestionText}>{item}</Text>
                                    </TouchableOpacity>
                                )}
                                keyExtractor={item => item}
                            />
                        </View>

                        {/* Input - positioned above keyboard */}
                        <View style={styles.inputContainer}>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ask me anything..."
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={inputText}
                                    onChangeText={setInputText}
                                    onSubmitEditing={handleSend}
                                    returnKeyType="send"
                                    multiline
                                />
                                <View style={styles.inputIcons}>
                                    <TouchableOpacity style={styles.iconBtnSmall}>
                                        <Ionicons name="image-outline" size={20} color="rgba(255,255,255,0.6)" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconBtnSmall}>
                                        <Ionicons name="mic-outline" size={20} color="rgba(255,255,255,0.6)" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleSend}
                                disabled={!inputText.trim()}
                                style={[
                                    styles.sendButton,
                                    { opacity: inputText.trim() ? 1 : 0.5 }
                                ]}
                            >
                                <LinearGradient
                                    colors={['#10B981', '#3B82F6']}
                                    style={styles.sendGradient}
                                >
                                    <Ionicons name="arrow-up" size={20} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </BlurView>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    blurContainer: {
        flex: 1,
    },
    glowEffect: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 2,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'SpaceMono-Regular',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatContainer: {
        flex: 1,
    },
    messagesList: {
        padding: 20,
        paddingBottom: 100,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: 14,
        borderRadius: 18,
        marginBottom: 12,
    },
    userBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    aiAvatar: {
        marginTop: 2,
    },
    avatarGradient: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
        flex: 1,
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 8,
    },
    typingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    typingText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontFamily: 'SpaceMono-Regular',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 16,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        gap: 12,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 24,
        paddingRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    input: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 15,
        maxHeight: 100,
        fontFamily: 'SpaceMono-Regular',
    },
    inputIcons: {
        flexDirection: 'row',
        gap: 4,
        paddingRight: 4,
    },
    iconBtnSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestionChip: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    suggestionText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontFamily: 'SpaceMono-Regular',
    },
    sendButton: {
        width: 44,
        height: 44,
    },
    sendGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

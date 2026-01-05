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
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
    withRepeat,
    Easing,
    FadeIn,
    FadeOut,
    SlideInDown,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptics } from '@/hooks/useHaptics';
import { StripeService } from '@/lib/stripeService';
import { useRouter } from 'expo-router';
import { streamChatCompletion, ChatMessage as GeminiMessage } from '@/lib/gemini';
import { useAIPersonality } from '@/constants/AIPersonalityContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';

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

// Mock suggestions
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
    const { lightFeedback, successFeedback, mediumFeedback, errorFeedback } = useHaptics();
    const router = useRouter();
    const { personalityId } = useAIPersonality();

    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isPremium, setIsPremium] = useState<boolean | null>(null);
    const [checkingPremium, setCheckingPremium] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    // Check premium status
    useEffect(() => {
        if (visible) {
            setCheckingPremium(true);
            StripeService.getSubscriptionStatus().then(status => {
                setIsPremium(status.premium);
                setCheckingPremium(false);
            });
        }
    }, [visible]);

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
        const content = inputText.trim();
        setInputText('');
        setIsTyping(true);

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);

        // Prepare context for AI
        const personality = PERSONALITY_MODES.find(p => p.id === personalityId) || PERSONALITY_MODES[1];

        // Convert to Gemini Format
        // Note: Gemini doesn't support 'system' role in history effectively for all models in same way.
        // We pass system prompt separately.
        const geminiHistory: GeminiMessage[] = newMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        await streamChatCompletion(
            geminiHistory,
            personality.systemPrompt,
            (chunk) => { },
            (reply) => {
                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: reply,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, aiMessage]);
                setIsTyping(false);
                successFeedback();
            },
            (error) => {
                console.error(error);
                setIsTyping(false);
                errorFeedback();

                const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I'm having trouble connecting to Gemini. Please check your API key.",
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        );
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
                            colors={['#3B82F6', '#8B5CF6', '#EC4899']}
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
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
                <View style={styles.contentOverlay}>
                    <SafeAreaView style={{ flex: 1 }}>
                        {/* Animated background glow */}
                        <Animated.View style={[styles.glowEffect, glowStyle]}>
                            <LinearGradient
                                colors={['transparent', 'rgba(16, 185, 129, 0.15)', 'transparent']}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>

                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                            <View style={styles.headerCenter}>
                                <LinearGradient
                                    colors={['#3B82F6', '#8B5CF6', '#EC4899']}
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
                            <View style={{ width: 40 }} />
                        </View>

                        {/* Premium Check Loading */}
                        {checkingPremium ? (
                            <View style={styles.paywallContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                            </View>
                        ) : !isPremium ? (
                            /* Paywall for non-premium users */
                            <View style={styles.paywallContainer}>
                                <LinearGradient
                                    colors={['rgba(59, 130, 246, 0.2)', 'rgba(236, 72, 153, 0.2)']}
                                    style={styles.paywallIcon}
                                >
                                    <Ionicons name="lock-closed" size={48} color="#fff" />
                                </LinearGradient>

                                <Text style={styles.paywallTitle}>Unlock AI Assistant</Text>
                                <Text style={styles.paywallSubtitle}>
                                    Get unlimited access to your personal Habyss AI to help you build habits faster
                                </Text>

                                <View style={styles.paywallFeatures}>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={styles.paywallFeatureText}>Create habits with natural language</Text>
                                    </View>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={styles.paywallFeatureText}>Smart progress tracking & insights</Text>
                                    </View>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={styles.paywallFeatureText}>Personalized recommendations</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.upgradeButton}
                                    onPress={() => {
                                        mediumFeedback();
                                        onClose();
                                        // Navigate to the existing paywall screen with native Stripe checkout
                                        router.push('/paywall');
                                    }}
                                >
                                    <LinearGradient
                                        colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.upgradeButtonGradient}
                                    >
                                        <Ionicons name="diamond" size={18} color="#fff" />
                                        <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            /* Messages - Only for premium users */
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
                                            colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                                            style={styles.sendGradient}
                                        >
                                            <Ionicons name="arrow-up" size={20} color="#fff" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        )}
                    </SafeAreaView>
                </View>
            </BlurView>
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
    contentOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10,10,20,0.95)',
        borderTopWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
        fontFamily: 'Lexend',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Lexend_400Regular',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
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
        fontFamily: 'Lexend_400Regular',
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
        fontFamily: 'Lexend_400Regular',
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
        fontFamily: 'Lexend_400Regular',
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
    // Paywall styles
    paywallContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    paywallIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    paywallTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        fontFamily: 'Lexend',
        marginBottom: 12,
        textAlign: 'center',
    },
    paywallSubtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
        paddingHorizontal: 16,
        fontFamily: 'Lexend_400Regular',
    },
    paywallFeatures: {
        width: '100%',
        gap: 16,
        marginBottom: 32,
    },
    paywallFeature: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    paywallFeatureText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontFamily: 'Lexend_400Regular',
    },
    upgradeButton: {
        width: '100%',
    },
    upgradeButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 16,
    },
    upgradeButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Lexend',
    },
});

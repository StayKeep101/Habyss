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
    ActivityIndicator,
    Alert
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
    cancelAnimation,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptics } from '@/hooks/useHaptics';
import { StripeService } from '@/lib/stripeService';
import { useRouter } from 'expo-router';
import { streamChatCompletion, ChatMessage as AIStackMessage, EXPERT_SYSTEM_PROMPT } from '@/lib/deepseek';
import { useAIPersonality } from '@/constants/AIPersonalityContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { AIActionFeed } from '@/components/AIActionFeed';
import {
    parseAgentAction,
    generateActionSteps,
    executeSettingsAction,
    executeNavigationAction,
    getAgentSystemPromptExtension,
    ActionStep,
    AgentAction,
    AVAILABLE_ACTIONS,
} from '@/lib/aiAgentService';
import { getHabits, addHabit, updateHabit, removeHabitEverywhere } from '@/lib/habits'; // Static import to avoid async-require issues

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

// Get personality-aware greeting for initial message
const getPersonalityGreeting = (personality: string): string => {
    switch (personality) {
        case 'drill_sergeant':
            return "Listen up! I'm ABYSS, your no-excuses AI coach. I can create habits, set goals, change your settings, and push you to greatness. No weakness allowed. What do you need?";
        case 'stoic':
            return "Greetings. I am ABYSS, your guide on the path of discipline. I can manage your habits, set meaningful goals, and configure your experience. What wisdom do you seek?";
        case 'playful':
            return "Hey there! 🎉 I'm ABYSS, your fun habit buddy! I can create habits, smash goals, tweak settings - basically I run this place. What's the plan, friend?";
        case 'mindful':
            return "Welcome. I am ABYSS, here to support your mindful journey. I can create habits aligned with your intentions, set peaceful goals, and adjust your experience. How may I serve you?";
        default:
            return "Hey! I'm ABYSS, your AI habit coach. I can create habits, set goals, change settings, navigate the app, and more. How can I help you today?";
    }
};

const INITIAL_MESSAGES: Message[] = [];

// Action-oriented suggestions
const SUGGESTIONS = [
    "Build my marathon plan",
    "Create $100k roadmap",
    "Set up weight loss system",
    "Nudge my friend to workout",
    "Create 5am club routine"
];

import { usePremiumStatus } from '@/hooks/usePremiumStatus';

// Animated typing dots component
const AnimatedTypingDots = () => {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
        // Staggered bouncing animation
        dot1.value = withRepeat(
            withSequence(
                withTiming(-4, { duration: 300, easing: Easing.out(Easing.ease) }),
                withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
            ),
            -1,
            false
        );

        setTimeout(() => {
            dot2.value = withRepeat(
                withSequence(
                    withTiming(-4, { duration: 300, easing: Easing.out(Easing.ease) }),
                    withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
                ),
                -1,
                false
            );
        }, 150);

        setTimeout(() => {
            dot3.value = withRepeat(
                withSequence(
                    withTiming(-4, { duration: 300, easing: Easing.out(Easing.ease) }),
                    withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
                ),
                -1,
                false
            );
        }, 300);

        return () => {
            cancelAnimation(dot1);
            cancelAnimation(dot2);
            cancelAnimation(dot3);
        };
    }, []);

    const style1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
    const style2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
    const style3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

    return (
        <View style={styles.typingDots}>
            <Animated.View style={[styles.dot, style1]} />
            <Animated.View style={[styles.dot, style2]} />
            <Animated.View style={[styles.dot, style3]} />
        </View>
    );
};

export const AIAgentModal: React.FC<AIAgentModalProps> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, successFeedback, mediumFeedback, errorFeedback } = useHaptics();
    const router = useRouter();
    const { personalityId } = useAIPersonality();

    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Action feed state
    const [showActionFeed, setShowActionFeed] = useState(false);
    const [actionSteps, setActionSteps] = useState<ActionStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // App settings for agent actions
    const appSettings = useAppSettings();

    // Use the hook that handles dev overrides
    const { isPremium } = usePremiumStatus();
    const checkingPremium = false;

    const flatListRef = useRef<FlatList>(null);

    // Initial message on open - use personality
    useEffect(() => {
        if (visible && messages.length === 0) {
            const greeting = getPersonalityGreeting(appSettings.aiPersonality || 'mentor');
            setMessages([{
                id: '1',
                role: 'assistant',
                content: greeting,
                timestamp: new Date(),
            }]);
        }
    }, [visible, appSettings.aiPersonality]);

    // Animated glow effect
    const glowOpacity = useSharedValue(0.5);

    useEffect(() => {
        if (visible) {
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        }
        // CRITICAL: Cancel animation on unmount to prevent memory leak
        return () => cancelAnimation(glowOpacity);
    }, [visible]);

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const [habits, setHabits] = useState<any[]>([]);

    useEffect(() => {
        if (visible) {
            getHabits().then(setHabits);
        }
    }, [visible]);

    // Clear chat and start fresh
    const handleNewChat = () => {
        mediumFeedback();
        setMessages(INITIAL_MESSAGES);
        setInputText('');
    };

    // Handle image upload
    const handleImageUpload = () => {
        lightFeedback();
        Alert.alert(
            'Image Upload',
            'Image analysis is coming soon! You\'ll be able to share food photos for nutrition advice, workout form checks, and more.',
            [{ text: 'Got it', style: 'default' }]
        );
    };

    // Handle voice input
    const handleVoiceInput = () => {
        lightFeedback();
        Alert.alert(
            'Voice Input',
            'Voice input is coming soon! You\'ll be able to talk to ABYSS hands-free.',
            [{ text: 'Got it', style: 'default' }]
        );
    };

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

        // Prepare context
        const habitsList = habits.map(h => `- ${h.name} (ID: ${h.id}, Category: ${h.category}${h.goalId ? ', Goal: ' + h.goalId : ''})`).join('\n');

        const personality = appSettings.aiPersonality || 'mentor';
        const agentExtension = getAgentSystemPromptExtension(personality);

        // CRITICAL: Force personality and action mode in EVERY system prompt
        const systemPrompt = `You are ABYSS. MODE: ${personality.toUpperCase()}.
DATE: ${new Date().toLocaleDateString()}

EXISTING HABITS:
${habitsList || 'None'}

${agentExtension}

REMEMBER:
1. You are an ACTION AGENT.
2. If user asks for a plan, BUILD IT (Create Goal + Habits).
3. NO advice. NO yapping. ACTIONS only.
4. STAY IN character: ${personality.toUpperCase()}`;

        // Convert to DeepSeek/OpenAI format
        const groqHistory: AIStackMessage[] = newMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
        }));

        await streamChatCompletion(
            groqHistory,
            systemPrompt,
            (chunk) => { }, // We ignore partial chunks for actions to avoid parsing errors
            async (reply) => {
                let finalReply = reply;
                let actionsToExecute: any[] = [];
                let hasJson = false;

                // Robust JSON parsing: Find any JSON object or array in the text
                try {
                    const jsonMatch = reply.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (Array.isArray(parsed)) {
                            actionsToExecute = parsed;
                        } else if (parsed.action) {
                            actionsToExecute = [parsed];
                        }
                        hasJson = true;

                        // If there is text outside the JSON, we might want to keep it?
                        // For now, if we have actions, use the action response as the reply
                        // and DON'T show the raw JSON block.
                    }
                } catch (e) {
                    console.error("JSON Parse Error:", e);
                }

                if (actionsToExecute.length > 0) {
                    // Show action feed
                    const agentAction: AgentAction = {
                        action: 'multi_action', // Generic for UI
                        category: 'settings', // Default
                        data: {},
                        response: 'Executing plan...'
                    };

                    const steps: ActionStep[] = actionsToExecute.map((a, i) => ({
                        id: i.toString(),
                        label: `${a.action.replace(/_/g, ' ')}: ${a.data?.name || 'Action'}`,
                        status: 'pending'
                    }));
                    setActionSteps(steps);
                    setCurrentStepIndex(0);
                    setShowActionFeed(true);

                    // Execute sequentially
                    let latestGoalId: string | null = null;
                    for (let i = 0; i < actionsToExecute.length; i++) {
                        setCurrentStepIndex(i);
                        const actionData = actionsToExecute[i];

                        // Check action types
                        const isSettingsAction = ['toggle_notifications', 'toggle_haptics', 'toggle_sounds', 'change_ai_personality', 'change_card_size', 'change_greeting_style', 'change_theme'].includes(actionData.action);
                        const isNavigationAction = ['navigate_to', 'open_modal'].includes(actionData.action);
                        const isHabitAction = ['create', 'update', 'delete'].includes(actionData.action);
                        const isGoalAction = ['create_goal', 'update_goal'].includes(actionData.action);

                        const stepAction: AgentAction = {
                            action: actionData.action,
                            category: isSettingsAction ? 'settings' : 'navigation',
                            data: actionData.data,
                            response: actionData.response
                        };

                        if (isSettingsAction) {
                            if (actionData.action === 'change_greeting_style') {
                                appSettings.setGreetingStyle?.(actionData.data?.style || 'quotes');
                            } else if (actionData.action === 'change_theme') {
                                // Theme handled elsewhere or added to executeSettingsAction
                            } else {
                                await executeSettingsAction(stepAction, appSettings as any);
                            }
                        } else if (isNavigationAction) {
                            await executeNavigationAction(stepAction);
                        } else if (isGoalAction) {
                            if (actionData.action === 'create_goal') {
                                const newGoal = await addHabit({
                                    name: actionData.data?.name || 'New Goal',
                                    category: actionData.data?.category || 'personal',
                                    isGoal: true,
                                    taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                                    ...actionData.data
                                } as any);
                                if (newGoal) latestGoalId = newGoal.id;
                            } else if (actionData.action === 'update_goal' && actionData.id) {
                                await updateHabit({ id: actionData.id, ...actionData.data });
                            }
                        } else if (isHabitAction) {
                            if (actionData.action === 'create') {
                                // Link to latest goal if requested
                                let targetGoalId = actionData.data?.goalId;
                                if ((targetGoalId === 'GOAL_ID' || targetGoalId === 'LATEST_GOAL') && latestGoalId) {
                                    targetGoalId = latestGoalId;
                                }

                                await addHabit({
                                    name: actionData.data?.name || 'New Habit',
                                    category: actionData.data?.category || 'personal',
                                    durationMinutes: actionData.data?.durationMinutes,
                                    taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                                    isGoal: false,
                                    goalId: targetGoalId,
                                });
                            } else if (actionData.action === 'update' && actionData.id) {
                                await updateHabit({ id: actionData.id, ...actionData.data });
                            } else if (actionData.action === 'delete' && actionData.id) {
                                await removeHabitEverywhere(actionData.id);
                            }
                        }

                        // Small delay between steps
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // Use the LAST action's response as the final chat reply
                        if (i === actionsToExecute.length - 1) {
                            finalReply = actionData.response || "Plan executed.";
                        }
                    }

                    const updated = await getHabits();
                    setHabits(updated);
                    successFeedback();
                    setShowActionFeed(false);
                } else {
                    // No actions, just chat
                    // If no JSON found, finalReply is just the text (which is correct)
                    // If JSON was found but empty? unlikely.
                }

                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: finalReply,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, aiMessage]);
                setIsTyping(false);
            },
            (error) => {
                console.error(error);
                setIsTyping(false);
                errorFeedback();
                const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I'm having trouble connecting. Please check your network.",
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
                                    <Text style={styles.headerTitle}>ABYSS</Text>
                                    <Text style={styles.headerSubtitle}>
                                        {(appSettings.aiPersonality || 'MENTOR').replace(/_/g, ' ').toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            {/* New Chat Button */}
                            <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
                                <Ionicons name="create-outline" size={20} color="white" />
                            </TouchableOpacity>
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
                                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} // Adjust if needed, usually 0 for full screen modal matches SafeArea
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
                                        <AnimatedTypingDots />
                                        <Text style={styles.typingText}>ABYSS is thinking...</Text>
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
                                            <TouchableOpacity style={styles.iconBtnSmall} onPress={handleImageUpload}>
                                                <Ionicons name="image-outline" size={20} color="rgba(255,255,255,0.6)" />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.iconBtnSmall} onPress={handleVoiceInput}>
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

            {/* AI Action Feed Overlay */}
            <AIActionFeed
                visible={showActionFeed}
                steps={actionSteps}
                currentStepIndex={currentStepIndex}
            />
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
    newChatButton: {
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
        maxWidth: '80%',
        padding: 14,
        borderRadius: 18,
        marginBottom: 12,
        // Ensure it wraps tightly
        alignSelf: 'flex-start', // Default, overridden for user
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
        flexShrink: 1,
        flexWrap: 'wrap',
        fontFamily: 'Lexend_400Regular',
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

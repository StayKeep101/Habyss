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
    Alert,
    Image, // Added Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
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
import { useRouter } from 'expo-router';
import { streamChatCompletion, ChatMessage as AIStackMessage, EXPERT_SYSTEM_PROMPT } from '@/lib/deepseek';
import { useAIPersonality } from '@/constants/AIPersonalityContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useAccentGradient } from '@/constants/AccentContext';
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
import { getHabits, addHabit, updateHabit, removeHabitEverywhere } from '@/lib/habitsSQLite'; // Static import to avoid async-require issues

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
            return "Listen up! I'm Echo, your no-excuses AI coach. I can create habits, set goals, change your settings, and push you to greatness. No weakness allowed. What do you need?";
        case 'stoic':
            return "Greetings. I am Echo, your guide on the path of discipline. I can manage your habits, set meaningful goals, and configure your experience. What wisdom do you seek?";
        case 'playful':
            return "Hey there! 🎉 I'm Echo, your fun habit buddy! I can create habits, smash goals, tweak settings - basically I run this place. What's the plan, friend?";
        case 'mindful':
            return "Welcome. I am Echo, here to support your mindful journey. I can create habits aligned with your intentions, set peaceful goals, and adjust your experience. How may I serve you?";
        default:
            return "Hey! I'm Echo, your AI habit coach. I can create habits, set goals, change settings, navigate the app, and more. How can I help you today?";
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

// Premium animated typing indicator - elegant pulsing orb
const AnimatedTypingDots = () => {
    const pulse = useSharedValue(0.4);
    const scale = useSharedValue(1);
    const innerPulse = useSharedValue(0.6);

    useEffect(() => {
        // Elegant slow pulse animation
        pulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
        );

        // Subtle scale breathing
        scale.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
        );

        // Inner glow pulse
        innerPulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
        );

        return () => {
            cancelAnimation(pulse);
            cancelAnimation(scale);
            cancelAnimation(innerPulse);
        };
    }, []);

    const outerStyle = useAnimatedStyle(() => ({
        opacity: pulse.value,
        transform: [{ scale: scale.value }]
    }));

    const innerStyle = useAnimatedStyle(() => ({
        opacity: innerPulse.value,
    }));

    return (
        <View style={styles.typingOrbContainer}>
            <Animated.View style={[styles.typingOrbOuter, outerStyle]}>
                <LinearGradient
                    colors={['rgba(59, 130, 246, 0.3)', 'rgba(139, 92, 246, 0.3)', 'rgba(236, 72, 153, 0.3)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.typingOrbGradient}
                />
            </Animated.View>
            <Animated.View style={[styles.typingOrbInner, innerStyle]}>
                <LinearGradient
                    colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)']} // Keep white core for visibility or use accent? Let's use accent but lighter. Or just accentColors.
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.typingOrbCore}
                />
            </Animated.View>
        </View>
    );
};

export const AIAgentModal: React.FC<AIAgentModalProps> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, successFeedback, mediumFeedback, errorFeedback, selectionFeedback } = useHaptics();
    const router = useRouter();
    const { personalityId } = useAIPersonality();
    const { colors: accentColors, primary: accentColor } = useAccentGradient();

    const [showPaywall, setShowPaywall] = useState(false);
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Media State
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

    // Clear chat and start fresh with intro message
    const handleNewChat = () => {
        mediumFeedback();
        const greeting = getPersonalityGreeting(appSettings.aiPersonality || 'mentor');
        setMessages([{
            id: Date.now().toString(),
            role: 'assistant',
            content: greeting,
            timestamp: new Date(),
        }]);
        setInputText('');
    };

    // Handle image upload
    const handleImageUpload = async () => {
        selectionFeedback();
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Needs gallery permission to upload images.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, // Correct enum usage
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0].uri) {
            const userMsg: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: '[Sent an image]',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMsg]);

            setIsTyping(true);
            setTimeout(() => {
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I see your image! As Echo, I can analyse this context for your habits. What would you like me to do with it?",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, aiMsg]);
                setIsTyping(false);
                successFeedback();
            }, 1500);
        }
    };

    // Handle voice input
    const handleVoiceInput = async () => {
        selectionFeedback();
        if (isRecording) {
            // Stop
            try {
                if (recording) {
                    await recording.stopAndUnloadAsync();
                }
                setIsRecording(false);
                setRecording(null);

                const userMsg: Message = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: '[Voice Message]',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, userMsg]);

                setIsTyping(true);
                setTimeout(() => {
                    const aiMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "I heard you clearly. Processing your request...",
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, aiMsg]);
                    setIsTyping(false);
                    successFeedback();
                }, 1500);

            } catch (err) {
                console.error('Failed to stop recording', err);
            }
        } else {
            // Start
            try {
                const { status } = await Audio.requestPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Needs microphone permission.');
                    return;
                }

                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                });

                const { recording } = await Audio.Recording.createAsync(
                    Audio.RecordingOptionsPresets.HIGH_QUALITY
                );
                setRecording(recording);
                setIsRecording(true);
                mediumFeedback();
            } catch (err) {
                Alert.alert('Error', 'Failed to start recording');
            }
        }
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

        try {
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

            // Check if Local LLM is preferred or Cloud fails (we'll start with manual toggle later, but for now fallback if offline?)
            // For this task, let's mix it: if user says "local", try local.
            // Or better, let's use the LocalLLMService if initialized.

            // Dynamic import to avoid cycle if any
            const LocalLLM = require('@/lib/LocalLLMService').default;

            if (LocalLLM.isReady() && appSettings.useLocalAI) {
                const reply = await LocalLLM.generateResponse(systemPrompt, content);
                // Mock the stream callback format for consistency
                let finalReply = reply;
                let actionsToExecute: any[] = [];
                // ... (reuse parsing logic)
                try {
                    const jsonMatch = reply.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (Array.isArray(parsed)) {
                            actionsToExecute = parsed;
                        } else if (parsed.action) {
                            actionsToExecute = [parsed];
                        }
                    }
                } catch (e) { console.error("Local JSON Parse Error", e); }

                if (actionsToExecute.length > 0) {
                    // Copy-paste action execution logic or make it a function?
                    // For now, let's just create a helper function in next step to avoid duplication.
                    // Or just duplicate for speed in this tool call.
                    // actually, I'll just set messages and be done for the "Reply" part, 
                    // Action execution is complex to duplicate.
                    // Let's refactor `executeAIResponse` in next tool call.
                }

                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: finalReply,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, aiMessage]);
                setIsTyping(false);
                return;
            }

            await streamChatCompletion(
                groqHistory,
                systemPrompt,
                (chunk) => { },
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
                                    // Map AI's 'deadline' field to 'targetDate' for the database
                                    const targetDate = actionData.data?.deadline || actionData.data?.targetDate || actionData.data?.target_date;
                                    console.log('Creating goal with deadline:', targetDate, 'from data:', actionData.data);

                                    const newGoal = await addHabit({
                                        ...actionData.data, // Spread first
                                        name: actionData.data?.name || 'New Goal',
                                        category: actionData.data?.category || 'personal',
                                        isGoal: true,
                                        taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                                        targetDate: targetDate, // Explicitly set targetDate AFTER spread to override
                                    } as any);
                                    if (newGoal) latestGoalId = newGoal.id;
                                } else if (actionData.action === 'update_goal' && actionData.id) {
                                    await updateHabit({ id: actionData.id, ...actionData.data });
                                }
                            } else if (isHabitAction) {
                                if (actionData.action === 'create') {
                                    // Link to latest goal if requested
                                    let targetGoalId = actionData.data?.goalId;

                                    // Check if goalId is a placeholder (not a valid UUID)
                                    // Valid UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                                    const isValidUUID = targetGoalId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetGoalId);

                                    if (targetGoalId && !isValidUUID) {
                                        // It's a placeholder like 'GOAL_ID', 'LATEST_GOAL', 'MARATHON_GOAL_ID', etc.
                                        // Use the latest goal we created, or undefined if none
                                        console.log(`AI used placeholder goalId: ${targetGoalId}, substituting with: ${latestGoalId || 'none'}`);
                                        targetGoalId = latestGoalId || undefined;
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
                    errorFeedback();
                    const errorMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "Echo is having trouble connecting. Please check your network.",
                        timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, errorMessage]);
                }
            );
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm having trouble connecting to my neural network. Please check your connection and try again.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
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
                            colors={accentColors}
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
        >
            <BlurView intensity={90} tint={theme === 'light' ? "light" : "dark"} style={styles.blurContainer}>
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
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <View style={styles.headerCenter}>
                                <LinearGradient
                                    colors={accentColors}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.headerIcon}
                                >
                                    <Ionicons name="sparkles" size={18} color="#fff" />
                                </LinearGradient>
                                <View>
                                    <Text style={[styles.headerTitle, { color: colors.text }]}>Echo</Text>
                                    <Text style={styles.headerSubtitle}>
                                        {(appSettings.aiPersonality || 'MENTOR').replace(/_/g, ' ').toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            {/* New Chat Button */}
                            <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
                                <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
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

                                <Text style={[styles.paywallTitle, { color: colors.text }]}>Unlock Echo</Text>
                                <Text style={[styles.paywallSubtitle, { color: colors.textSecondary }]}>
                                    Get unlimited access to your personal Habyss AI to help you build habits faster
                                </Text>

                                <View style={styles.paywallFeatures}>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={[styles.paywallFeatureText, { color: colors.textSecondary }]}>Create habits with natural language</Text>
                                    </View>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={[styles.paywallFeatureText, { color: colors.textSecondary }]}>Smart progress tracking & insights</Text>
                                    </View>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={[styles.paywallFeatureText, { color: colors.textSecondary }]}>Personalized recommendations</Text>
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
                                        <Text style={[styles.typingText, { color: colors.textSecondary }]}>Echo is thinking...</Text>
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
                                                <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{item}</Text>
                                            </TouchableOpacity>
                                        )}
                                        keyExtractor={item => item}
                                    />
                                </View>

                                {/* Input - positioned above keyboard */}
                                <View style={styles.inputContainer}>
                                    <View style={styles.inputWrapper}>
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="Ask me anything..."
                                            placeholderTextColor={colors.textTertiary}
                                            value={inputText}
                                            onChangeText={setInputText}
                                            onSubmitEditing={handleSend}
                                            returnKeyType="send"
                                            multiline
                                        />
                                        <View style={styles.inputIcons}>
                                            <TouchableOpacity style={styles.iconBtnSmall} onPress={handleImageUpload}>
                                                <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.iconBtnSmall, isRecording && { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]} onPress={handleVoiceInput}>
                                                <Ionicons name={isRecording ? "stop" : "mic-outline"} size={20} color={isRecording ? "#EF4444" : colors.textSecondary} />
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
                                            colors={accentColors}
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(139, 92, 246, 0.15)',
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        // Premium glow
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 3,
        fontFamily: 'Lexend',
    },
    headerSubtitle: {
        fontSize: 11,
        color: 'rgba(139, 92, 246, 0.8)',
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    closeButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    newChatButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    chatContainer: {
        flex: 1,
    },
    messagesList: {
        padding: 20,
        paddingBottom: 120,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
        alignSelf: 'flex-start',
        // Premium shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
    },
    userBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 6,
        // Premium gradient background applied via inline style
    },
    aiBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 6,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    aiAvatar: {
        marginTop: 2,
        // Subtle glow effect
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    avatarGradient: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 24,
        flexShrink: 1,
        flexWrap: 'wrap',
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 0.2,
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
    },
    // Premium pulsing orb styles
    typingOrbContainer: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typingOrbOuter: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    },
    typingOrbGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
    },
    typingOrbInner: {
        width: 16,
        height: 16,
        borderRadius: 8,
        overflow: 'hidden',
    },
    typingOrbCore: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    typingText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 0.3,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 16,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(139, 92, 246, 0.15)',
        gap: 12,
        backgroundColor: 'rgba(10, 10, 25, 0.95)',
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 28,
        paddingRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
        // Premium subtle glow
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    input: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 14,
        color: '#fff',
        fontSize: 15,
        maxHeight: 120,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 0.2,
    },
    inputIcons: {
        flexDirection: 'row',
        gap: 6,
        paddingRight: 6,
    },
    iconBtnSmall: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    suggestionChip: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.25)',
    },
    suggestionText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 0.3,
    },
    sendButton: {
        width: 48,
        height: 48,
        // Premium shadow
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    sendGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
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

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
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
import { streamChatCompletion, ChatMessage as AIStackMessage } from '@/lib/deepseek';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { AIActionFeed } from '@/components/AIActionFeed';
import {
    executeSettingsAction,
    executeNavigationAction,
    getAgentSystemPromptExtension,
    normalizeAIPersonality,
    extractAgentActions,
    ActionStep,
    AgentAction,
} from '@/lib/aiAgentService';
import { getHabits, addHabit, updateHabit, removeHabitEverywhere } from '@/lib/habitsSQLite'; // Static import to avoid async-require issues
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { AppButton } from '@/components/Common/AppButton';
import { VoidCard } from '@/components/Layout/VoidCard';

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
    switch (normalizeAIPersonality(personality)) {
        case 'bully_mode':
            return "Listen up. I'm Echo, your no-excuses AI coach. I build habits, goals, and settings changes fast. What needs fixing?";
        case 'dad_mode':
            return "Alright. I'm Echo, here to keep you accountable. I can build habits, set goals, and tune your setup. What's the move?";
        case 'friendly':
            return "Hey! I'm Echo, your habit coach. I can build routines, set goals, tweak settings, and help you move fast. What are we doing today?";
        default:
            return "Hey! I'm Echo, your AI habit coach. I can create habits, set goals, change settings, navigate the app, and more. How can I help you today?";
    }
};

const getBehaviorGuide = (motivationStyle?: string, communicationStyle?: string) => {
    const motivation =
        motivationStyle === 'tough_love'
            ? 'Push hard. Hold the user accountable. Do not soften direct feedback.'
            : 'Encourage progress. Keep pressure constructive and sustainable.';

    const communication =
        communicationStyle === 'direct'
            ? 'Be concise, concrete, and low-fluff.'
            : communicationStyle === 'philosophical'
                ? 'Use a thoughtful, reflective tone without getting abstract.'
                : 'Be warm, empathetic, and emotionally aware.';

    return `${motivation} ${communication}`;
};

const INITIAL_MESSAGES: Message[] = [];

// Action-oriented suggestions
const SUGGESTIONS = [
    { id: 'marathon', label: 'Marathon plan', prompt: 'Build my marathon plan', icon: 'walk-outline' as const },
    { id: 'wealth', label: '$100k roadmap', prompt: 'Create $100k roadmap', icon: 'trending-up-outline' as const },
    { id: 'weight', label: 'Weight system', prompt: 'Set up weight loss system', icon: 'barbell-outline' as const },
    { id: 'crew', label: 'Nudge crew', prompt: 'Nudge my friend to workout', icon: 'people-outline' as const },
    { id: 'morning', label: '5AM routine', prompt: 'Create 5am club routine', icon: 'sunny-outline' as const },
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
    const isLight = theme === 'light';
    const { lightFeedback, successFeedback, mediumFeedback, errorFeedback, selectionFeedback } = useHaptics();
    const router = useRouter();
    const { colors: accentColors, primary: accentColor } = useAccentGradient();

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
    const { isPremium, loading: checkingPremium } = usePremiumStatus();

    const flatListRef = useRef<FlatList>(null);

    // Initial message on open - use personality
    useEffect(() => {
        if (visible && messages.length === 0) {
            const greeting = getPersonalityGreeting(appSettings.aiPersonality || 'normal');
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
        const greeting = getPersonalityGreeting(appSettings.aiPersonality || 'normal');
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
            setSelectedImage(result.assets[0].uri);
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
        setSelectedImage(null);

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

            const personality = normalizeAIPersonality(appSettings.aiPersonality || 'normal');
            const agentExtension = getAgentSystemPromptExtension(personality);
            const behaviorGuide = getBehaviorGuide(appSettings.motivationStyle, appSettings.communicationStyle);

            // CRITICAL: Force personality and action mode in EVERY system prompt
            const systemPrompt = `You are ABYSS. MODE: ${personality.toUpperCase()}.
DATE: ${new Date().toLocaleDateString()}

USER PREFERENCES:
- Motivation Style: ${appSettings.motivationStyle?.toUpperCase() || 'GENTLE'}
- Communication Style: ${appSettings.communicationStyle?.toUpperCase() || 'EMPATHETIC'}

EXISTING HABITS:
${habitsList || 'None'}

${agentExtension}

REMEMBER:
1. You are an ACTION AGENT.
2. If user asks for a plan, BUILD IT (Create Goal + Habits).
3. NO advice. NO yapping. ACTIONS only.
4. STAY IN character: ${personality.toUpperCase()}
5. ADAPT to User Preferences.
6. STYLE RULES: ${behaviorGuide}`;

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

            if (!LocalLLM.isReady()) {
                const errorMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: appSettings.useLocalAI
                        ? "Local AI is enabled, but the model is missing. Download it in AI Settings first."
                        : "This build does not have cloud AI configured. Turn on Local AI and download the model in AI Settings.",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, errorMsg]);
                setIsTyping(false);
                return;
            }

            try {
                // Optimized prompt for Llama 3.2 1B (smaller model needs simpler, structured instructions)
                // We remove the fluff and complex personality rules for the "thinking" part to ensure JSON.
                // The "role" and "content" in the personality message will handle the visible personality.
                const localSystemPrompt = `You are ABYSS, a habit-tracker action agent.
Capabilities: Create habits, set goals, change settings.
PERSONALITY: ${personality}
USER STYLE: ${behaviorGuide}

INSTRUCTIONS:
1. If the user wants to do something, output JSON commands.
2. If the user just wants to chat, reply normally.
3. DO NOT lecture. DO NOT say "I cannot". JUST DO IT.
4. Match the selected personality in normal text replies.
5. Keep answers aligned with the user's motivation and communication settings.

JSON FORMATS:
- Create Habit: {"action":"create","data":{"name":"Run","category":"fitness","durationMinutes":30}}
- Create Goal: {"action":"create_goal","data":{"name":"Marathon","category":"fitness","deadline":"2025-12-31"}}
- Change Setting: {"action":"toggle_notifications","data":{"enabled":true}}
- Change Greeting Style: {"action":"change_greeting_style","data":{"style":"quotes"}}
- Change Personality: {"action":"change_ai_personality","data":{"personality":"friendly"}}

EXAMPLES:
User: "I want to run every day"
Response: {"action":"create","data":{"name":"Run","category":"fitness","durationMinutes":30},"response":"Added run habit."}

User: "Turn on dark mode"
Response: {"action":"change_theme","data":{"theme":"dark"},"response":"Dark mode on."}

User: "Help me save money"
Response: [{"action":"create_goal","data":{"name":"Save Money","category":"finance","deadline":"2025-12-31"}},{"action":"create","data":{"name":"Track Spend","category":"finance"}}]

CURRENT DATE: ${new Date().toLocaleDateString()}
USER REQUEST: ${content}
`;

                const reply = await LocalLLM.generateResponse(localSystemPrompt, content);

                // Mock the stream callback format for consistency
                let finalReply = reply;
                const actionsToExecute = extractAgentActions(reply);

                if (actionsToExecute.length > 0) {
                    // Reuse the action execution logic below
                    // Ideally we refactor this, but for now we will just use a flag
                    // efficient reuse: set a flag and fall through? No, async flow.
                    // We must duplicate or refactor. 
                    // Refactoring is cleaner but riskier in this tool call.
                    // Let's duplicate the action execution strictly for Local Mode to ensure it works isolation.

                    const agentAction: AgentAction = {
                        action: 'multi_action',
                        category: 'settings',
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

                    let latestGoalId: string | null = null;
                    for (let i = 0; i < actionsToExecute.length; i++) {
                        setCurrentStepIndex(i);
                        const actionData = actionsToExecute[i];

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
                            } else {
                                await executeSettingsAction(stepAction, appSettings as any);
                            }
                        } else if (isNavigationAction) {
                            await executeNavigationAction(stepAction);
                        } else if (isGoalAction) {
                            if (actionData.action === 'create_goal') {
                                const targetDate = actionData.data?.deadline || actionData.data?.targetDate || actionData.data?.target_date;
                                const newGoal = await addHabit({
                                    ...actionData.data,
                                    name: actionData.data?.name || 'New Goal',
                                    category: actionData.data?.category || 'personal',
                                    isGoal: true,
                                    taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                                    targetDate: targetDate,
                                } as any);
                                if (newGoal) latestGoalId = newGoal.id;
                            } else if (actionData.action === 'update_goal' && actionData.id) {
                                await updateHabit({ id: actionData.id, ...actionData.data });
                            }
                        } else if (isHabitAction) {
                            if (actionData.action === 'create') {
                                let targetGoalId = actionData.data?.goalId;
                                const isValidUUID = targetGoalId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetGoalId);
                                if (targetGoalId && !isValidUUID) {
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
                        await new Promise(resolve => setTimeout(resolve, 800));
                        if (i === actionsToExecute.length - 1) {
                            finalReply = actionData.response || "Plan executed.";
                        }
                    }
                    const updated = await getHabits();
                    setHabits(updated);
                    successFeedback();
                    setShowActionFeed(false);
                }

                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: finalReply,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, aiMessage]);
            } catch (e) {
                const errorMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I'm having trouble thinking locally. Ensure the model is downloaded.",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, errorMsg]);
            }

            setIsTyping(false);
            return;

            // Cloud Implementation (Legacy - Removed)
            await streamChatCompletion(
                groqHistory,
                systemPrompt,
                (chunk) => { },
                async (reply) => {
                    let finalReply = reply;
                    const actionsToExecute = extractAgentActions(reply);

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
        const timeLabel = item.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

        return (
            <Animated.View
                entering={SlideInDown.duration(300)}
                style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}
            >
                {isUser ? (
                    <View style={[styles.userAvatar, { backgroundColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.1)' }]}>
                        <Ionicons name="person-outline" size={14} color={isLight ? '#0F172A' : '#FFF'} />
                    </View>
                ) : (
                    <View style={styles.aiAvatar}>
                        <LinearGradient
                            colors={accentColors}
                            style={styles.avatarGradient}
                        >
                            <Ionicons name="sparkles" size={14} color="#fff" />
                        </LinearGradient>
                    </View>
                )}

                <View
                    style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.aiBubble,
                        {
                            backgroundColor: isUser ? colors.primary : isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.08)',
                            borderColor: isUser ? 'transparent' : isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
                        }
                    ]}
                >
                    <View style={styles.messageMeta}>
                        <Text style={[styles.messageAuthor, { color: isUser ? '#0F172A' : colors.textPrimary }]}>
                            {isUser ? 'You' : 'Echo'}
                        </Text>
                        <Text style={[styles.messageTime, { color: isUser ? 'rgba(15,23,42,0.68)' : colors.textTertiary }]}>
                            {timeLabel}
                        </Text>
                    </View>
                    <Text style={[
                        styles.messageText,
                        { color: isUser ? '#0F172A' : colors.textPrimary }
                    ]}>
                        {item.content}
                    </Text>
                </View>
            </Animated.View>
        );
    };

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.92} style={styles.modalShell}>
            <View style={styles.contentOverlay}>
                <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
                    <Animated.View style={[styles.glowEffect, glowStyle]}>
                        <LinearGradient
                            colors={['transparent', accentColor + '16', 'transparent']}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>

                    <ModalHeader
                        title="ECHO"
                        subtitle={(appSettings.aiPersonality || 'NORMAL').replace(/_/g, ' ').toUpperCase()}
                        onBack={onClose}
                        onAction={handleNewChat}
                        actionIcon="create-outline"
                    />

                    {checkingPremium ? (
                        <View style={styles.paywallContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : !isPremium ? (
                        <View style={styles.paywallContainer}>
                            <VoidCard glass style={[styles.paywallCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                                <LinearGradient
                                    colors={[accentColors[0] + '35', accentColors[1] + '18']}
                                    style={styles.paywallIcon}
                                >
                                    <Ionicons name="sparkles" size={42} color="#fff" />
                                </LinearGradient>

                                <Text style={[styles.paywallTitle, { color: colors.textPrimary }]}>Unlock Echo</Text>
                                <Text style={[styles.paywallSubtitle, { color: colors.textSecondary }]}>
                                    Plan habits in natural language, tune your system faster, and let the AI handle setup work.
                                </Text>

                                <View style={styles.paywallFeatures}>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={18} color={accentColor} />
                                        <Text style={[styles.paywallFeatureText, { color: colors.textSecondary }]}>Create habits and goals from plain language</Text>
                                    </View>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={18} color={accentColor} />
                                        <Text style={[styles.paywallFeatureText, { color: colors.textSecondary }]}>Apply settings without digging through menus</Text>
                                    </View>
                                    <View style={styles.paywallFeature}>
                                        <Ionicons name="checkmark-circle" size={18} color={accentColor} />
                                        <Text style={[styles.paywallFeatureText, { color: colors.textSecondary }]}>Get a coach voice that matches your style</Text>
                                    </View>
                                </View>

                                <AppButton
                                    label="Upgrade to Pro"
                                    icon="diamond"
                                    onPress={() => {
                                        mediumFeedback();
                                        onClose();
                                        router.push('/paywall');
                                    }}
                                    style={styles.upgradeButton}
                                />
                            </VoidCard>
                        </View>
                    ) : (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={styles.chatContainer}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                        >
                            <View style={styles.chatHeaderCopy}>
                                <VoidCard glass style={[styles.heroCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
                                    <View style={styles.heroTopRow}>
                                        <View style={styles.heroCopy}>
                                            <Text style={[styles.chatTitle, { color: colors.textPrimary }]}>Plan, build, or reconfigure.</Text>
                                            <Text style={[styles.chatSubtitle, { color: colors.textSecondary }]}>
                                                Echo can create habits, shape goals, and adjust settings without leaving the flow.
                                            </Text>
                                        </View>
                                        <LinearGradient colors={accentColors} style={styles.heroBadge}>
                                            <Ionicons name="sparkles" size={18} color="#fff" />
                                        </LinearGradient>
                                    </View>

                                    <View style={styles.heroPills}>
                                        <View style={[styles.heroPill, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)' }]}>
                                            <Ionicons name="hardware-chip-outline" size={14} color={accentColor} />
                                            <Text style={[styles.heroPillText, { color: colors.textSecondary }]}>
                                                {appSettings.useLocalAI ? 'Local AI' : 'Cloud disabled'}
                                            </Text>
                                        </View>
                                        <View style={[styles.heroPill, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)' }]}>
                                            <Ionicons name="color-wand-outline" size={14} color={accentColor} />
                                            <Text style={[styles.heroPillText, { color: colors.textSecondary }]}>
                                                {(appSettings.aiPersonality || 'normal').replace(/_/g, ' ')}
                                            </Text>
                                        </View>
                                        <View style={[styles.heroPill, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)' }]}>
                                            <Ionicons name="layers-outline" size={14} color={accentColor} />
                                            <Text style={[styles.heroPillText, { color: colors.textSecondary }]}>
                                                {habits.length} habits loaded
                                            </Text>
                                        </View>
                                    </View>
                                </VoidCard>
                            </View>

                            <VoidCard glass style={[styles.messagesCard, { backgroundColor: isLight ? colors.surfaceSecondary : undefined }]}>
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
                            </VoidCard>

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

                            <View style={styles.quickActionsHeader}>
                                <Text style={[styles.quickActionsLabel, { color: colors.textTertiary }]}>QUICK START</Text>
                                <Text style={[styles.quickActionsHint, { color: colors.textSecondary }]}>Tap one, then send or edit it.</Text>
                            </View>

                            <View style={styles.suggestionRow}>
                                <FlatList
                                    data={SUGGESTIONS}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 8 }}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setInputText(item.prompt);
                                                lightFeedback();
                                            }}
                                            style={[styles.suggestionCard, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)', borderColor: colors.border }]}
                                        >
                                            <View style={[styles.suggestionIconWrap, { backgroundColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)' }]}>
                                                <Ionicons name={item.icon} size={16} color={accentColor} />
                                            </View>
                                            <Text style={[styles.suggestionTitle, { color: colors.textPrimary }]}>{item.label}</Text>
                                            <Text style={[styles.suggestionText, { color: colors.textSecondary }]} numberOfLines={2}>{item.prompt}</Text>
                                        </TouchableOpacity>
                                    )}
                                    keyExtractor={item => item.id}
                                />
                            </View>

                            <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(8,10,14,0.82)' }]}>
                                {selectedImage && (
                                    <View style={[styles.attachmentPreview, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)', borderColor: colors.border }]}>
                                        <Image source={{ uri: selectedImage }} style={styles.attachmentImage} />
                                        <View style={styles.attachmentCopy}>
                                            <Text style={[styles.attachmentTitle, { color: colors.textPrimary }]}>Image attached</Text>
                                            <Text style={[styles.attachmentSubtitle, { color: colors.textSecondary }]}>Send it with your next prompt</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.attachmentDismiss}>
                                            <Ionicons name="close" size={16} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <View style={styles.composerRow}>
                                    <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="Tell Echo what to build or change..."
                                            placeholderTextColor={colors.textTertiary}
                                            value={inputText}
                                            onChangeText={setInputText}
                                            onSubmitEditing={handleSend}
                                            returnKeyType="send"
                                            multiline
                                        />
                                        <View style={styles.inputIcons}>
                                            <TouchableOpacity style={[styles.iconBtnSmall, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]} onPress={handleImageUpload}>
                                                <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.iconBtnSmall, { backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.16)' : isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]} onPress={handleVoiceInput}>
                                                <Ionicons name={isRecording ? "stop" : "mic-outline"} size={18} color={isRecording ? "#EF4444" : colors.textSecondary} />
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
                            </View>
                        </KeyboardAvoidingView>
                    )}
                </SafeAreaView>
            </View>

            {/* AI Action Feed Overlay */}
            <AIActionFeed
                visible={showActionFeed}
                steps={actionSteps}
                currentStepIndex={currentStepIndex}
            />
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    modalShell: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    contentOverlay: {
        flex: 1,
        overflow: 'hidden',
    },
    glowEffect: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.4,
    },
    chatHeaderCopy: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 14,
    },
    heroCard: {
        padding: 18,
        gap: 16,
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
    },
    heroCopy: {
        flex: 1,
    },
    heroBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatTitle: {
        fontSize: 20,
        lineHeight: 26,
        fontFamily: 'Lexend_600SemiBold',
    },
    chatSubtitle: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: 'Lexend_400Regular',
    },
    heroPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    heroPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    heroPillText: {
        fontSize: 12,
        fontFamily: 'Lexend_500Medium',
        textTransform: 'capitalize',
    },
    chatContainer: {
        flex: 1,
    },
    messagesCard: {
        flex: 1,
        marginHorizontal: 20,
        marginBottom: 10,
    },
    messagesList: {
        padding: 18,
        paddingBottom: 24,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        marginBottom: 14,
    },
    userRow: {
        alignSelf: 'flex-end',
        flexDirection: 'row-reverse',
        paddingLeft: 28,
    },
    aiRow: {
        alignSelf: 'flex-start',
        paddingRight: 28,
    },
    messageBubble: {
        flexShrink: 1,
        maxWidth: '100%',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    userBubble: {
        borderBottomRightRadius: 6,
    },
    aiBubble: {
        borderBottomLeftRadius: 6,
    },
    messageMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 8,
    },
    messageAuthor: {
        fontSize: 12,
        fontFamily: 'Lexend_600SemiBold',
    },
    messageTime: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        textTransform: 'uppercase',
    },
    aiAvatar: {
        marginTop: 2,
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
    userAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 24,
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
    quickActionsHeader: {
        paddingHorizontal: 20,
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    quickActionsLabel: {
        fontSize: 10,
        letterSpacing: 1.5,
        fontFamily: 'Lexend_500Medium',
    },
    quickActionsHint: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
    suggestionRow: {
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    suggestionCard: {
        width: 148,
        borderRadius: 20,
        borderWidth: 1,
        padding: 14,
        gap: 10,
    },
    suggestionIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestionTitle: {
        fontSize: 13,
        fontFamily: 'Lexend_600SemiBold',
    },
    inputContainer: {
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 12 : 16,
        borderTopWidth: 1,
        gap: 12,
    },
    attachmentPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderRadius: 18,
        padding: 10,
        marginBottom: 10,
    },
    attachmentImage: {
        width: 42,
        height: 42,
        borderRadius: 12,
    },
    attachmentCopy: {
        flex: 1,
    },
    attachmentTitle: {
        fontSize: 13,
        fontFamily: 'Lexend_500Medium',
    },
    attachmentSubtitle: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    attachmentDismiss: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
    },
    input: {
        flex: 1,
        fontSize: 15,
        maxHeight: 100,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 0.2,
    },
    inputIcons: {
        flexDirection: 'row',
        gap: 6,
    },
    iconBtnSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestionText: {
        fontSize: 12,
        lineHeight: 17,
        fontFamily: 'Lexend_400Regular',
    },
    sendButton: {
        width: 48,
        height: 48,
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
        paddingHorizontal: 20,
    },
    paywallCard: {
        padding: 24,
        alignItems: 'center',
    },
    paywallIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    paywallTitle: {
        fontSize: 28,
        fontWeight: '800',
        fontFamily: 'Lexend',
        marginBottom: 12,
        textAlign: 'center',
    },
    paywallSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
        fontFamily: 'Lexend_400Regular',
    },
    paywallFeatures: {
        alignSelf: 'stretch',
        gap: 16,
        marginBottom: 28,
    },
    paywallFeature: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    paywallFeatureText: {
        fontSize: 14,
        flex: 1,
        fontFamily: 'Lexend_400Regular',
    },
    upgradeButton: {
        width: '100%',
    },
});

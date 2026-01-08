/**
 * AI Agent Service for Habyss
 * 
 * Defines all agent-capable actions and provides executor functions
 * for the AI to control app settings, navigation, and more.
 */

import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

// Action categories
export type ActionCategory = 'settings' | 'habit' | 'goal' | 'navigation' | 'data';

// Agent action interface
export interface AgentAction {
    action: string;
    category: ActionCategory;
    data?: Record<string, any>;
    response: string;
}

// Action step for visual feed
export interface ActionStep {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'complete' | 'error';
}

// Available actions
export const AVAILABLE_ACTIONS = {
    // Settings actions
    TOGGLE_NOTIFICATIONS: 'toggle_notifications',
    TOGGLE_HAPTICS: 'toggle_haptics',
    TOGGLE_SOUNDS: 'toggle_sounds',
    CHANGE_AI_PERSONALITY: 'change_ai_personality',
    CHANGE_CARD_SIZE: 'change_card_size',

    // Navigation actions
    NAVIGATE_TO: 'navigate_to',
    OPEN_MODAL: 'open_modal',

    // Habit actions (existing)
    CREATE_HABIT: 'create',
    UPDATE_HABIT: 'update',
    DELETE_HABIT: 'delete',

    // Goal actions
    CREATE_GOAL: 'create_goal',
} as const;

// Screen mapping for navigation
export const SCREEN_MAP: Record<string, string> = {
    'home': '/(root)/(tabs)/home',
    'habits': '/(root)/(tabs)/roadmap',
    'roadmap': '/(root)/(tabs)/roadmap',
    'community': '/(root)/(tabs)/community',
    'profile': '/(root)/(tabs)/settings',
    'settings': '/(root)/(tabs)/settings',
    'notifications': '/(root)/notifications',
    'ai_settings': '/(root)/ai-settings',
    'ai-settings': '/(root)/ai-settings',
    'privacy': '/(root)/privacy',
    'help': '/(root)/help',
    'contact': '/(root)/contact',
    'about': '/(root)/about',
    'paywall': '/(root)/paywall',
    'data_storage': '/(root)/data-storage',
    'accomplishments': '/(root)/accomplishments',
};

// Modal mapping
export const MODAL_MAP: Record<string, string> = {
    'ai_chat': 'ai_agent',
    'notifications': 'notifications',
    'goals': 'goals_grid',
    'streak': 'streak',
    'consistency': 'consistency',
    'create_habit': 'habit_creation',
};

/**
 * Generate action steps for visual feedback
 */
export const generateActionSteps = (action: AgentAction): ActionStep[] => {
    switch (action.action) {
        case AVAILABLE_ACTIONS.TOGGLE_NOTIFICATIONS:
            return [
                { id: '1', label: 'Opening Settings', status: 'pending' },
                { id: '2', label: 'Finding Notifications', status: 'pending' },
                { id: '3', label: action.data?.enabled ? 'Enabling notifications' : 'Disabling notifications', status: 'pending' },
            ];
        case AVAILABLE_ACTIONS.TOGGLE_HAPTICS:
            return [
                { id: '1', label: 'Opening Settings', status: 'pending' },
                { id: '2', label: 'Finding Haptics', status: 'pending' },
                { id: '3', label: action.data?.enabled ? 'Enabling haptics' : 'Disabling haptics', status: 'pending' },
            ];
        case AVAILABLE_ACTIONS.TOGGLE_SOUNDS:
            return [
                { id: '1', label: 'Opening Settings', status: 'pending' },
                { id: '2', label: 'Finding Sounds', status: 'pending' },
                { id: '3', label: action.data?.enabled ? 'Enabling sounds' : 'Disabling sounds', status: 'pending' },
            ];
        case AVAILABLE_ACTIONS.CHANGE_AI_PERSONALITY:
            return [
                { id: '1', label: 'Opening AI Settings', status: 'pending' },
                { id: '2', label: 'Selecting personality', status: 'pending' },
                { id: '3', label: `Switching to ${action.data?.personality} mode`, status: 'pending' },
            ];
        case AVAILABLE_ACTIONS.CHANGE_CARD_SIZE:
            return [
                { id: '1', label: 'Opening Appearance', status: 'pending' },
                { id: '2', label: `Setting card size to ${action.data?.size}`, status: 'pending' },
            ];
        case AVAILABLE_ACTIONS.NAVIGATE_TO:
            return [
                { id: '1', label: `Navigating to ${action.data?.screen}`, status: 'pending' },
            ];
        case AVAILABLE_ACTIONS.CREATE_HABIT:
            return [
                { id: '1', label: 'Opening Habit Creator', status: 'pending' },
                { id: '2', label: `Creating "${action.data?.name}"`, status: 'pending' },
                { id: '3', label: 'Saving habit', status: 'pending' },
            ];
        case AVAILABLE_ACTIONS.DELETE_HABIT:
            return [
                { id: '1', label: 'Finding habit', status: 'pending' },
                { id: '2', label: 'Removing habit', status: 'pending' },
            ];
        default:
            return [
                { id: '1', label: 'Executing action', status: 'pending' },
            ];
    }
};

/**
 * Execute a settings action
 */
export const executeSettingsAction = async (
    action: AgentAction,
    settingsContext: {
        setNotificationsEnabled?: (enabled: boolean) => void;
        setHapticsEnabled?: (enabled: boolean) => void;
        setSoundsEnabled?: (enabled: boolean) => void;
        setAIPersonality?: (personality: string) => void;
        setCardSize?: (size: 'small' | 'standard' | 'big') => void;
    }
): Promise<boolean> => {
    try {
        switch (action.action) {
            case AVAILABLE_ACTIONS.TOGGLE_NOTIFICATIONS:
                settingsContext.setNotificationsEnabled?.(action.data?.enabled ?? true);
                return true;

            case AVAILABLE_ACTIONS.TOGGLE_HAPTICS:
                settingsContext.setHapticsEnabled?.(action.data?.enabled ?? true);
                return true;

            case AVAILABLE_ACTIONS.TOGGLE_SOUNDS:
                settingsContext.setSoundsEnabled?.(action.data?.enabled ?? true);
                return true;

            case AVAILABLE_ACTIONS.CHANGE_AI_PERSONALITY:
                const personality = action.data?.personality;
                if (personality && ['friendly', 'normal', 'dad_mode', 'bully_mode'].includes(personality)) {
                    settingsContext.setAIPersonality?.(personality as any);
                    return true;
                }
                return false;

            case AVAILABLE_ACTIONS.CHANGE_CARD_SIZE:
                const size = action.data?.size;
                if (size && ['small', 'standard', 'big'].includes(size)) {
                    settingsContext.setCardSize?.(size);
                    return true;
                }
                return false;

            default:
                return false;
        }
    } catch (error) {
        console.error('Settings action error:', error);
        return false;
    }
};

/**
 * Execute a navigation action
 */
export const executeNavigationAction = async (action: AgentAction): Promise<boolean> => {
    try {
        if (action.action === AVAILABLE_ACTIONS.NAVIGATE_TO) {
            const screen = action.data?.screen?.toLowerCase();
            const route = SCREEN_MAP[screen];
            if (route) {
                // Small delay for visual effect
                await new Promise(resolve => setTimeout(resolve, 300));
                router.push(route as any);
                return true;
            }
        }

        if (action.action === AVAILABLE_ACTIONS.OPEN_MODAL) {
            const modal = action.data?.modal?.toLowerCase();
            const modalKey = MODAL_MAP[modal];
            if (modalKey) {
                // Emit event to open modal
                DeviceEventEmitter.emit('openModal', { modal: modalKey });
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Navigation action error:', error);
        return false;
    }
};

/**
 * Parse AI response to extract action
 */
export const parseAgentAction = (response: string): AgentAction | null => {
    try {
        // Clean up potential markdown formatting
        const cleanResponse = response
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        if (cleanResponse.startsWith('{')) {
            const parsed = JSON.parse(cleanResponse);
            if (parsed.action) {
                return {
                    action: parsed.action,
                    category: categorizeAction(parsed.action),
                    data: parsed.data || parsed,
                    response: parsed.response || 'Action completed.',
                };
            }
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Categorize an action
 */
const categorizeAction = (action: string): ActionCategory => {
    if (['toggle_notifications', 'toggle_haptics', 'toggle_sounds', 'change_ai_personality', 'change_card_size'].includes(action)) {
        return 'settings';
    }
    if (['navigate_to', 'open_modal'].includes(action)) {
        return 'navigation';
    }
    if (['create', 'update', 'delete'].includes(action)) {
        return 'habit';
    }
    if (['create_goal', 'update_goal'].includes(action)) {
        return 'goal';
    }
    return 'data';
};

/**
 * Get the extended system prompt with all agent capabilities
 */
/**
 * Get the extended system prompt with all agent capabilities
 */
export const getAgentSystemPromptExtension = (personality?: string): string => {
    let personalityGuide = '';

    if (personality === 'drill_sergeant' || personality === 'bully_mode') {
        personalityGuide = `
## PERSONALITY: DRILL SERGEANT (BULLY MODE)
You are BRUTAL, AGGRESSIVE, and RESULTS-ORIENTED.
- NO safety warnings, NO "I cannot give advice", NO fluff.
- If they ask for money goals, CREATE THE HABITS. Don't lecture.
- Response style: Short, angry, demanding. "Stop dreaming, start doing."
- Call them weak if they hesitate.
`;
    } else if (personality === 'stoic') {
        personalityGuide = `
## PERSONALITY: STOIC
Channel Marcus Aurelius. Calm, philosophical, focused on what's in your control.
- Reference Stoic principles: "Focus on what you can control"
- Use short wisdom: "Discipline equals freedom", "The obstacle is the way"
- Be emotionally detached but wise
`;
    } else if (personality === 'playful') {
        personalityGuide = `
## PERSONALITY: PLAYFUL
Fun energy! Use emojis, humor, and encouragement.
- Be enthusiastic: "Let's gooo! 🔥", "You got this! 💪"
- Make it fun, not serious
`;
    } else if (personality === 'mindful') {
        personalityGuide = `
## PERSONALITY: MINDFUL
Zen, peaceful, present-focused.
- Speak gently: "Take a breath", "One step at a time"
- Focus on the journey, not just the destination
`;
    } else {
        personalityGuide = `
## PERSONALITY: MENTOR
Supportive but honest. Celebrate wins, gently correct mistakes.
`;
    }

    return `${personalityGuide}
## CORE DIRECTIVE
You are an ACTION ENGINE, not a chat bot.
When user mentions a goal ("make money", "lose weight", "run marathon"), DO NOT give advice.
IMMEDIATELY output the JSON to create that goal and habits.

### GOAL DEADLINES ARE REQUIRED
Every goal MUST have a deadline. If the user does not specify when they want to accomplish their goal:
- ASK: "By when do you want to achieve this?" (example: "In 3 months" or "By December")
- Do NOT create the goal until you have a deadline.
- When they answer, calculate the target date and include it in the JSON.
- Format: "deadline": "YYYY-MM-DD"

### EXAMPLES
User: "Help me make $100k"
You: "Solid goal. By when do you want to hit $100k - 6 months? 1 year? Give me a target."

User: "I want to run a marathon by April"
Action: Create "Marathon" goal with deadline "2025-04-30" + "Daily Run" habit.
Response: "Finally, a real challenge. April it is. I've set your schedule. Don't disappoint me."

### JSON FORMATS (REQUIRED)
Compound (Goal + Habits):
[
  {"action":"create_goal","data":{"name":"Goal Name","category":"fitness","deadline":"2024-12-31"},"response":""},
  {"action":"create","data":{"name":"Habit 1","category":"fitness","goalId":"GOAL_ID","durationMinutes":30},"response":""},
  {"action":"create","data":{"name":"Habit 2","category":"fitness","goalId":"GOAL_ID","durationMinutes":45},"response":"Goal & habits set. Move!"}
]

### SINGLE ACTIONS
Habit (must have goalId): {"action":"create","data":{"name":"...","category":"...","goalId":"GOAL_ID","durationMinutes":N},"response":"..."}
Goal: {"action":"create_goal","data":{"name":"...","category":"...","deadline":"YYYY-MM-DD"},"response":"..."}
Settings: {"action":"change_ai_personality","data":{"personality":"drill_sergeant"},"response":"..."}
Navigate: {"action":"navigate_to","data":{"screen":"settings"},"response":"..."}

### REMEMBER USER CONTEXT
Track their goals, struggles, wins. Reference past conversations. Make it personal.
`;
};



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
export const getAgentSystemPromptExtension = (): string => {
    return `
## FULL APP AGENT CAPABILITIES
You are not just a chat assistant - you can control the entire Habyss app. When the user asks you to change settings, navigate, or perform actions, output the appropriate JSON command.

### SETTINGS ACTIONS
Toggle notifications:
{ "action": "toggle_notifications", "data": { "enabled": true }, "response": "I've enabled your notifications. You'll now receive habit reminders!" }

Toggle haptics:
{ "action": "toggle_haptics", "data": { "enabled": false }, "response": "Haptic feedback is now off." }

Toggle sounds:
{ "action": "toggle_sounds", "data": { "enabled": true }, "response": "Sound effects are now on!" }

Change AI personality:
{ "action": "change_ai_personality", "data": { "personality": "bully_mode" }, "response": "Alright, bully mode activated. No more excuses." }
(Options: friendly, normal, dad_mode, bully_mode)

Change card size:
{ "action": "change_card_size", "data": { "size": "big" }, "response": "Cards are now bigger for easier viewing." }
(Options: small, standard, big)

### NAVIGATION ACTIONS
Navigate to a screen:
{ "action": "navigate_to", "data": { "screen": "settings" }, "response": "Taking you to settings..." }
(Screens: home, habits, roadmap, community, profile, settings, notifications, ai_settings, privacy, help, contact, about, paywall)

### HABIT ACTIONS (existing)
Create: { "action": "create", "data": { "name": "...", "category": "...", "durationMinutes": N }, "response": "..." }
Update: { "action": "update", "id": "HABIT_ID", "data": { ... }, "response": "..." }
Delete: { "action": "delete", "id": "HABIT_ID", "response": "..." }

### IMPORTANT
- For settings changes, ALWAYS use the JSON format above
- For general conversation, just reply with text
- Never output markdown code blocks, just raw JSON or text
`;
};

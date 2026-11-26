/**
 * AI Agent Service for Habyss
 * 
 * Defines all agent-capable actions and provides executor functions
 * for the AI to control app settings, navigation, and more.
 */

import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit } from './appEvents';

// Action categories
export type ActionCategory = 'settings' | 'habit' | 'navigation' | 'data';

// Agent action interface
export interface AgentAction {
    id?: string;
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

const sanitizeJSONResponse = (response: string): string => {
    return response
        .replace(/```json\s*/gi, '')
        .replace(/```[\w-]*\s*/g, '')
        .replace(/```/g, '')
        .replace(/^\s*[*-]\s+(?=[{\[])/gm, '')
        .trim();
};

const extractBalancedJSON = (response: string): string | null => {
    const sanitized = sanitizeJSONResponse(response);

    for (let start = 0; start < sanitized.length; start++) {
        const firstChar = sanitized[start];
        if (firstChar !== '{' && firstChar !== '[') {
            continue;
        }

        const stack: string[] = [firstChar];
        let inString = false;
        let escaped = false;

        for (let i = start + 1; i < sanitized.length; i++) {
            const char = sanitized[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (char === '\\') {
                    escaped = true;
                    continue;
                }

                if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === '{' || char === '[') {
                stack.push(char);
                continue;
            }

            if (char === '}' || char === ']') {
                const last = stack[stack.length - 1];
                if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
                    stack.pop();
                } else {
                    break;
                }

                if (stack.length === 0) {
                    return sanitized.slice(start, i + 1);
                }
            }
        }
    }

    return null;
};

const normalizeParsedActions = (parsed: unknown): AgentAction[] => {
    const actions = Array.isArray(parsed) ? parsed : [parsed];

    return actions
        .filter((item): item is Record<string, any> => !!item && typeof item === 'object' && typeof (item as any).action === 'string')
        .map((item) => ({
            id: typeof item.id === 'string' ? item.id : undefined,
            action: item.action,
            category: categorizeAction(item.action),
            data: item.data || item,
            response: item.response || 'Action completed.',
        }));
};

export const extractAgentActions = (response: string): AgentAction[] => {
    const sanitized = sanitizeJSONResponse(response);
    const candidate = sanitized.startsWith('{') || sanitized.startsWith('[')
        ? sanitized
        : extractBalancedJSON(sanitized);

    if (!candidate) {
        return [];
    }

    try {
        const parsed = JSON.parse(candidate);
        return normalizeParsedActions(parsed);
    } catch {
        return [];
    }
};

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
} as const;

export const normalizeAIPersonality = (personality?: string): 'friendly' | 'normal' | 'dad_mode' | 'bully_mode' | 'goofball' => {
    if (!personality) return 'normal';

    switch (personality.toLowerCase()) {
        case 'friendly':
        case 'supportive':
        case 'playful':
        case 'mindful':
            return 'friendly';
        case 'normal':
        case 'mentor':
        case 'stoic':
            return 'normal';
        case 'dad_mode':
        case 'dad':
        case 'coach':
            return 'dad_mode';
        case 'bully_mode':
        case 'drill_sergeant':
            return 'bully_mode';
        case 'goofball':
        case 'funny':
        case 'sarcastic':
            return 'goofball';
        default:
            return 'normal';
    }
};

// Screen mapping for navigation
export const SCREEN_MAP: Record<string, string> = {
    'home': '/(root)/(tabs)/home',
    'habits': '/(root)/(tabs)/roadmap',
    'roadmap': '/(root)/(tabs)/roadmap',
    'community': '/(root)/(tabs)/community',
    'profile': '/(root)/profile',
    'settings': '/(root)/settings',
    'notifications': '/(root)/notifications',
    'ai_settings': '/(root)/ai-settings',
    'ai-settings': '/(root)/ai-settings',
    'privacy': '/(root)/privacy',
    'help': '/(root)/help',
    'contact': '/(root)/help',
    'about': '/(root)/help',
    'paywall': '/(root)/paywall',
};

// Modal mapping
export const MODAL_MAP: Record<string, string> = {
    'ai_chat': 'ai_agent',
    'notifications': 'notifications',
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
                const personality = normalizeAIPersonality(action.data?.personality);
                if (personality) {
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
                emit('openModal', { modal: modalKey });
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
    return extractAgentActions(response)[0] || null;
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
    return 'data';
};

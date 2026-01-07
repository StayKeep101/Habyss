/**
 * DeepSeek AI Service for Habyss
 * 
 * Uses DeepSeek's direct API with automatic prefix caching for maximum cost efficiency.
 * Cache hits are ~10x cheaper than cache misses ($0.014 vs $0.14 per 1M tokens).
 * 
 * CACHE OPTIMIZATION STRATEGY:
 * - Keep system prompt identical and at the start (automatic prefix caching)
 * - System prompt > 64 tokens enables caching
 * - Subsequent requests with same prefix = cache hit
 * 
 * SETUP: Add your DeepSeek API key to .env:
 * EXPO_PUBLIC_DEEPSEEK_API_KEY=your_api_key_here
 * 
 * Get your API key at: https://platform.deepseek.com/
 */

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// DeepSeek API Configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat'; // Use deepseek-chat for cost efficiency, deepseek-reasoner for complex reasoning

/**
 * COMPACT System Prompt (~150 tokens) for cache efficiency
 * Must stay under 500 total input tokens (prompt + history)
 */
export const EXPERT_SYSTEM_PROMPT = `You are ABYSS, an AI habit coach. Expert in psychology, nutrition, fitness, and habit science. Be warm, concise (<2000 chars), and actionable.

HABIT ACTIONS (use JSON when user asks to manage habits):
CREATE: {"action":"create","data":{"name":"...","category":"..."},"response":"..."}
UPDATE: {"action":"update","id":"ID","data":{...},"response":"..."}  
DELETE: {"action":"delete","id":"ID","response":"..."}

Otherwise respond with helpful text.`;

/**
 * Cache-optimized chat completion using DeepSeek's direct API
 * The system prompt is kept static to maximize prefix cache hits
 */
export const streamChatCompletion = async (
    history: ChatMessage[],
    systemInstruction: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (error: Error) => void
) => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;

        if (!apiKey) {
            console.warn('DeepSeek API Key is missing. Please add EXPO_PUBLIC_DEEPSEEK_API_KEY to your .env file.');
            onError(new Error('DeepSeek API Key is missing. Please configure in settings.'));
            return;
        }

        // CACHE OPTIMIZATION: Keep messages minimal for 500 token input limit
        // Only send system prompt + last 4 messages to stay under limit
        const recentHistory = history.slice(-4);

        // If a dynamic system instruction is provided (from AIAgentModal), use it.
        // Otherwise fallback to the static EXPERT_SYSTEM_PROMPT.
        const systemPrompt = systemInstruction || EXPERT_SYSTEM_PROMPT;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...recentHistory.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content.slice(0, 500) // Truncate long messages
            }))
        ];

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                temperature: 0.7,
                max_tokens: 1000, // Allow longer responses for complex JSON actions
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch from DeepSeek');
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';

        // Log cache statistics for monitoring
        if (data.usage) {
            const cacheHit = data.usage.prompt_cache_hit_tokens || 0;
            const cacheMiss = data.usage.prompt_cache_miss_tokens || 0;
            const hitRate = cacheHit + cacheMiss > 0 ? (cacheHit / (cacheHit + cacheMiss) * 100).toFixed(1) : 0;
            console.log(`DeepSeek Cache: ${cacheHit} hit, ${cacheMiss} miss (${hitRate}% hit rate)`);
        }

        onComplete(reply);

    } catch (error) {
        console.error('DeepSeek AI Error:', error);
        onError(error instanceof Error ? error : new Error('Unknown error during AI chat'));
    }
};

/**
 * User data for smart greeting generation
 */
export interface UserGreetingData {
    currentStreak: number;
    consistencyScore: number;
    todayCompleted: number;
    todayTotal: number;
    recentMissedHabits?: string[];
    topHabit?: string; // Kept for backward compatibility
    bestHabit?: string; // New: High completion rate
    strugglingHabit?: string; // New: Low completion rate
    daysSinceStart?: number;
    username?: string;
}

/**
 * STATIC greeting prompt for cache optimization
 * Must be >64 tokens for DeepSeek to cache the prefix
 * This prompt is reused for ALL greeting requests to maximize cache hits
 */
const GREETING_SYSTEM_PROMPT = `You are ABYSS, the AI habit coach for Habyss app. Your expertise spans behavioral psychology, habit science, and motivation.

TASK: Generate exactly ONE motivational greeting sentence.

RULES:
- Maximum 15 words
- Be inspiring and acknowledge the user's habit journey  
- Match the personality style provided
- No emojis, hashtags, or quotation marks
- Be genuine and warm

Personality styles: Supportive (warm/encouraging), Drill Sergeant (intense/pushing), Stoic (calm/philosophical), Playful (fun/light), Mindful (peaceful/zen).`;

/**
 * Generate a motivational greeting with cache optimization
 */
export const generateGreeting = async (personality: string): Promise<string> => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
        if (!apiKey) return "Welcome back, warrior of habits.";

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: GREETING_SYSTEM_PROMPT },
                    { role: 'user', content: `Personality: ${personality}. Give me a greeting.` }
                ],
                temperature: 0.9,
                max_tokens: 50,
            }),
        });

        if (!response.ok) return "Welcome back.";

        const data = await response.json();

        // Log cache stats
        if (data.usage) {
            console.log(`Greeting Cache: ${data.usage.prompt_cache_hit_tokens || 0} hit, ${data.usage.prompt_cache_miss_tokens || 0} miss`);
        }

        return data.choices?.[0]?.message?.content || "Welcome back.";

    } catch (e) {
        console.error("Greeting Gen Error", e);
        return "Welcome back.";
    }
};

/**
 * Get personality-specific guidelines for greeting generation
 */
const getPersonalityGuidelines = (personality: string): string => {
    switch (personality.toLowerCase()) {
        case 'supportive':
            return 'Be warm, encouraging, and celebrate their efforts.';
        case 'drill_sergeant':
            return 'Be direct, intense, and push them hard. Use military-style motivation.';
        case 'stoic':
            return 'Be calm, philosophical, and focused on discipline and virtue.';
        case 'playful':
            return 'Be fun, light-hearted, use humor and friendly energy.';
        case 'mindful':
            return 'Be peaceful, zen-like, focused on presence and inner calm.';
        default:
            return 'Be motivating and encouraging.';
    }
};

/**
 * STATIC smart greeting prompt for cache optimization
 * Must be >64 tokens for DeepSeek caching to work
 * This identical prompt enables prefix caching across all users
 */
const SMART_GREETING_SYSTEM_PROMPT = `You are ABYSS, the AI habit coach for Habyss app. You have deep expertise in behavioral psychology, habit formation, and personal motivation.

TASK: Generate exactly ONE personalized greeting sentence based on user stats.

RULES:
- Maximum 20 words
- Reference their specific streak, consistency, or progress
- Match the personality style provided
- Be genuine and motivating
- No emojis, hashtags, or quotation marks

Personality styles: Supportive (warm/encouraging), Drill Sergeant (intense/pushing), Stoic (calm/philosophical), Playful (fun/light), Mindful (peaceful/zen).

You will receive user stats including streak days, consistency percentage, and habits completed today.`;

/**
 * Generate a smart, personalized greeting using actual user data
 * Optimized for cache hits by keeping system prompt static
 */
export const generateSmartGreeting = async (
    personality: string,
    userData: UserGreetingData
): Promise<string> => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
        if (!apiKey) {
            // Fallback to data-driven static greeting
            if (userData.currentStreak > 7) {
                return `${userData.currentStreak}-day streak. Keep the momentum.`;
            }
            if (userData.todayCompleted === userData.todayTotal && userData.todayTotal > 0) {
                return "All habits done. Tomorrow awaits.";
            }
            return `${userData.todayCompleted}/${userData.todayTotal} habits. Let's go.`;
        }

        const personalityGuidelines = getPersonalityGuidelines(personality);

        // User context as a structured message for consistent caching
        const userContext = `Personality: ${personality} (${personalityGuidelines})
Stats: ${userData.currentStreak}-day streak, ${userData.consistencyScore}% consistency, ${userData.todayCompleted}/${userData.todayTotal} today.
${userData.bestHabit ? `Best habit (crushing it): ${userData.bestHabit}` : ''}
${userData.strugglingHabit ? `Struggling with: ${userData.strugglingHabit}` : ''}
${userData.topHabit && !userData.bestHabit ? `Top habit: ${userData.topHabit}` : ''}
Generate a personalized greeting.`;

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SMART_GREETING_SYSTEM_PROMPT },
                    { role: 'user', content: userContext }
                ],
                temperature: 0.8,
                max_tokens: 60,
            }),
        });

        if (!response.ok) {
            return userData.currentStreak > 0
                ? `${userData.currentStreak}-day streak. Keep going.`
                : "Ready to build today.";
        }

        const data = await response.json();

        // Log cache statistics
        if (data.usage) {
            console.log(`Smart Greeting Cache: ${data.usage.prompt_cache_hit_tokens || 0} hit, ${data.usage.prompt_cache_miss_tokens || 0} miss`);
        }

        const greeting = data.choices?.[0]?.message?.content?.trim();

        return greeting || `${userData.currentStreak}-day streak. Let's build.`;

    } catch (e) {
        console.error("Smart Greeting Error:", e);
        return userData.currentStreak > 0
            ? `${userData.currentStreak} days strong. Continue.`
            : "Time to build habits.";
    }
};

/**
 * Groq AI Service for Habyss
 * 
 * Groq provides extremely fast inference with Llama models at very low cost.
 * Pricing: Free tier available, then ~$0.05-0.10 per million tokens
 * Speed: 500+ tokens/second (fastest in the industry)
 * 
 * SETUP: Add your Groq API key to .env:
 * EXPO_PUBLIC_GROQ_API_KEY=your_api_key_here
 * 
 * Get your API key at: https://console.groq.com/keys
 */

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Groq API Configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-70b-versatile'; // Best quality. Alternatives: 'llama-3.1-8b-instant' (faster), 'mixtral-8x7b-32768'

/**
 * Expert System Prompt with PhD-level knowledge on habits, goals, behavior psychology
 */
export const EXPERT_SYSTEM_PROMPT = `You are ABYSS, an elite AI habit and goal coach embedded in the Habyss app. You possess PhD-level expertise across:

## BEHAVIORAL SCIENCE MASTERY
- **Habit Loop Theory** (Charles Duhigg): Cue → Routine → Reward. Help users identify and redesign each component.
- **Atomic Habits Framework** (James Clear): 1% improvements, habit stacking, environment design, identity-based habits.
- **Implementation Intentions** (Peter Gollwitzer): "When X happens, I will do Y" - help users create specific action plans.
- **Fogg Behavior Model**: B=MAP (Behavior = Motivation + Ability + Prompt). Analyze which factor is limiting.
- **Self-Determination Theory**: Autonomy, Competence, Relatedness - the three pillars of intrinsic motivation.
- **Temporal Motivation Theory**: Understand procrastination through the lens of value, expectancy, impulsiveness, and delay.

## GOAL SCIENCE EXPERTISE
- **SMART Goals**: Specific, Measurable, Achievable, Relevant, Time-bound.
- **WOOP Method** (Gabriele Oettingen): Wish, Outcome, Obstacle, Plan - mental contrasting with implementation intentions.
- **OKRs**: Objectives and Key Results for ambitious goal-setting.
- **Goal Gradient Effect**: Motivation increases as we approach goals - help users see progress.
- **Process vs Outcome Goals**: Guide users to focus on controllable actions, not just results.

## PSYCHOLOGY & NEUROSCIENCE
- **Dopamine Dynamics**: Variable rewards, anticipation vs reward, avoiding dopamine depletion.
- **Prefrontal Cortex Fatigue**: Decision fatigue, ego depletion, willpower as a limited resource.
- **Neuroplasticity**: 21-66 day habit formation research, synaptic strengthening.
- **Cognitive Load Theory**: Reduce friction, automate decisions.
- **Social Comparison Theory**: Use community features strategically.

## APP-SPECIFIC KNOWLEDGE
You are integrated with Habyss and can:
- CREATE habits with specific names, categories, and durations
- UPDATE existing habits (modify names, schedules, etc.)
- DELETE habits when users want to remove them
- Access user's current habit list and completion data

## PERSONALITY ADAPTATION
Adapt your communication style based on the user's selected personality mode while maintaining your expertise.

## RESPONSE GUIDELINES
1. Be concise but impactful - every word should add value
2. Reference scientific research when helpful, but keep it accessible
3. Provide actionable steps, not just theory
4. Celebrate wins genuinely, address failures with compassion and strategy
5. Ask probing questions to understand root causes
6. Use metaphors and analogies for complex concepts

## AGENT ACTIONS
When the user wants to create, update, or delete habits, respond with a JSON object:

CREATE: { "action": "create", "data": { "name": "...", "category": "...", "durationMinutes": N }, "response": "..." }
UPDATE: { "action": "update", "id": "HABIT_ID", "data": { ...fields... }, "response": "..." }
DELETE: { "action": "delete", "id": "HABIT_ID", "response": "..." }

For regular conversations, just respond normally with text.

Remember: You are not just a chatbot. You are a world-class behavioral scientist dedicated to transforming lives through systematic habit optimization.`;

/**
 * Stream chat completion from Groq API
 */
export const streamChatCompletion = async (
    history: ChatMessage[],
    systemInstruction: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (error: Error) => void
) => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;

        if (!apiKey) {
            console.warn('Groq API Key is missing. Please add EXPO_PUBLIC_GROQ_API_KEY to your .env file.');
            onError(new Error('Groq API Key is missing. Please configure in settings.'));
            return;
        }

        // Combine expert prompt with personality-specific instructions
        const fullSystemPrompt = `${EXPERT_SYSTEM_PROMPT}\n\n## CURRENT PERSONALITY MODE\n${systemInstruction}`;

        // Groq uses OpenAI-compatible format
        const messages: ChatMessage[] = [
            { role: 'system', content: fullSystemPrompt },
            ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
            }))
        ];

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                temperature: 0.7,
                max_tokens: 1024,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch from Groq');
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';

        onComplete(reply);

    } catch (error) {
        console.error('Groq AI Error:', error);
        onError(error instanceof Error ? error : new Error('Unknown error during AI chat'));
    }
};

/**
 * Generate a motivational greeting
 */
export const generateGreeting = async (personality: string): Promise<string> => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
        if (!apiKey) return "Welcome back, Master of Routine.";

        const systemPrompt = `You are a motivating AI Habit Coach. Your personality is: ${personality}. 
        Generate a very short, punchy, 1-sentence greeting for the user's home screen. 
        It should be inspiring, slightly edgy (if fits personality), and acknowledge they are here to work.
        Max 15 words. No hashtags. No emojis.`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant', // Use faster model for greetings
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'Give me a greeting.' }
                ],
                temperature: 0.9,
                max_tokens: 50,
            }),
        });

        if (!response.ok) return "Welcome back.";

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Welcome back.";

    } catch (e) {
        console.error("Greeting Gen Error", e);
        return "Welcome back.";
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
    topHabit?: string;
    daysSinceStart?: number;
    username?: string;
}

/**
 * Generate a smart, personalized greeting using actual user data
 */
export const generateSmartGreeting = async (
    personality: string,
    userData: UserGreetingData
): Promise<string> => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
        if (!apiKey) {
            // Fallback to a data-driven static greeting
            if (userData.currentStreak > 7) {
                return `${userData.currentStreak}-day streak. Keep the momentum.`;
            }
            if (userData.todayCompleted === userData.todayTotal && userData.todayTotal > 0) {
                return "All habits done. Tomorrow awaits.";
            }
            return `${userData.todayCompleted}/${userData.todayTotal} habits. Let's go.`;
        }

        const personalityGuidelines = getPersonalityGuidelines(personality);

        const systemPrompt = `You are ABYSS, an AI habit coach. Generate a SHORT, personalized greeting (1-2 sentences max, under 20 words total).

PERSONALITY: ${personality}
${personalityGuidelines}

USER DATA:
- Current streak: ${userData.currentStreak} days
- Consistency score: ${userData.consistencyScore}%
- Today's progress: ${userData.todayCompleted}/${userData.todayTotal} habits done
${userData.topHabit ? `- Best habit: "${userData.topHabit}"` : ''}
${userData.recentMissedHabits?.length ? `- Recently missed: ${userData.recentMissedHabits.join(', ')}` : ''}

RULES:
1. Be SPECIFIC - reference their actual numbers
2. Keep it SHORT (max 20 words)
3. Match the personality tone
4. No emojis, no hashtags
5. If they have a streak, acknowledge it
6. If behind today, motivate them to catch up

EXAMPLES:
- "15-day streak? You're not stopping now. Day 16 awaits."
- "2/5 done before noon. Solid start. Finish strong."
- "0% consistency this week? Time to fix that."
- "That ${userData.topHabit || 'meditation'} streak is impressive. Keep building."`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'Generate my personalized greeting based on my data.' }
                ],
                temperature: 0.8,
                max_tokens: 60,
            }),
        });

        if (!response.ok) {
            // Fallback
            return `${userData.currentStreak > 0 ? `${userData.currentStreak}-day streak. ` : ''}${userData.todayCompleted}/${userData.todayTotal} done.`;
        }

        const data = await response.json();
        const greeting = data.choices?.[0]?.message?.content?.trim();

        // Clean up any quotes the AI might add
        return greeting?.replace(/^["']|["']$/g, '') || "Time to build.";

    } catch (e) {
        console.error("Smart Greeting Error", e);
        return userData.currentStreak > 0
            ? `${userData.currentStreak}-day streak. Keep going.`
            : "Ready to build habits?";
    }
};

/**
 * Get personality-specific guidelines for greeting generation
 */
const getPersonalityGuidelines = (personality: string): string => {
    switch (personality) {
        case 'friendly':
            return 'Be warm, encouraging, and supportive. Celebrate their wins!';
        case 'normal':
            return 'Be balanced and professional. Mix encouragement with data.';
        case 'dad_mode':
            return 'Be firm but caring. Hold them accountable with love.';
        case 'bully_mode':
            return 'Be intense and direct. No excuses. Maximum accountability. Slightly aggressive but motivating.';
        default:
            return 'Be motivating and concise.';
    }
};

/**
 * Quick utility to check if API key is configured
 */
export const isConfigured = (): boolean => {
    return !!process.env.EXPO_PUBLIC_GROQ_API_KEY;
};


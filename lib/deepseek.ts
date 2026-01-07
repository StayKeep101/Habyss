/**
 * DeepSeek AI Service for Habyss
 * 
 * DeepSeek is a cost-effective alternative to OpenAI and Gemini.
 * Pricing: ~$0.14 per million input tokens, ~$0.28 per million output tokens
 * 
 * SETUP: Add your DeepSeek API key to .env:
 * EXPO_PUBLIC_DEEPSEEK_API_KEY=your_api_key_here
 * 
 * Get your API key at: https://platform.deepseek.com/
 * 
 * Alternative cheaper options considered:
 * - DeepSeek: $0.14-0.28/M tokens (CURRENT - best value for quality)
 * - Groq (Llama): Free tier, then $0.05-0.10/M tokens (very fast, good for simple tasks)
 * - OpenRouter: Access to many models, pay per token
 * - Claude Haiku: $0.25/M input, $1.25/M output (higher quality but more expensive)
 * - GPT-4o-mini: $0.15/M input, $0.60/M output
 */

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// DeepSeek API Configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat'; // or 'deepseek-coder' for code-focused tasks

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
 * Stream chat completion from DeepSeek API
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

        // Combine expert prompt with personality-specific instructions
        const fullSystemPrompt = `${EXPERT_SYSTEM_PROMPT}\n\n## CURRENT PERSONALITY MODE\n${systemInstruction}`;

        // DeepSeek uses OpenAI-compatible format
        const messages: ChatMessage[] = [
            { role: 'system', content: fullSystemPrompt },
            ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
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
                max_tokens: 1024,
                stream: false, // Set to true for streaming (requires different handling)
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch from DeepSeek');
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';

        onComplete(reply);

    } catch (error) {
        console.error('DeepSeek AI Error:', error);
        onError(error instanceof Error ? error : new Error('Unknown error during AI chat'));
    }
};

/**
 * Generate a motivational greeting
 */
export const generateGreeting = async (personality: string): Promise<string> => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
        if (!apiKey) return "Welcome back, Master of Routine.";

        const systemPrompt = `You are a motivating AI Habit Coach. Your personality is: ${personality}. 
        Generate a very short, punchy, 1-sentence greeting for the user's home screen. 
        It should be inspiring, slightly edgy (if fits personality), and acknowledge they are here to work.
        Max 15 words. No hashtags. No emojis.`;

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
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
 * Quick utility to check if API key is configured
 */
export const isConfigured = (): boolean => {
    return !!process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
};

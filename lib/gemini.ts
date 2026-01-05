export interface ChatMessage {
    role: 'user' | 'model'; // Gemini roles: 'user' or 'model'
    parts: { text: string }[];
}

// Google Gemini API Configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export const streamChatCompletion = async (
    history: ChatMessage[],
    systemInstruction: string, // Gemini supports separate system instructions or it can be prepended
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (error: Error) => void
) => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

        if (!apiKey) {
            console.warn('Gemini API Key is missing. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.');
            onError(new Error('Gemini API Key is missing.'));
            return;
        }

        // Gemini API Text Request Format
        const body = {
            contents: history,
            // Setup system instruction if needed, or prepend to history
            // For gemini-pro, system instructions are often handled by context in the first message or specific field in newer versions.
            // But 'gemini-1.5-pro' supports system_instruction.
            // Let's us gemini-1.5-flash for speed/cost if available, or gemini-pro.
            // We'll standard to 'gemini-1.5-flash' which is the current "haiku/mini" equivalent.
        };

        // Actually, let's use the v1beta API proper structure
        const finalUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        // Construct contents
        // Gemini expects: { role, parts: [{ text }] }
        // System prompt usually goes into `system_instruction` field for 1.5 models
        const payload = {
            system_instruction: {
                parts: { text: systemInstruction }
            },
            contents: history
        };

        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch from Gemini');
        }

        const data = await response.json();
        // Extract text
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        onComplete(reply);

    } catch (error) {
        console.error('Gemini AI Error:', error);
        onError(error instanceof Error ? error : new Error('Unknown error during AI chat'));
    }
};

export const generateGreeting = async (personality: string): Promise<string> => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) return "Welcome back, Master of Routine.";

        const finalUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const systemPrompt = `You are a motivating AI Habit Coach. Your personality is: ${personality}. 
        Generate a very short, punchy, 1-sentence greeting for the user's home screen. 
        It should be inspiring, slightly edgy (if fits personality), and acknowledge they are here to work.
        Max 15 words. No hashtags. No emojis.`;

        const payload = {
            contents: [{ role: 'user', parts: [{ text: "Give me a greeting." }] }],
            system_instruction: { parts: { text: systemPrompt } }
        };

        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) return "Welcome back.";

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Welcome back.";

    } catch (e) {
        console.error("Greeting Gen Error", e);
        return "Welcome back.";
    }
};

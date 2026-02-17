import { mlc } from '@react-native-ai/mlc';
import { generateText } from 'ai';

class LocalLLMService {
    private modelId = 'Llama-3.2-1B-Instruct'; // Smaller 1B model to prevent overheating
    private isModelReady = false;

    // Initialize the engine (prepare the model)
    async init() {
        if (this.isModelReady) return;

        try {
            console.log(`Initializing Local LLM (${this.modelId})...`);
            // We use the provider object to get the model instance
            const model = mlc.languageModel(this.modelId);

            // Prepare the model (loads it into memory)
            // Note: This might fail if the model is not downloaded yet.
            await model.prepare();

            console.log("Local LLM Engine Initialized");
            this.isModelReady = true;
        } catch (e) {
            console.warn("Failed to initialize Local LLM:", e);
            console.warn("Model might need downloading.");
            this.isModelReady = false;
        }
    }

    // Download the model if missing
    async downloadModel(onProgress?: (progress: number) => void) {
        try {
            console.log(`Downloading Local LLM (${this.modelId})...`);
            const model = mlc.languageModel(this.modelId);

            await model.download((event) => {
                const progress = event.percentage || 0;
                console.log(`Download progress: ${progress}%`);
                if (onProgress) onProgress(progress);
            });

            console.log("Local LLM Downloaded");
            // Auto-init after download
            await this.init();
            return true;
        } catch (e) {
            console.error("Failed to download Local LLM:", e);
            return false;
        }
    }

    // Delete the model from storage
    async deleteModel() {
        try {
            console.log(`Deleting Local LLM (${this.modelId})...`);
            // Unload first if ready
            if (this.isModelReady) {
                // We might need to unload explicitly if the SDK supports it, or just rely on remove
                // mlc.languageModel doesn't seem to have a direct unload on the instance we create easily 
                // without keeping the reference, but we can try removing directly.
            }

            const model = mlc.languageModel(this.modelId);
            // The remove method is available on the model instance in the SDK
            // We need to cast or ensure typescript knows about it if it's in the interface
            // Looking at ai-sdk.ts, 'remove' is part of MlcChatLanguageModel
            await (model as any).remove();

            console.log("Local LLM Deleted");
            this.isModelReady = false;
            return true;
        } catch (e) {
            console.error("Failed to delete Local LLM:", e);
            return false;
        }
    }

    async generateResponse(systemPrompt: string, userMessage: string): Promise<string> {
        if (!this.isModelReady) {
            // Try to init just in case
            await this.init();
            if (!this.isModelReady) {
                return "I'm not ready yet. Please download the offline model in settings.";
            }
        }

        try {
            const model = mlc.languageModel(this.modelId);

            // Construct the prompt with system context
            const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}`;

            // Generate text using Vercel AI SDK
            const { text } = await generateText({
                model: model,
                prompt: fullPrompt,
            });

            return text;
        } catch (e) {
            console.error("Local LLM Generation Error:", e);
            return "I'm having trouble thinking locally. Check my memory (RAM).";
        }
    }

    isReady() {
        return this.isModelReady;
    }

    getModelId() {
        return this.modelId;
    }
}

export default new LocalLLMService();

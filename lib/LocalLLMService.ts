import { mlc } from '@react-native-ai/mlc';
import { generateText } from 'ai';
import { hasCompleteIOSModelFiles } from './localModelFiles';

class LocalLLMService {
    private modelId = 'Llama-3.2-1B-Instruct'; // Smaller 1B model to prevent overheating
    private isModelReady = false;
    private pendingOperation: Promise<unknown> = Promise.resolve();
    private downloading: Promise<boolean> | null = null;
    private progressListeners = new Set<(progress: number) => void>();

    // Startup and Settings can both request the model. Never download, load or
    // remove its files concurrently.
    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const pending = this.pendingOperation.then(operation, operation);
        this.pendingOperation = pending.catch(() => undefined);
        return pending;
    }

    // Initialize the engine (prepare the model)
    init() {
        return this.enqueue(() => this.prepareDownloadedModel());
    }

    private async prepareDownloadedModel() {
        if (this.isModelReady) return;

        try {
            if (!await hasCompleteIOSModelFiles(this.modelId)) {
                console.info('Local LLM download is incomplete; using built-in responses.');
                return;
            }
            console.log(`Initializing Local LLM (${this.modelId})...`);
            // We use the provider object to get the model instance
            const model = mlc.languageModel(this.modelId);

            // Prepare the model (loads it into memory)
            // Never call this with partial files: the native worker can abort.
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
        if (onProgress) this.progressListeners.add(onProgress);
        if (!this.downloading) {
            this.downloading = this.enqueue(() => this.downloadAndPrepare())
                .finally(() => { this.downloading = null; });
        }
        try {
            return await this.downloading;
        } finally {
            if (onProgress) this.progressListeners.delete(onProgress);
        }
    }

    private async downloadAndPrepare() {
        if (this.isModelReady) return true;
        try {
            console.log(`Downloading Local LLM (${this.modelId})...`);
            const model = mlc.languageModel(this.modelId);

            await model.download((event) => {
                const progress = event.percentage || 0;
                console.log(`Download progress: ${progress}%`);
                this.progressListeners.forEach(listener => listener(progress));
            });

            console.log("Local LLM Downloaded");
            // Auto-init after download
            await this.prepareDownloadedModel();
            return this.isModelReady;
        } catch (e) {
            console.error("Failed to download Local LLM:", e);
            return false;
        }
    }

    // Delete the model from storage
    deleteModel() {
        return this.enqueue(() => this.removeDownloadedModel());
    }

    private async removeDownloadedModel() {
        try {
            console.log(`Deleting Local LLM (${this.modelId})...`);
            const model = mlc.languageModel(this.modelId);
            if (this.isModelReady) {
                await model.unload();
                this.isModelReady = false;
            }
            await model.remove();

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

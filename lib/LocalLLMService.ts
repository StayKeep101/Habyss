import { mlc } from '@react-native-ai/mlc';
import { generateText } from 'ai';
import { hasCompleteIOSModelFiles } from './localModelFiles';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { downloadIOSModel, LOCAL_MODEL, ModelDownloadCancelled, type ModelTransferProgress } from './localModelDownload';

export type ModelDownloadState = ModelTransferProgress & {
    phase: 'idle' | 'downloading' | 'loading' | 'ready' | 'cancelled' | 'error';
    error?: string;
};
export const LLAMA_OPT_IN_KEY = 'habyss_llama_opt_in';
export const INITIAL_MODEL_DOWNLOAD: ModelDownloadState = {
    phase: 'idle', downloadedBytes: 0, totalBytes: null, percentage: 0,
};

class LocalLLMService {
    private modelId = LOCAL_MODEL.id;
    private isModelReady = false;
    private pendingOperation: Promise<unknown> = Promise.resolve();
    private downloading: Promise<boolean> | null = null;
    private progressListeners = new Set<(progress: number) => void>();
    private downloadState: ModelDownloadState = INITIAL_MODEL_DOWNLOAD;
    private stateListeners = new Set<(state: ModelDownloadState) => void>();
    private downloadController: AbortController | null = null;

    getDownloadState = () => this.downloadState;

    subscribeDownloadState = (listener: (state: ModelDownloadState) => void) => {
        this.stateListeners.add(listener);
        listener(this.downloadState);
        return () => { this.stateListeners.delete(listener); };
    };

    private updateDownload(state: ModelDownloadState) {
        this.downloadState = state;
        this.stateListeners.forEach(listener => listener(state));
        this.progressListeners.forEach(listener => listener(state.percentage));
    }

    cancelDownload() { this.downloadController?.abort(); }

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
            this.downloadController = new AbortController();
            this.updateDownload({ ...INITIAL_MODEL_DOWNLOAD, phase: 'downloading' });
            this.downloading = this.enqueue(() => this.downloadAndPrepare())
                .finally(() => { this.downloading = null; this.downloadController = null; });
        }
        try {
            return await this.downloading;
        } finally {
            if (onProgress) this.progressListeners.delete(onProgress);
        }
    }

    private async downloadAndPrepare() {
        try {
            if (this.downloadController?.signal.aborted) throw new ModelDownloadCancelled();
            if (!this.isModelReady) {
                if (Platform.OS === 'ios') {
                    await downloadIOSModel(this.downloadController!.signal, progress => {
                        this.updateDownload({ ...progress, phase: 'downloading' });
                    });
                } else {
                    await mlc.languageModel(this.modelId).download(event => {
                        this.updateDownload({ ...INITIAL_MODEL_DOWNLOAD, phase: 'downloading', percentage: event.percentage || 0 });
                    });
                }
            }
            if (this.downloadController?.signal.aborted) throw new ModelDownloadCancelled();
            this.updateDownload({ ...this.downloadState, phase: 'loading', percentage: 100 });
            await this.prepareDownloadedModel();
            if (!this.isModelReady) throw new Error('The model could not load. Retry, or remove it and download a fresh copy.');
            await AsyncStorage.setItem(LLAMA_OPT_IN_KEY, '1');
            this.updateDownload({ ...this.downloadState, phase: 'ready' });
            return true;
        } catch (e) {
            if (e instanceof ModelDownloadCancelled) {
                this.updateDownload({ ...this.downloadState, phase: 'cancelled' });
                return false;
            }
            this.updateDownload({ ...this.downloadState, phase: 'error', error: e instanceof Error ? e.message : 'Download failed. Check your connection and try again.' });
            console.warn('Failed to download Local LLM:', e);
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
            await AsyncStorage.removeItem(LLAMA_OPT_IN_KEY);
            this.updateDownload(INITIAL_MODEL_DOWNLOAD);

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

    /** Whether the model's files are fully on this phone (it may not be loaded yet). */
    isDownloaded(): Promise<boolean> {
        return hasCompleteIOSModelFiles(this.modelId).catch(() => false);
    }

    isReady() {
        return this.isModelReady;
    }

    getModelId() {
        return this.modelId;
    }
}

export default new LocalLLMService();

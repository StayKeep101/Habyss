import { generateText, type LanguageModel } from 'ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasCompleteModelFile } from './localModelFiles';
import { downloadIOSModel, LOCAL_MODEL, modelUri, ModelDownloadCancelled, removeOldModel, type ModelTransferProgress } from './localModelDownload';

export type ModelDownloadState = ModelTransferProgress & {
    phase: 'idle' | 'downloading' | 'loading' | 'ready' | 'cancelled' | 'error';
    error?: string;
};
/** Set once someone chose to download the offline model (kept under its old name so a choice made before carries over). */
export const LLAMA_OPT_IN_KEY = 'habyss_llama_opt_in';
export const INITIAL_MODEL_DOWNLOAD: ModelDownloadState = {
    phase: 'idle', downloadedBytes: 0, totalBytes: null, percentage: 0,
};

/** How much text the model holds at once: plenty for a line or a parsed note, light on memory. */
const CONTEXT = { n_ctx: 2048, n_gpu_layers: 99 };

/**
 * The offline model (lib/localModelDownload.ts: Qwen3.5 0.8B; Gemma 3n on builds before 1.0.4), run on the phone by llama.cpp (llama.rn,
 * through @react-native-ai/llama). Downloaded only when asked (Echo settings),
 * loaded only once its file is complete.
 */
class LocalLLMService {
    private modelId = LOCAL_MODEL.id;
    private model: (LanguageModel & { prepare: () => Promise<unknown>; unload: () => Promise<void> }) | null = null;
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
    // remove its file concurrently.
    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const pending = this.pendingOperation.then(operation, operation);
        this.pendingOperation = pending.catch(() => undefined);
        return pending;
    }

    /** The model as the AI SDK takes it; created once. */
    private languageModel() {
        if (!this.model) {
            const uri = modelUri();
            if (!uri) return null;
            const { llama } = require('@react-native-ai/llama') as typeof import('@react-native-ai/llama');
            this.model = llama.languageModel(uri.replace(/^file:\/\//, ''), { contextParams: CONTEXT }) as never;
        }
        return this.model;
    }

    init() {
        return this.enqueue(() => this.prepareDownloadedModel());
    }

    // Loaded only while it is being used: ~560 MB held in memory and the GPU kept warm by
    // a model nobody is asking anything heated the phone. Known to be here at launch (a file
    // check, nothing loaded), loaded on the first question, let go after a few quiet minutes
    // and the moment the app leaves the screen. Never while it is still answering.
    private available = false;
    private busy = 0;
    private idle: ReturnType<typeof setTimeout> | null = null;
    private watching = false;
    static readonly IDLE_MS = 3 * 60_000;

    /** At launch: is it on this phone, without loading it. */
    async checkAvailable(): Promise<boolean> {
        this.available = await hasCompleteModelFile().catch(() => false);
        this.watchAppState();
        return this.available;
    }

    /** Downloaded (and chosen): it can answer, loading first if it has to. */
    isAvailable() {
        return this.available || this.isModelReady;
    }

    /** Loads it if it is not loaded, runs `work` with it, and lets it go once quiet. */
    async use<T>(work: (model: LanguageModel) => Promise<T>): Promise<T | null> {
        if (this.idle) { clearTimeout(this.idle); this.idle = null; }
        this.busy += 1;
        try {
            if (!this.isModelReady) await this.init();
            const model = this.getLanguageModel();
            if (!model) return null;
            return await work(model);
        } finally {
            this.busy -= 1;
            this.releaseSoon();
        }
    }

    private releaseSoon() {
        if (this.idle) clearTimeout(this.idle);
        this.idle = setTimeout(() => { this.idle = null; void this.release(); }, LocalLLMService.IDLE_MS);
    }

    /** Lets go of it now, unless it is answering (then once it has). */
    release(): Promise<void> {
        return this.enqueue(async () => {
            if (!this.isModelReady || this.busy > 0) { if (this.busy > 0) this.releaseSoon(); return; }
            await this.model?.unload().catch(() => undefined);
            this.isModelReady = false;
        });
    }

    private watchAppState() {
        if (this.watching) return;
        this.watching = true;
        const { AppState } = require('react-native') as typeof import('react-native');
        AppState.addEventListener('change', state => { if (state === 'background') void this.release(); });
    }

    private async prepareDownloadedModel() {
        if (this.isModelReady) return;
        // The Llama files earlier builds used are no longer read: give the space back.
        void removeOldModel();
        try {
            if (!await hasCompleteModelFile()) {
                console.info('Offline model not downloaded; using built-in responses.');
                return;
            }
            const model = this.languageModel();
            if (!model) return;
            // Loads it into memory. Never with a partial file (checked above).
            await model.prepare();
            this.isModelReady = true;
        } catch (e) {
            console.warn('Failed to initialize Local LLM:', e);
            this.isModelReady = false;
        }
    }

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
                await downloadIOSModel(this.downloadController!.signal, progress => {
                    this.updateDownload({ ...progress, phase: 'downloading' });
                });
            }
            if (this.downloadController?.signal.aborted) throw new ModelDownloadCancelled();
            this.updateDownload({ ...this.downloadState, phase: 'loading', percentage: 100 });
            await this.prepareDownloadedModel();
            if (!this.isModelReady) throw new Error('The model could not load. Retry, or remove it and download a fresh copy.');
            this.available = true;
            this.watchAppState();
            this.releaseSoon();
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

    deleteModel() {
        return this.enqueue(() => this.removeDownloadedModel());
    }

    private async removeDownloadedModel() {
        try {
            if (this.isModelReady) await this.model?.unload().catch(() => undefined);
            this.isModelReady = false;
            this.available = false;
            this.model = null;
            const uri = modelUri();
            if (uri) {
                const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
                await FileSystem.deleteAsync(uri, { idempotent: true });
            }
            await AsyncStorage.removeItem(LLAMA_OPT_IN_KEY);
            this.updateDownload(INITIAL_MODEL_DOWNLOAD);
            return true;
        } catch (e) {
            console.error('Failed to delete Local LLM:', e);
            return false;
        }
    }

    async generateResponse(systemPrompt: string, userMessage: string): Promise<string> {
        if (!this.isAvailable() && !(await this.checkAvailable())) return "I'm not ready yet. Please download the offline model in settings.";
        try {
            const text = await this.use(async model => (await generateText({ model, system: systemPrompt, prompt: userMessage })).text);
            return text ?? "I'm not ready yet. Please download the offline model in settings.";
        } catch (e) {
            console.error('Local LLM Generation Error:', e);
            return "I'm having trouble thinking locally. Check my memory (RAM).";
        }
    }

    /** Whether the model's file is fully on this phone (it may not be loaded yet). */
    isDownloaded(): Promise<boolean> {
        return hasCompleteModelFile().catch(() => false);
    }

    isReady() {
        return this.isModelReady;
    }

    /** The loaded model for the AI SDK, or null before it is ready. */
    getLanguageModel(): LanguageModel | null {
        return this.isModelReady ? this.languageModel() : null;
    }

    getModelId() {
        return this.modelId;
    }
}

export default new LocalLLMService();

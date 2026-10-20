import LocalLLMService from '../LocalLLMService';
import { llama } from '@react-native-ai/llama';
import { generateText } from 'ai';
import * as FileSystem from 'expo-file-system/legacy';
import { hasCompleteModelFile } from '../localModelFiles';
import { downloadIOSModel, ModelDownloadCancelled } from '../localModelDownload';

jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', deleteAsync: jest.fn() }));
jest.mock('../localModelDownload', () => ({ ...jest.requireActual('../localModelDownload'), downloadIOSModel: jest.fn(), removeOldModel: jest.fn(async () => undefined) }));
const mockDownload = jest.mocked(downloadIOSModel);
jest.mock('../localModelFiles', () => ({ hasCompleteModelFile: jest.fn() }));
jest.mock('ai', () => ({ generateText: jest.fn() }));

describe('the offline model (Gemma 3n E2B)', () => {
    const mockModel = { prepare: jest.fn(), unload: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        mockDownload.mockReset().mockResolvedValue(undefined);
        Object.values(mockModel).forEach(mock => mock.mockReset().mockResolvedValue(undefined));
        (hasCompleteModelFile as jest.Mock).mockReset().mockResolvedValue(true);
        (llama.languageModel as jest.Mock).mockReturnValue(mockModel);
        (FileSystem.deleteAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
        (LocalLLMService as any).isModelReady = false;
        (LocalLLMService as any).model = null;
    });

    describe('init', () => {
        it('never enters the native engine when the file is incomplete', async () => {
            (hasCompleteModelFile as jest.Mock).mockResolvedValue(false);
            await LocalLLMService.init();
            expect(mockModel.prepare).not.toHaveBeenCalled();
            expect(LocalLLMService.isReady()).toBe(false);
        });

        it('prepares only once for concurrent startup requests', async () => {
            await Promise.all([LocalLLMService.init(), LocalLLMService.init()]);
            expect(mockModel.prepare).toHaveBeenCalledTimes(1);
        });

        it('loads the Gemma file from the phone', async () => {
            await LocalLLMService.init();
            expect(llama.languageModel).toHaveBeenCalledWith('/documents/llama-models/gemma-3n-E2B-it-Q4_K_M.gguf', expect.objectContaining({ contextParams: expect.any(Object) }));
            expect(LocalLLMService.isReady()).toBe(true);
            expect(LocalLLMService.getLanguageModel()).toBe(mockModel);
        });

        it('handles a load failure gracefully', async () => {
            mockModel.prepare.mockRejectedValue(new Error('Out of memory'));
            const warn = jest.spyOn(console, 'warn').mockImplementation();
            await LocalLLMService.init();
            expect(LocalLLMService.isReady()).toBe(false);
            expect(LocalLLMService.getLanguageModel()).toBeNull();
            warn.mockRestore();
        });
    });

    describe('downloadModel', () => {
        it('replays current progress to a reopened settings screen', async () => {
            mockDownload.mockImplementation(async (_signal, progress) => {
                progress({ percentage: 42, downloadedBytes: 420, totalBytes: 1000 });
                const reopened = jest.fn();
                const stop = LocalLLMService.subscribeDownloadState(reopened);
                expect(reopened).toHaveBeenCalledWith(expect.objectContaining({ phase: 'downloading', percentage: 42 }));
                stop();
            });
            expect(await LocalLLMService.downloadModel()).toBe(true);
            expect(LocalLLMService.getDownloadState().phase).toBe('ready');
        });

        it('reports cancellation without loading the model', async () => {
            mockDownload.mockRejectedValue(new ModelDownloadCancelled());
            expect(await LocalLLMService.downloadModel()).toBe(false);
            expect(LocalLLMService.getDownloadState().phase).toBe('cancelled');
            expect(mockModel.prepare).not.toHaveBeenCalled();
        });

        it('rechecks the file after downloading and rejects an incomplete one', async () => {
            (hasCompleteModelFile as jest.Mock).mockResolvedValue(false);
            expect(await LocalLLMService.downloadModel()).toBe(false);
            expect(mockModel.prepare).not.toHaveBeenCalled();
        });

        it('shares one download between startup and Settings', async () => {
            const first = jest.fn();
            const second = jest.fn();
            mockDownload.mockImplementation(async (_signal, callback) => callback({ percentage: 50, downloadedBytes: 500, totalBytes: 1000 }));
            expect(await Promise.all([LocalLLMService.downloadModel(first), LocalLLMService.downloadModel(second)])).toEqual([true, true]);
            expect(mockDownload).toHaveBeenCalledTimes(1);
            expect(first).toHaveBeenCalledWith(50);
            expect(second).toHaveBeenCalledWith(50);
        });

        it('reports a network error', async () => {
            mockDownload.mockRejectedValue(new Error('Network error'));
            const warn = jest.spyOn(console, 'warn').mockImplementation();
            expect(await LocalLLMService.downloadModel()).toBe(false);
            expect(LocalLLMService.getDownloadState()).toMatchObject({ phase: 'error', error: 'Network error' });
            warn.mockRestore();
        });
    });

    describe('deleteModel', () => {
        it('unloads before removing the file', async () => {
            await LocalLLMService.init();
            expect(await LocalLLMService.deleteModel()).toBe(true);
            expect(mockModel.unload).toHaveBeenCalledTimes(1);
            expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///documents/llama-models/gemma-3n-E2B-it-Q4_K_M.gguf', { idempotent: true });
            expect(mockModel.unload.mock.invocationCallOrder[0]).toBeLessThan((FileSystem.deleteAsync as jest.Mock).mock.invocationCallOrder[0]);
            expect(LocalLLMService.isReady()).toBe(false);
        });

        it('reports a failure to remove', async () => {
            (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('Deletion failed'));
            const error = jest.spyOn(console, 'error').mockImplementation();
            expect(await LocalLLMService.deleteModel()).toBe(false);
            error.mockRestore();
        });
    });

    describe('generateResponse', () => {
        it('answers once ready', async () => {
            await LocalLLMService.init();
            (generateText as jest.Mock).mockResolvedValue({ text: 'Test response' });
            expect(await LocalLLMService.generateResponse('You are kind', 'Hello!')).toBe('Test response');
            expect(generateText).toHaveBeenCalledWith({ model: mockModel, system: 'You are kind', prompt: 'Hello!' });
        });

        it('says so when the model is not ready', async () => {
            (hasCompleteModelFile as jest.Mock).mockResolvedValue(false);
            expect(await LocalLLMService.generateResponse('System', 'User')).toBe("I'm not ready yet. Please download the offline model in settings.");
        });
    });

    it('is Gemma 3n E2B', () => {
        expect(LocalLLMService.getModelId()).toBe('gemma-3n-E2B-it');
    });
});

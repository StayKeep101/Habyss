import LocalLLMService from '../LocalLLMService';
import { mlc } from '@react-native-ai/mlc';
import { generateText } from 'ai';
import { hasCompleteIOSModelFiles } from '../localModelFiles';
import { downloadIOSModel, ModelDownloadCancelled } from '../localModelDownload';

jest.mock('../localModelDownload', () => ({ ...jest.requireActual('../localModelDownload'), downloadIOSModel: jest.fn() }));
const mockDownload = jest.mocked(downloadIOSModel);

jest.mock('../localModelFiles', () => ({ hasCompleteIOSModelFiles: jest.fn() }));

// Mock the 'ai' package
jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

describe('LocalLLMService', () => {
  const mockModel = {
    prepare: jest.fn(),
    download: jest.fn(),
    remove: jest.fn(),
    unload: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDownload.mockReset().mockResolvedValue(undefined);
    Object.values(mockModel).forEach(mock => mock.mockReset().mockResolvedValue(undefined));
    (hasCompleteIOSModelFiles as jest.Mock).mockReset().mockResolvedValue(true);
    (mlc.languageModel as jest.Mock).mockReturnValue(mockModel);
    // Reset the service state
    (LocalLLMService as any).isModelReady = false;
  });

  describe('init', () => {
    it('never enters the native engine when the model is incomplete', async () => {
      (hasCompleteIOSModelFiles as jest.Mock).mockResolvedValue(false);

      await LocalLLMService.init();

      expect(mockModel.prepare).not.toHaveBeenCalled();
      expect(LocalLLMService.isReady()).toBe(false);
    });

    it('prepares only once for concurrent startup requests', async () => {
      await Promise.all([LocalLLMService.init(), LocalLLMService.init()]);
      expect(mockModel.prepare).toHaveBeenCalledTimes(1);
    });

    it('should initialize the model successfully', async () => {
      mockModel.prepare.mockResolvedValue(undefined);

      await LocalLLMService.init();

      expect(mlc.languageModel).toHaveBeenCalledWith('Llama-3.2-1B-Instruct');
      expect(mockModel.prepare).toHaveBeenCalled();
      expect(LocalLLMService.isReady()).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      mockModel.prepare.mockRejectedValue(new Error('Model not found'));
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await LocalLLMService.init();

      expect(LocalLLMService.isReady()).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to initialize Local LLM:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not reinitialize if already ready', async () => {
      mockModel.prepare.mockResolvedValue(undefined);

      await LocalLLMService.init();
      await LocalLLMService.init();

      // prepare should only be called once
      expect(mockModel.prepare).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloadModel', () => {
    it('replays current progress to a reopened settings screen and releases its listener', async () => {
      const unsubscribe = LocalLLMService.subscribeDownloadState(jest.fn());
      mockDownload.mockImplementation(async (_signal, progress) => {
        progress({ percentage: 42, downloadedBytes: 420, totalBytes: 1000 });
        const reopened = jest.fn();
        const stop = LocalLLMService.subscribeDownloadState(reopened);
        expect(reopened).toHaveBeenCalledWith(expect.objectContaining({ phase: 'downloading', percentage: 42 }));
        stop();
      });
      expect(await LocalLLMService.downloadModel()).toBe(true);
      expect(LocalLLMService.getDownloadState().phase).toBe('ready');
      unsubscribe();
    });

    it('reports cancellation without loading the model', async () => {
      mockDownload.mockRejectedValue(new ModelDownloadCancelled());
      expect(await LocalLLMService.downloadModel()).toBe(false);
      expect(LocalLLMService.getDownloadState().phase).toBe('cancelled');
      expect(mockModel.prepare).not.toHaveBeenCalled();
    });

    it('rechecks files after downloading and rejects an incomplete model', async () => {
      (hasCompleteIOSModelFiles as jest.Mock).mockResolvedValue(false);

      expect(await LocalLLMService.downloadModel()).toBe(false);
      expect(mockDownload).toHaveBeenCalledTimes(1);
      expect(mockModel.prepare).not.toHaveBeenCalled();
    });

    it('reports a preparation failure instead of a successful download', async () => {
      mockModel.prepare.mockRejectedValue(new Error('Unable to prepare'));
      expect(await LocalLLMService.downloadModel()).toBe(false);
    });

    it('shares one download between startup and Settings', async () => {
      const first = jest.fn();
      const second = jest.fn();
      mockDownload.mockImplementation(async (_signal, callback) => callback({ percentage: 50, downloadedBytes: 500, totalBytes: 1000 }));

      expect(await Promise.all([
        LocalLLMService.downloadModel(first), LocalLLMService.downloadModel(second),
      ])).toEqual([true, true]);
      expect(mockDownload).toHaveBeenCalledTimes(1);
      expect(mockModel.prepare).toHaveBeenCalledTimes(1);
      expect(first).toHaveBeenCalledWith(50);
      expect(second).toHaveBeenCalledWith(50);
    });

    it('should download the model with progress callback', async () => {
      const mockProgressCallback = jest.fn();
      const mockDownloadEvent = { percentage: 50, downloadedBytes: 500, totalBytes: 1000 };

      mockDownload.mockImplementation((_signal, callback) => {
        callback(mockDownloadEvent);
        return Promise.resolve();
      });
      mockModel.prepare.mockResolvedValue(undefined);

      const result = await LocalLLMService.downloadModel(mockProgressCallback);

      expect(result).toBe(true);
      expect(mockDownload).toHaveBeenCalled();
      expect(mockProgressCallback).toHaveBeenCalledWith(50);
      expect(LocalLLMService.isReady()).toBe(true);
    });

    it('should handle download errors', async () => {
      mockDownload.mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await LocalLLMService.downloadModel();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to download Local LLM:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('deleteModel', () => {
    it('waits for a download and unloads before removing files', async () => {
      let finishDownload!: () => void;
      mockDownload.mockReturnValue(new Promise<void>(resolve => { finishDownload = resolve; }));
      const download = LocalLLMService.downloadModel();
      const remove = LocalLLMService.deleteModel();
      await Promise.resolve();
      expect(mockModel.remove).not.toHaveBeenCalled();
      finishDownload();
      expect(await download).toBe(true);
      expect(await remove).toBe(true);
      expect(mockModel.unload).toHaveBeenCalledTimes(1);
      expect(mockModel.unload.mock.invocationCallOrder[0]).toBeLessThan(mockModel.remove.mock.invocationCallOrder[0]);
      expect(LocalLLMService.isReady()).toBe(false);
    });

    it('should delete the model successfully', async () => {
      mockModel.remove.mockResolvedValue(undefined);

      const result = await LocalLLMService.deleteModel();

      expect(result).toBe(true);
      expect(mockModel.remove).toHaveBeenCalled();
      expect(LocalLLMService.isReady()).toBe(false);
    });

    it('should handle deletion errors', async () => {
      mockModel.remove.mockRejectedValue(new Error('Deletion failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await LocalLLMService.deleteModel();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to delete Local LLM:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateResponse', () => {
    it('should generate a response when model is ready', async () => {
      (LocalLLMService as any).isModelReady = true;
      (generateText as jest.Mock).mockResolvedValue({ text: 'Test response' });

      const response = await LocalLLMService.generateResponse(
        'You are a helpful assistant',
        'Hello!'
      );

      expect(response).toBe('Test response');
      expect(generateText).toHaveBeenCalledWith({
        model: mockModel,
        prompt: 'You are a helpful assistant\n\nUser: Hello!',
      });
    });

    it('should return error message when model is not ready', async () => {
      mockModel.prepare.mockRejectedValue(new Error('Model not ready'));

      const response = await LocalLLMService.generateResponse(
        'System prompt',
        'User message'
      );

      expect(response).toBe(
        "I'm not ready yet. Please download the offline model in settings."
      );
    });

    it('should handle generation errors gracefully', async () => {
      (LocalLLMService as any).isModelReady = true;
      (generateText as jest.Mock).mockRejectedValue(new Error('Generation failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await LocalLLMService.generateResponse(
        'System prompt',
        'User message'
      );

      expect(response).toBe(
        "I'm having trouble thinking locally. Check my memory (RAM)."
      );
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('utility methods', () => {
    it('should return correct model ID', () => {
      expect(LocalLLMService.getModelId()).toBe('Llama-3.2-1B-Instruct');
    });

    it('should return ready status', () => {
      expect(LocalLLMService.isReady()).toBe(false);

      (LocalLLMService as any).isModelReady = true;
      expect(LocalLLMService.isReady()).toBe(true);
    });
  });
});

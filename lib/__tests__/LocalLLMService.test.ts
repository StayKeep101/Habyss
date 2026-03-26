import LocalLLMService from '../LocalLLMService';
import { mlc } from '@react-native-ai/mlc';
import { generateText } from 'ai';

// Mock the 'ai' package
jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

describe('LocalLLMService', () => {
  const mockModel = {
    prepare: jest.fn(),
    download: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mlc.languageModel as jest.Mock).mockReturnValue(mockModel);
    // Reset the service state
    (LocalLLMService as any).isModelReady = false;
  });

  describe('init', () => {
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
    it('should download the model with progress callback', async () => {
      const mockProgressCallback = jest.fn();
      const mockDownloadEvent = { percentage: 50 };

      mockModel.download.mockImplementation((callback) => {
        callback(mockDownloadEvent);
        return Promise.resolve();
      });
      mockModel.prepare.mockResolvedValue(undefined);

      const result = await LocalLLMService.downloadModel(mockProgressCallback);

      expect(result).toBe(true);
      expect(mockModel.download).toHaveBeenCalled();
      expect(mockProgressCallback).toHaveBeenCalledWith(50);
      expect(LocalLLMService.isReady()).toBe(true);
    });

    it('should handle download errors', async () => {
      mockModel.download.mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

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

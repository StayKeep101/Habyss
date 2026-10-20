import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { askForLine, askForObject, currentEngine } from '../onDeviceAI';

const mockAppleAvailable = jest.fn(() => false);
jest.mock('../nativeModules', () => ({ hasTurboModule: () => true }));
jest.mock('@react-native-ai/apple', () => ({
    apple: Object.assign(() => 'apple-model', { isAvailable: () => mockAppleAvailable() }),
}));
jest.mock('../LocalLLMService', () => ({ __esModule: true, default: {
    isReady: () => true, getModelId: () => 'gemma-3n-E2B-it', getLanguageModel: () => 'gemma-model',
} }));
jest.mock('ai', () => ({ generateObject: jest.fn(), generateText: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    mockAppleAvailable.mockReturnValue(false);
});
afterEach(() => jest.useRealTimers());

it('passes the field schema to Gemma instead of asking for arbitrary JSON', async () => {
    const schema = z.object({ name: z.string() });
    jest.mocked(generateObject).mockResolvedValue({ object: { name: 'Run' } } as any);
    expect(await askForObject(schema, 'Read a habit', 'Run')).toEqual({ name: 'Run' });
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ schema, maxOutputTokens: 512, maxRetries: 0 }));
});

it('rechecks Apple availability when system assets become ready', () => {
    expect(currentEngine()).toBe('llama');
    mockAppleAvailable.mockReturnValue(true);
    expect(currentEngine()).toBe('apple');
});

it('does not start another native generation after the UI timeout', async () => {
    jest.useFakeTimers();
    let finish!: (result: any) => void;
    jest.mocked(generateText).mockReturnValue(new Promise(resolve => { finish = resolve; }) as any);
    const response = askForLine('One sentence', 'Hello', 100);
    await jest.advanceTimersByTimeAsync(100);
    expect(await response).toBeNull();
    expect(await askForLine('One sentence', 'Again', 100)).toBeNull();
    expect(generateText).toHaveBeenCalledTimes(1);
    finish({ text: 'Ready' });
    await jest.advanceTimersByTimeAsync(0);
    jest.mocked(generateText).mockResolvedValue({ text: 'New response' } as any);
    expect(await askForLine('One sentence', 'Again', 100)).toBe('New response');
});

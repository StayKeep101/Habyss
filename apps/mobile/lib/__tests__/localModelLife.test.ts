/**
 * The downloaded model is held only while it is used (lib/LocalLLMService.ts):
 * known at launch without loading, loaded on the first question, let go after a
 * few quiet minutes or when the app leaves the screen, never mid-answer.
 */
const mockPrepare = jest.fn(async () => undefined);
const mockUnload = jest.fn(async () => undefined);
let appState: ((state: string) => void) | null = null;
jest.mock('react-native', () => {
    const actual = jest.requireActual('react-native');
    return new Proxy(actual, { get: (target, key) => (key === 'AppState'
        ? { addEventListener: (_: string, listener: (state: string) => void) => { appState = listener; return { remove: () => undefined }; } }
        : target[key]) });
});
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) }));
jest.mock('../localModelFiles', () => ({ hasCompleteModelFile: jest.fn(async () => true) }));
jest.mock('../localModelDownload', () => ({ LOCAL_MODEL: { id: 'qwen' }, modelUri: () => 'file:///model.gguf', removeOldModel: async () => undefined, downloadIOSModel: async () => undefined, ModelDownloadCancelled: class extends Error {} }));
jest.mock('@react-native-ai/llama', () => ({ llama: { languageModel: () => ({ prepare: mockPrepare, unload: mockUnload }) } }));
jest.mock('ai', () => ({ generateText: jest.fn() }));

import service from '../LocalLLMService';

const settle = () => new Promise(resolve => setImmediate(resolve));

beforeEach(() => { jest.useFakeTimers({ doNotFake: ['setImmediate'] }); mockPrepare.mockClear(); mockUnload.mockClear(); });
afterEach(() => jest.useRealTimers());

it('at launch it is only known to be here: nothing is loaded', async () => {
    expect(await service.checkAvailable()).toBe(true);
    expect(service.isAvailable()).toBe(true);
    expect(mockPrepare).not.toHaveBeenCalled();
});

it('loads on the first question, and lets go after three quiet minutes', async () => {
    await service.checkAvailable();
    expect(await service.use(async () => 'line')).toBe('line');
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2 * 60_000);
    expect(mockUnload).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(60_000);
    await settle();
    expect(mockUnload).toHaveBeenCalledTimes(1);
    expect(service.isReady()).toBe(false);
    expect(service.isAvailable()).toBe(true);
});

it('lets go when the app leaves the screen, but never mid-answer', async () => {
    await service.checkAvailable();
    let finish!: () => void;
    const answering = service.use(() => new Promise<void>(resolve => { finish = resolve; }));
    await settle(); await settle();
    appState?.('background');
    await settle();
    expect(mockUnload).not.toHaveBeenCalled();
    finish();
    await answering;
    appState?.('background');
    await settle(); await settle();
    expect(mockUnload).toHaveBeenCalled();
});

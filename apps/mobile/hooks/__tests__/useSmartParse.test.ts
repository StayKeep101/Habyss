import { act, renderHook } from '@testing-library/react-native';
import { currentEngine, isOnDeviceAIReady } from '@/lib/onDeviceAI';
import { useSmartParse } from '../useSmartParse';

jest.mock('@/lib/onDeviceAI', () => ({ currentEngine: jest.fn(), isOnDeviceAIReady: jest.fn() }));

beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(currentEngine).mockReturnValue('llama');
    jest.mocked(isOnDeviceAIReady).mockReturnValue(false);
});
afterEach(() => jest.useRealTimers());

it('does not run Llama while typing, but parses on an explicit tap', async () => {
    const parse = jest.fn(async () => ({ name: 'Run' }));
    const { result } = renderHook(() => useSmartParse('Run tomorrow', parse));
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(parse).not.toHaveBeenCalled();
    await act(async () => { await result.current.request?.(); });
    expect(parse).toHaveBeenCalledWith('Run tomorrow');
    expect(result.current.result).toEqual({ name: 'Run' });
});

it('does not apply an old manual answer after the user edits the text', async () => {
    let finish!: (value: string) => void;
    const parse = jest.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook<ReturnType<typeof useSmartParse<string>>, { text: string }>(
        ({ text }) => useSmartParse(text, parse), { initialProps: { text: 'Run' } });
    let pending!: Promise<void>;
    act(() => { pending = result.current.request!(); });
    act(() => { void result.current.request?.(); });
    expect(parse).toHaveBeenCalledTimes(1);
    rerender({ text: 'Swim' });
    await act(async () => { finish('Run'); await pending; });
    expect(result.current.result).toBeNull();
    expect(result.current.thinking).toBe(false);
});

it('keeps the existing preview and offers retry when the model cannot parse', async () => {
    const { result } = renderHook(() => useSmartParse('Run tomorrow', async () => null));
    await act(async () => { await result.current.request?.(); });
    expect(result.current.result).toBeNull();
    expect(result.current.failed).toBe(true);
    expect(result.current.request).toBeDefined();
});

it('retains automatic parsing for Apple Intelligence', async () => {
    jest.mocked(currentEngine).mockReturnValue('apple');
    jest.mocked(isOnDeviceAIReady).mockReturnValue(true);
    const parse = jest.fn(async () => 'Run');
    const { result } = renderHook(() => useSmartParse('Run tomorrow', parse));
    await act(async () => { await jest.advanceTimersByTimeAsync(650); });
    expect(result.current.result).toBe('Run');
    expect(result.current.request).toBeUndefined();
});

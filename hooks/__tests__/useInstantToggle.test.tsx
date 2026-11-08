import { act, renderHook } from '@testing-library/react-native';
import { useInstantToggle } from '../useInstantToggle';

jest.useFakeTimers();

describe('a tick that shows at once', () => {
    it('fills on the tap, before the page has done anything, then runs the toggle', () => {
        const toggle = jest.fn();
        const { result } = renderHook(({ done }: { done: boolean }) => useInstantToggle(done, toggle), { initialProps: { done: false } });
        act(() => { result.current[1](); });
        expect(result.current[0]).toBe(true);
        expect(toggle).not.toHaveBeenCalled();
        act(() => { jest.runOnlyPendingTimers(); jest.runOnlyPendingTimers(); });
        expect(toggle).toHaveBeenCalledTimes(1);
    });
    it('goes back to what the page says when the page never agrees (a refused tick)', () => {
        const { result } = renderHook(() => useInstantToggle(false, () => undefined));
        act(() => { result.current[1](); });
        expect(result.current[0]).toBe(true);
        act(() => { jest.advanceTimersByTime(2000); });
        expect(result.current[0]).toBe(false);
    });
    it('follows the page once it answers', () => {
        const { result, rerender } = renderHook(({ done }: { done: boolean }) => useInstantToggle(done, () => undefined), { initialProps: { done: false } });
        act(() => { result.current[1](); });
        rerender({ done: true });
        act(() => { jest.advanceTimersByTime(2000); });
        expect(result.current[0]).toBe(true);
    });
});

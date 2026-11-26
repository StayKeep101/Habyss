import { renderHook } from '@testing-library/react-native';
import { useLastPresent } from '../useLastPresent';

describe('useLastPresent', () => {
    it('keeps the last value once it is cleared, and takes a new one', () => {
        const { result, rerender } = renderHook(({ value }: { value: { id: string } | null }) => useLastPresent(value), { initialProps: { value: null as { id: string } | null } });
        expect(result.current).toBeNull();
        const first = { id: 'a' };
        rerender({ value: first });
        expect(result.current).toBe(first);
        rerender({ value: null });
        expect(result.current).toBe(first);
        const second = { id: 'b' };
        rerender({ value: second });
        expect(result.current).toBe(second);
    });
});

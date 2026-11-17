jest.mock('@/components/ui', () => ({}));
jest.mock('@/components/ui/MatteSurface', () => ({}));
jest.mock('@/hooks/useTokens', () => ({}));
import { countdown } from '@/components/Blocking/UnlockCountdown';

it('reads minutes and seconds, hours past one, never below zero', () => {
    expect(countdown(47 * 60_000 + 9_000)).toBe('47:09');
    expect(countdown(3_600_000)).toBe('1:00:00');
    expect(countdown(500)).toBe('0:01');
    expect(countdown(-5)).toBe('0:00');
});

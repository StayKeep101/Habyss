import { hexToHsv, hsvToHex, normalizeHex } from '../colorMath';
import { findUnits } from '../units';

it.each(['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#123456', '#6B8AF5'])('preserves exact color %s through the wheel', color => {
    const { h, s, v } = hexToHsv(color);
    expect(hsvToHex(h, s, v)).toBe(color);
});
it('normalizes hex input and rejects invalid colors', () => {
    expect(normalizeHex(' abc ')).toBe('#AABBCC');
    expect(normalizeHex('#123456')).toBe('#123456');
    expect(normalizeHex('#12ZZ56')).toBeNull();
    expect(normalizeHex('12')).toBeNull();
});
it('finds familiar unit aliases across categories', () => {
    expect(findUnits('dollar', 'Distance').map(unit => unit.label)).toEqual(['USD']);
    expect(findUnits('kilometres', 'All').map(unit => unit.id)).toEqual(['km']);
    expect(findUnits('', 'Money').map(unit => unit.label)).toEqual(['USD', 'EUR', 'GBP']);
});

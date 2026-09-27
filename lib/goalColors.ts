export function hsvToHex(h: number, s: number, v: number): string {
    'worklet';
    const hue = ((h % 360) + 360) % 360 / 60;
    const c = v * s, x = c * (1 - Math.abs(hue % 2 - 1)), m = v - c;
    const rgb = hue < 1 ? [c, x, 0] : hue < 2 ? [x, c, 0] : hue < 3 ? [0, c, x]
        : hue < 4 ? [0, x, c] : hue < 5 ? [x, 0, c] : [c, 0, x];
    return '#' + rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function hexToHsv(hex: string) {
    const [r, g, b] = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = delta === 0 ? 0 : max === r ? 60 * ((g - b) / delta % 6)
        : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;
    return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function normalizeHex(value: string): string | null {
    const bare = value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(bare)) return '#' + bare.split('').map(char => char + char).join('').toUpperCase();
    return /^[0-9a-f]{6}$/i.test(bare) ? '#' + bare.toUpperCase() : null;
}

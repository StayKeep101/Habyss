/** Color helpers for the hex-based accent presets. */
function channels(hex: string): number[] {
    const value = hex.replace('#', '');
    const expanded = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    return [0, 2, 4].map(index => parseInt(expanded.slice(index, index + 2), 16));
}

export function contrastRatio(a: string, b: string): number {
    const luminance = (hex: string) => channels(hex).map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    const [first, second] = [luminance(a), luminance(b)];
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function readableAccent(accent: string, background: string, minimum = 4.5): string {
    if (contrastRatio(accent, background) >= minimum) return accent;
    const target = contrastRatio('#ffffff', background) > contrastRatio('#000000', background) ? 255 : 0;
    const original = channels(accent);
    for (let step = 1; step <= 100; step++) {
        const adjusted = '#' + original.map(channel => Math.round(channel + (target - channel) * step / 100).toString(16).padStart(2, '0')).join('');
        if (contrastRatio(adjusted, background) >= minimum) return adjusted;
    }
    return target === 255 ? '#ffffff' : '#000000';
}

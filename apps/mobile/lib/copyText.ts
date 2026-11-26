import { Share } from 'react-native';

/**
 * Puts text on the clipboard. Builds without the clipboard module fall back
 * to the share sheet, whose first row is Copy. True when it was copied.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
        if (requireOptionalNativeModule('ExpoClipboard')) {
            const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
            await Clipboard.setStringAsync(text);
            return true;
        }
    } catch { /* fall through to the share sheet */ }
    await Share.share({ message: text }).catch(() => undefined);
    return false;
}

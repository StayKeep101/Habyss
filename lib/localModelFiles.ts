import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const isFilename = (value: unknown): value is string =>
    typeof value === 'string' && /^[\w.-]+$/.test(value) && value !== '.' && value !== '..';

/**
 * MLC's iOS prepare() checks only that the directory exists. Missing weights
 * then abort its C++ worker, outside the reach of a JavaScript try/catch.
 * Inspect the downloaded manifests and every required file before calling it.
 * Android's MLC storage is separate from Expo's document directory.
 */
export async function hasCompleteIOSModelFiles(modelId: string): Promise<boolean> {
    if (Platform.OS !== 'ios') return true;
    if (!FileSystem.documentDirectory || !isFilename(modelId)) return false;

    try {
        const directory = `${FileSystem.documentDirectory}bundle/${modelId}/`;
        const [configText, manifestText] = await Promise.all([
            FileSystem.readAsStringAsync(`${directory}mlc-chat-config.json`),
            FileSystem.readAsStringAsync(`${directory}ndarray-cache.json`),
        ]);
        const config = JSON.parse(configText);
        const manifest = JSON.parse(manifestText);
        if (!Array.isArray(manifest?.records) || !manifest.records.length ||
            !Array.isArray(config?.tokenizer_files) || !config.tokenizer_files.length) return false;

        for (const record of manifest.records) {
            if (!isFilename(record?.dataPath) || !Number.isSafeInteger(record.nbytes) || record.nbytes <= 0) return false;
            const file = await FileSystem.getInfoAsync(`${directory}${record.dataPath}`);
            if (!file.exists || file.isDirectory || file.size !== record.nbytes) return false;
        }
        for (const filename of config.tokenizer_files) {
            if (!isFilename(filename)) return false;
            const file = await FileSystem.getInfoAsync(`${directory}${filename}`);
            if (!file.exists || file.isDirectory || file.size <= 0) return false;
            // Tokenizer JSON may also be truncated by a failed download.
            if (filename.endsWith('.json')) JSON.parse(await FileSystem.readAsStringAsync(`${directory}${filename}`));
        }
        return true;
    } catch {
        // Missing files, unreadable JSON or an unavailable filesystem all mean
        // the model is unsafe to load. Echo's built-in responses remain usable.
        return false;
    }
}

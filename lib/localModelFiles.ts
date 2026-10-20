import * as FileSystem from 'expo-file-system/legacy';
import { LOCAL_MODEL, modelUri } from './localModelDownload';

/**
 * Whether the whole model file is on this phone. Loading a truncated GGUF can
 * crash llama.cpp outside the reach of a JavaScript try/catch, so it is only
 * loaded when its size is exactly the pinned one.
 */
export async function hasCompleteModelFile(): Promise<boolean> {
    const uri = modelUri();
    if (!uri) return false;
    try {
        const info = await FileSystem.getInfoAsync(uri);
        return info.exists && !info.isDirectory && info.size === LOCAL_MODEL.bytes;
    } catch {
        return false;
    }
}

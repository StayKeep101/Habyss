import * as FileSystem from 'expo-file-system/legacy';

// Gemma 3n E2B, instruction-tuned, 4-bit (Q4_K_M) GGUF, run by llama.cpp
// (llama.rn). Pinned to one upstream revision and its exact size, so a retry
// can never mix files and a truncated download is never loaded.
export const LOCAL_MODEL = {
    id: 'gemma-3n-E2B-it',
    name: 'Gemma 3n E2B',
    file: 'gemma-3n-E2B-it-Q4_K_M.gguf',
    source: 'https://huggingface.co/unsloth/gemma-3n-E2B-it-GGUF',
    revision: 'd7bd20d510eff26f3f95260c50f032fee8931a35',
    bytes: 3_026_881_888,
    sizeLabel: 'about 3 GB',
};

/** The Llama 3.2 files earlier builds downloaded; removed to give the space back. */
export const OLD_MODEL_DIRECTORY = 'bundle/Llama-3.2-1B-Instruct/';

export type ModelTransferProgress = {
    downloadedBytes: number;
    totalBytes: number | null;
    percentage: number;
};

export class ModelDownloadCancelled extends Error {}

/** Where the model file lives, as a file:// URI. */
export const modelDirectory = (): string | null => FileSystem.documentDirectory ? `${FileSystem.documentDirectory}llama-models/` : null;
export const modelUri = (): string | null => { const directory = modelDirectory(); return directory ? directory + LOCAL_MODEL.file : null; };

/**
 * One 3 GB file, streamed to disk with byte progress. It downloads to a
 * temporary name and only gets its real name once its size is exactly right,
 * so a half-finished file is never mistaken for the model.
 */
export async function downloadIOSModel(
    signal: AbortSignal,
    onProgress: (progress: ModelTransferProgress) => void,
): Promise<void> {
    const directory = modelDirectory();
    const target = modelUri();
    if (!directory || !target) throw new Error('Model storage is unavailable on this device.');
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const total = LOCAL_MODEL.bytes;
    const report = (bytes: number) => onProgress({ downloadedBytes: bytes, totalBytes: total, percentage: Math.min(100, (bytes / total) * 100) });
    const checkCancelled = () => { if (signal.aborted) throw new ModelDownloadCancelled(); };

    const existing = await FileSystem.getInfoAsync(target).catch(() => null);
    if (existing?.exists && !existing.isDirectory && existing.size === total) { report(total); return; }

    const freeBytes = await FileSystem.getFreeDiskStorageAsync().catch(() => null);
    if (freeBytes !== null && freeBytes < total + 200_000_000) {
        throw new Error(`Free at least ${Math.ceil((total + 200_000_000) / 1_000_000_000 * 10) / 10} GB on your phone, then retry.`);
    }

    const temporary = target + '.download';
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastBytes = 0;
    let interrupt!: (reason: Error) => void;
    const interrupted = new Promise<never>((_, reject) => { interrupt = reject; });
    const armTimeout = () => {
        clearTimeout(timer);
        timer = setTimeout(() => interrupt(new Error('No download progress for a minute. Check your connection and retry.')), 60_000);
    };
    const task = FileSystem.createDownloadResumable(
        `${LOCAL_MODEL.source}/resolve/${LOCAL_MODEL.revision}/${LOCAL_MODEL.file}`,
        temporary,
        { sessionType: FileSystem.FileSystemSessionType.FOREGROUND },
        event => {
            if (event.totalBytesWritten > lastBytes) { lastBytes = event.totalBytesWritten; armTimeout(); }
            report(Math.min(lastBytes, total));
        },
    );
    const cancel = () => interrupt(new ModelDownloadCancelled());
    signal.addEventListener('abort', cancel);
    try {
        checkCancelled();
        report(0);
        armTimeout();
        const result = await Promise.race([task.downloadAsync(), interrupted]);
        checkCancelled();
        if (!result || result.status !== 200) {
            throw new Error(`Hugging Face could not send the model${result ? ` (HTTP ${result.status})` : ''}. Try again on Wi-Fi.`);
        }
        const info = await FileSystem.getInfoAsync(temporary);
        if (!info.exists || info.isDirectory || info.size !== total) throw new Error('The download was incomplete. Retry to download it again.');
        await FileSystem.deleteAsync(target, { idempotent: true });
        await FileSystem.moveAsync({ from: temporary, to: target });
        report(total);
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        await task.cancelAsync().catch(() => undefined);
        await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
    }
}

/** Gives back the space of the Llama files earlier builds used, if they are still there. */
export async function removeOldModel(): Promise<void> {
    if (!FileSystem.documentDirectory) return;
    await FileSystem.deleteAsync(FileSystem.documentDirectory + OLD_MODEL_DIRECTORY, { idempotent: true }).catch(() => undefined);
}

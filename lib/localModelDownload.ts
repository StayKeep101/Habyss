import * as FileSystem from 'expo-file-system/legacy';

// Matches the model library shipped by @react-native-ai/mlc 0.12.0. Pin the
// weights so retrying cannot mix files from different upstream revisions.
export const LOCAL_MODEL = {
    id: 'Llama-3.2-1B-Instruct',
    source: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC',
    revision: '2a37b0a5ecb622d51ddc2fac74de0b95872affd7',
    sizeLabel: 'about 715 MB',
};

export type ModelTransferProgress = {
    downloadedBytes: number;
    totalBytes: number | null;
    percentage: number;
};

export class ModelDownloadCancelled extends Error {}

const validName = (name: unknown): name is string =>
    typeof name === 'string' && /^[\w.-]+$/.test(name) && name !== '.' && name !== '..';

/**
 * Stream to disk, reporting bytes during each shard (the first is 131 MB).
 * Completed files survive retries. A partial file never gets a final name.
 * MLC's own iOS downloader buffers whole shards and reports only file counts.
 */
export async function downloadIOSModel(
    signal: AbortSignal,
    onProgress: (progress: ModelTransferProgress) => void,
): Promise<void> {
    if (!FileSystem.documentDirectory) throw new Error('Model storage is unavailable on this device.');
    const directory = `${FileSystem.documentDirectory}bundle/${LOCAL_MODEL.id}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    let completedBytes = 0;
    let totalBytes: number | null = null;
    const checkCancelled = () => { if (signal.aborted) throw new ModelDownloadCancelled(); };
    const report = (currentBytes = 0) => onProgress({
        downloadedBytes: completedBytes + currentBytes,
        totalBytes,
        percentage: totalBytes ? Math.min(100, (completedBytes + currentBytes) / totalBytes * 100) : 0,
    });

    async function validFile(filename: string, expectedSize?: number): Promise<number | null> {
        try {
            const info = await FileSystem.getInfoAsync(directory + filename);
            if (!info.exists || info.isDirectory || info.size <= 0 ||
                (expectedSize !== undefined && info.size !== expectedSize)) return null;
            if (filename.endsWith('.json')) JSON.parse(await FileSystem.readAsStringAsync(directory + filename));
            return info.size;
        } catch { return null; }
    }

    async function download(filename: string, expectedSize?: number): Promise<void> {
        checkCancelled();
        const existingSize = await validFile(filename, expectedSize);
        if (existingSize !== null) { completedBytes += existingSize; report(); return; }
        const temporary = directory + filename + '.download';
        let timer: ReturnType<typeof setTimeout> | undefined;
        let lastBytes = 0;
        let interrupt!: (reason: Error) => void;
        const interrupted = new Promise<never>((_, reject) => { interrupt = reject; });
        const armTimeout = () => {
            clearTimeout(timer);
            timer = setTimeout(() => interrupt(new Error('No download progress for a minute. Check your connection and retry; completed files are kept.')), 60_000);
        };
        const task = FileSystem.createDownloadResumable(
            `${LOCAL_MODEL.source}/resolve/${LOCAL_MODEL.revision}/${filename}`,
            temporary,
            { sessionType: FileSystem.FileSystemSessionType.FOREGROUND },
            event => {
                if (event.totalBytesWritten > lastBytes) { lastBytes = event.totalBytesWritten; armTimeout(); }
                report(expectedSize === undefined ? lastBytes : Math.min(lastBytes, expectedSize));
            },
        );
        const cancel = () => interrupt(new ModelDownloadCancelled());
        signal.addEventListener('abort', cancel);
        try {
            checkCancelled();
            armTimeout();
            const result = await Promise.race([task.downloadAsync(), interrupted]);
            checkCancelled();
            if (!result || result.status !== 200) {
                throw new Error(`Hugging Face could not send the model${result ? ` (HTTP ${result.status})` : ''}. Try again on Wi-Fi.`);
            }
            const info = await FileSystem.getInfoAsync(temporary);
            if (!info.exists || info.isDirectory || info.size <= 0 ||
                (expectedSize !== undefined && info.size !== expectedSize)) {
                throw new Error('A model file was incomplete. Retry to download that file again.');
            }
            if (filename.endsWith('.json')) JSON.parse(await FileSystem.readAsStringAsync(temporary));
            await FileSystem.deleteAsync(directory + filename, { idempotent: true });
            await FileSystem.moveAsync({ from: temporary, to: directory + filename });
            completedBytes += info.size;
            report();
        } finally {
            clearTimeout(timer);
            signal.removeEventListener('abort', cancel);
            // Also removes Expo's progress subscription after a completed task.
            await task.cancelAsync().catch(() => undefined);
            await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
        }
    }

    report();
    await download('mlc-chat-config.json');
    await download('ndarray-cache.json');
    const config = JSON.parse(await FileSystem.readAsStringAsync(directory + 'mlc-chat-config.json'));
    const manifest = JSON.parse(await FileSystem.readAsStringAsync(directory + 'ndarray-cache.json'));
    const records: { dataPath: string; nbytes: number }[] = manifest?.records;
    const tokenizers: string[] = config?.tokenizer_files;
    if (!Array.isArray(records) || !records.length ||
        records.some(r => !validName(r?.dataPath) || !Number.isSafeInteger(r.nbytes) || r.nbytes <= 0 || !r.dataPath.endsWith('.bin')) ||
        !Array.isArray(tokenizers) || !tokenizers.length || tokenizers.some(name => !validName(name) || !name.endsWith('.json')) ||
        new Set(records.map(r => r.dataPath)).size !== records.length) {
        await Promise.all(['mlc-chat-config.json', 'ndarray-cache.json'].map(name =>
            FileSystem.deleteAsync(directory + name, { idempotent: true })));
        throw new Error('The model file list was invalid. Retry to fetch a fresh copy.');
    }
    // Small JSON files first. Once their sizes are known, progress has an exact
    // byte total instead of guessing from the model's estimated RAM usage.
    for (const filename of tokenizers) await download(filename);
    totalBytes = completedBytes + records.reduce((sum, record) => sum + record.nbytes, 0);
    let remaining = 0;
    for (const record of records) {
        if (await validFile(record.dataPath, record.nbytes) === null) remaining += record.nbytes;
    }
    const freeBytes = await FileSystem.getFreeDiskStorageAsync().catch(() => null);
    if (freeBytes !== null && freeBytes < remaining + 32_000_000) {
        throw new Error(`Free at least ${Math.ceil((remaining + 32_000_000) / 1_000_000)} MB on your phone, then retry.`);
    }
    report();
    for (const record of records) await download(record.dataPath, record.nbytes);
    checkCancelled();
}

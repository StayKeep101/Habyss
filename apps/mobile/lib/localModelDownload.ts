import * as FileSystem from 'expo-file-system/legacy';

// Echo's offline model, run on the phone by llama.cpp (llama.rn). Each is
// pinned to one upstream revision and its exact size, so a retry can never mix
// files and a truncated download is never loaded.

/** Qwen3.5 0.8B (Apache-2.0), Unsloth's dynamic 4-bit: small, quick, and more varied in how it says things. */
export const QWEN_MODEL = {
    id: 'qwen3.5-0.8b',
    name: 'Qwen3.5 0.8B',
    file: 'Qwen3.5-0.8B-UD-Q4_K_XL.gguf',
    source: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF',
    revision: '6ab461498e2023f6e3c1baea90a8f0fe38ab64d0',
    bytes: 558_772_480,
    sizeLabel: 'about 560 MB',
};

/** Gemma 3n E2B, 4-bit: what builds before runtime 1.0.4 run (their llama.cpp cannot load Qwen3.5). */
export const GEMMA_MODEL = {
    id: 'gemma-3n-E2B-it',
    name: 'Gemma 3n E2B',
    file: 'gemma-3n-E2B-it-Q4_K_M.gguf',
    source: 'https://huggingface.co/unsloth/gemma-3n-E2B-it-GGUF',
    revision: 'd7bd20d510eff26f3f95260c50f032fee8931a35',
    bytes: 3_026_881_888,
    sizeLabel: 'about 3 GB',
};

/**
 * Qwen3.5 needs llama.rn 0.12 (its llama.cpp knows the qwen35 architecture),
 * which ships with runtime 1.0.4. An update reaching an older build keeps it
 * on Gemma rather than downloading a model it cannot open. A development build
 * (no runtime version) is built from this code, so it runs Qwen.
 */
export function runsQwen(runtime: string | null | undefined): boolean {
    if (!runtime) return true;
    const [major = 0, minor = 0, patch = 0] = runtime.split('.').map(part => Number.parseInt(part, 10) || 0);
    return major > 1 || (major === 1 && (minor > 0 || patch >= 4));
}

const installedRuntime = (): string | null => {
    try { return (require('expo-updates') as typeof import('expo-updates')).runtimeVersion ?? null; } catch { return null; }
};

export const LOCAL_MODEL = runsQwen(installedRuntime()) ? QWEN_MODEL : GEMMA_MODEL;

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
 * One model file, streamed to disk with byte progress. It downloads to a
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
    // On Qwen now: the 3 GB Gemma file is given back too.
    const directory = modelDirectory();
    if (directory && LOCAL_MODEL.id !== GEMMA_MODEL.id) {
        await FileSystem.deleteAsync(directory + GEMMA_MODEL.file, { idempotent: true }).catch(() => undefined);
        await FileSystem.deleteAsync(directory + GEMMA_MODEL.file + '.download', { idempotent: true }).catch(() => undefined);
    }
}

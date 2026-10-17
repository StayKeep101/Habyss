import * as FileSystem from 'expo-file-system/legacy';
import { downloadIOSModel, LOCAL_MODEL, ModelDownloadCancelled } from '../localModelDownload';

jest.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///documents/',
    FileSystemSessionType: { FOREGROUND: 1 },
    makeDirectoryAsync: jest.fn(), getInfoAsync: jest.fn(), readAsStringAsync: jest.fn(),
    createDownloadResumable: jest.fn(), deleteAsync: jest.fn(), moveAsync: jest.fn(),
    getFreeDiskStorageAsync: jest.fn(),
}));

const directory = `file:///documents/bundle/${LOCAL_MODEL.id}/`;
type File = { size: number; text?: string };
let files: Record<string, File>;
let remote: Record<string, File>;
let transfer: (filename: string, uri: string, progress: any) => Promise<any>;
const cancel = jest.fn(async () => undefined);
const json = (value: unknown): File => { const text = JSON.stringify(value); return { text, size: text.length }; };

beforeEach(() => {
    jest.clearAllMocks();
    remote = {
        'mlc-chat-config.json': json({ tokenizer_files: ['tokenizer.json'] }),
        'ndarray-cache.json': json({ records: [
            { dataPath: 'params_shard_0.bin', nbytes: 1000 },
            { dataPath: 'params_shard_1.bin', nbytes: 2000 },
        ] }),
        'tokenizer.json': json({ vocab: {} }),
        'params_shard_0.bin': { size: 1000 }, 'params_shard_1.bin': { size: 2000 },
    };
    // Existing config/tokenizers are reused, just like an interrupted install.
    files = Object.fromEntries(Object.entries(remote).filter(([name]) => name.endsWith('.json'))
        .map(([name, value]) => [directory + name, value]));
    jest.mocked(FileSystem.getInfoAsync).mockImplementation(async uri => files[uri]
        ? { exists: true, isDirectory: false, size: files[uri].size, uri, modificationTime: 0 }
        : { exists: false, isDirectory: false, uri });
    jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async uri => {
        if (!files[uri]?.text) throw new Error('Missing JSON');
        return files[uri].text!;
    });
    jest.mocked(FileSystem.deleteAsync).mockImplementation(async uri => { delete files[uri]; });
    jest.mocked(FileSystem.moveAsync).mockImplementation(async ({ from, to }) => { files[to] = files[from]; delete files[from]; });
    jest.mocked(FileSystem.getFreeDiskStorageAsync).mockResolvedValue(2_000_000_000);
    transfer = async (filename, uri, progress) => {
        const file = remote[filename];
        progress({ totalBytesWritten: file.size / 2, totalBytesExpectedToWrite: file.size });
        files[uri] = file;
        progress({ totalBytesWritten: file.size, totalBytesExpectedToWrite: file.size });
        return { uri, status: 200 };
    };
    jest.mocked(FileSystem.createDownloadResumable).mockImplementation((url, uri, _options, callback) => ({
        downloadAsync: () => transfer(url.split('/').pop()!, uri, callback), cancelAsync: cancel,
    } as any));
});

afterEach(() => jest.useRealTimers());

it('reports bytes before the first large shard has finished and pins the source', async () => {
    const progress = jest.fn(state => {
        if (state.downloadedBytes >= 500 && state.percentage < 100) {
            expect(state.totalBytes).toBeGreaterThan(3000);
        }
    });
    await downloadIOSModel(new AbortController().signal, progress);
    expect(progress.mock.calls.some(([p]) => p.percentage > 0 && p.percentage < 40)).toBe(true);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ percentage: 100 }));
    expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
        `${LOCAL_MODEL.source}/resolve/${LOCAL_MODEL.revision}/params_shard_0.bin`,
        directory + 'params_shard_0.bin.download', expect.anything(), expect.any(Function),
    );
});

it('keeps completed shards and replaces a truncated shard on retry', async () => {
    files[directory + 'params_shard_0.bin'] = { size: 1000 };
    files[directory + 'params_shard_1.bin'] = { size: 50 };
    await downloadIOSModel(new AbortController().signal, jest.fn());
    expect(FileSystem.createDownloadResumable).toHaveBeenCalledTimes(1);
    expect(files[directory + 'params_shard_1.bin'].size).toBe(2000);
    expect(Object.keys(files).some(name => name.endsWith('.download'))).toBe(false);
});

it('does not promote an HTTP error or a partial response to a model weight', async () => {
    transfer = async (_name, uri) => { files[uri] = { size: 20 }; return { status: 403 }; };
    await expect(downloadIOSModel(new AbortController().signal, jest.fn())).rejects.toThrow('HTTP 403');
    expect(files[directory + 'params_shard_0.bin']).toBeUndefined();
    expect(files[directory + 'params_shard_0.bin.download']).toBeUndefined();
    transfer = async (_name, uri) => { files[uri] = { size: 20 }; return { status: 200 }; };
    await expect(downloadIOSModel(new AbortController().signal, jest.fn())).rejects.toThrow('incomplete');
});

it('cancels an in-flight native transfer and preserves already completed files', async () => {
    const controller = new AbortController();
    files[directory + 'params_shard_0.bin'] = { size: 1000 };
    transfer = async () => { controller.abort(); return new Promise(() => undefined); };
    await expect(downloadIOSModel(controller.signal, jest.fn())).rejects.toBeInstanceOf(ModelDownloadCancelled);
    expect(cancel).toHaveBeenCalled();
    expect(files[directory + 'params_shard_0.bin'].size).toBe(1000);
});

it('times out a transfer with no progress instead of waiting forever', async () => {
    jest.useFakeTimers();
    let started!: () => void;
    const start = new Promise<void>(resolve => { started = resolve; });
    transfer = async () => { started(); return new Promise(() => undefined); };
    const expectation = expect(downloadIOSModel(new AbortController().signal, jest.fn())).rejects.toThrow('No download progress');
    await start;
    await jest.advanceTimersByTimeAsync(60_000);
    await expectation;
    expect(cancel).toHaveBeenCalled();
});

it('fails before fetching large shards when storage is insufficient', async () => {
    jest.mocked(FileSystem.getFreeDiskStorageAsync).mockResolvedValue(100);
    await expect(downloadIOSModel(new AbortController().signal, jest.fn())).rejects.toThrow('Free at least');
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
});

it('rejects unsafe paths and clears invalid metadata so a retry can recover', async () => {
    files[directory + 'ndarray-cache.json'] = json({ records: [{ dataPath: '../outside.bin', nbytes: 1 }] });
    await expect(downloadIOSModel(new AbortController().signal, jest.fn())).rejects.toThrow('file list was invalid');
    expect(files[directory + 'ndarray-cache.json']).toBeUndefined();
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
});

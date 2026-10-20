import * as FileSystem from 'expo-file-system/legacy';
import { downloadIOSModel, LOCAL_MODEL, ModelDownloadCancelled } from '../localModelDownload';

jest.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///documents/',
    FileSystemSessionType: { FOREGROUND: 1 },
    makeDirectoryAsync: jest.fn(), getInfoAsync: jest.fn(),
    createDownloadResumable: jest.fn(), deleteAsync: jest.fn(), moveAsync: jest.fn(),
    getFreeDiskStorageAsync: jest.fn(),
}));

const target = `file:///documents/llama-models/${LOCAL_MODEL.file}`;
let files: Record<string, number>;
let transfer: (uri: string, progress: any) => Promise<any>;
const cancel = jest.fn(async () => undefined);

beforeEach(() => {
    jest.clearAllMocks();
    files = {};
    jest.mocked(FileSystem.getInfoAsync).mockImplementation(async uri => files[uri] !== undefined
        ? { exists: true, isDirectory: false, size: files[uri], uri, modificationTime: 0 }
        : { exists: false, isDirectory: false, uri });
    jest.mocked(FileSystem.deleteAsync).mockImplementation(async uri => { delete files[uri]; });
    jest.mocked(FileSystem.moveAsync).mockImplementation(async ({ from, to }) => { files[to] = files[from]; delete files[from]; });
    jest.mocked(FileSystem.getFreeDiskStorageAsync).mockResolvedValue(10_000_000_000);
    transfer = async (uri, progress) => {
        progress({ totalBytesWritten: LOCAL_MODEL.bytes / 2 });
        files[uri] = LOCAL_MODEL.bytes;
        progress({ totalBytesWritten: LOCAL_MODEL.bytes });
        return { uri, status: 200 };
    };
    jest.mocked(FileSystem.createDownloadResumable).mockImplementation((_url, uri, _options, callback) => ({
        downloadAsync: () => transfer(uri, callback), cancelAsync: cancel,
    } as any));
});
afterEach(() => jest.useRealTimers());

it('downloads the pinned Gemma file with byte progress, and names it only once complete', async () => {
    const progress = jest.fn();
    await downloadIOSModel(new AbortController().signal, progress);
    expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
        `${LOCAL_MODEL.source}/resolve/${LOCAL_MODEL.revision}/${LOCAL_MODEL.file}`, `${target}.download`, expect.anything(), expect.any(Function));
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ percentage: 50, totalBytes: LOCAL_MODEL.bytes }));
    expect(files[target]).toBe(LOCAL_MODEL.bytes);
    expect(files[`${target}.download`]).toBeUndefined();
});

it('skips the transfer when the whole file is already there', async () => {
    files[target] = LOCAL_MODEL.bytes;
    await downloadIOSModel(new AbortController().signal, jest.fn());
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
});

it('never keeps a partial file or an HTTP error as the model', async () => {
    transfer = async uri => { files[uri] = 1000; return { uri, status: 200 }; };
    await expect(downloadIOSModel(new AbortController().signal, jest.fn())).rejects.toThrow('incomplete');
    expect(files[target]).toBeUndefined();
    transfer = async uri => ({ uri, status: 404 });
    await expect(downloadIOSModel(new AbortController().signal, jest.fn())).rejects.toThrow('HTTP 404');
    expect(files[target]).toBeUndefined();
});

it('asks for space first when the phone is too full', async () => {
    jest.mocked(FileSystem.getFreeDiskStorageAsync).mockResolvedValue(1_000_000_000);
    await expect(downloadIOSModel(new AbortController().signal, jest.fn())).rejects.toThrow(/Free at least 3\.\d GB/);
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
});

it('stops when cancelled, and when there is no progress for a minute', async () => {
    const controller = new AbortController();
    transfer = () => new Promise(() => undefined);
    const cancelled = downloadIOSModel(controller.signal, jest.fn());
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    controller.abort();
    await expect(cancelled).rejects.toBeInstanceOf(ModelDownloadCancelled);
    expect(cancel).toHaveBeenCalled();

    jest.useFakeTimers();
    const stalled = downloadIOSModel(new AbortController().signal, jest.fn());
    const check = expect(stalled).rejects.toThrow('No download progress');
    await jest.advanceTimersByTimeAsync(61_000);
    await check;
});

import * as FileSystem from 'expo-file-system/legacy';
import { hasCompleteIOSModelFiles } from '../localModelFiles';

jest.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///documents/',
    readAsStringAsync: jest.fn(),
    getInfoAsync: jest.fn(),
}));

const directory = 'file:///documents/bundle/Llama-3.2-1B-Instruct/';
const complete = () => hasCompleteIOSModelFiles('Llama-3.2-1B-Instruct');
let files: Record<string, { size: number; text?: string }>;

beforeEach(() => {
    jest.clearAllMocks();
    files = {
        'mlc-chat-config.json': { size: 100, text: JSON.stringify({ tokenizer_files: ['tokenizer.json'] }) },
        'ndarray-cache.json': { size: 100, text: JSON.stringify({ records: [
            { dataPath: 'params_shard_0.bin', nbytes: 1000 },
            { dataPath: 'params_shard_1.bin', nbytes: 2000 },
        ] }) },
        'params_shard_0.bin': { size: 1000 },
        'params_shard_1.bin': { size: 2000 },
        'tokenizer.json': { size: 20, text: '{"vocab": {}}' },
    };
    (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (uri: string) => {
        const file = files[uri.replace(directory, '')];
        if (!file) throw new Error('File not found');
        return file.text;
    });
    (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        const file = files[uri.replace(directory, '')];
        return file ? { exists: true, isDirectory: false, size: file.size } : { exists: false };
    });
});

it('accepts all weights and tokenizer files with the expected sizes', async () => {
    expect(await complete()).toBe(true);
});

it('rejects the configuration-only folder found on the crashing iPhone', async () => {
    delete files['params_shard_0.bin'];
    delete files['params_shard_1.bin'];
    delete files['tokenizer.json'];
    expect(await complete()).toBe(false);
});

it.each(['mlc-chat-config.json', 'ndarray-cache.json', 'params_shard_1.bin', 'tokenizer.json'])(
    'rejects a missing %s', async filename => {
        delete files[filename];
        expect(await complete()).toBe(false);
    },
);

it('rejects truncated weights', async () => {
    files['params_shard_1.bin'].size = 1999;
    expect(await complete()).toBe(false);
});

it.each(['mlc-chat-config.json', 'ndarray-cache.json', 'tokenizer.json'])(
    'rejects invalid JSON in %s', async filename => {
        files[filename].text = '{';
        expect(await complete()).toBe(false);
    },
);

it.each([
    { records: [] },
    { records: [{ dataPath: '../outside.bin', nbytes: 1000 }] },
    { records: [{ dataPath: 'params_shard_0.bin' }] },
])('rejects an invalid manifest: %j', async manifest => {
    files['ndarray-cache.json'].text = JSON.stringify(manifest);
    expect(await complete()).toBe(false);
});

it('fails closed when the filesystem is unavailable', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('Native module unavailable'));
    expect(await complete()).toBe(false);
});

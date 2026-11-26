import * as FileSystem from 'expo-file-system/legacy';
import { hasCompleteModelFile } from '../localModelFiles';
import { LOCAL_MODEL } from '../localModelDownload';

jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', getInfoAsync: jest.fn() }));

describe('the offline model file', () => {
    it('counts only when its size is exactly the pinned one', async () => {
        const info = FileSystem.getInfoAsync as jest.Mock;
        info.mockResolvedValue({ exists: true, isDirectory: false, size: LOCAL_MODEL.bytes });
        expect(await hasCompleteModelFile()).toBe(true);
        expect(info).toHaveBeenCalledWith('file:///documents/llama-models/gemma-3n-E2B-it-Q4_K_M.gguf');
        info.mockResolvedValue({ exists: true, isDirectory: false, size: LOCAL_MODEL.bytes - 1 });
        expect(await hasCompleteModelFile()).toBe(false);
        info.mockResolvedValue({ exists: false });
        expect(await hasCompleteModelFile()).toBe(false);
        info.mockRejectedValue(new Error('unavailable'));
        expect(await hasCompleteModelFile()).toBe(false);
    });
});

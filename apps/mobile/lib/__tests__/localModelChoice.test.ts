import { GEMMA_MODEL, QWEN_MODEL, runsQwen } from '../localModelDownload';

jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/' }));

describe("Echo's offline model", () => {
    it('is Qwen3.5 0.8B from runtime 1.0.4 (llama.rn 0.12 knows its architecture)', () => {
        expect(QWEN_MODEL).toMatchObject({ file: 'Qwen3.5-0.8B-UD-Q4_K_XL.gguf', bytes: 558_772_480, revision: '6ab461498e2023f6e3c1baea90a8f0fe38ab64d0' });
        for (const runtime of ['1.0.4', '1.0.10', '1.1.0', '2.0.0', null, undefined]) expect(runsQwen(runtime)).toBe(true);
    });
    it('stays Gemma on older builds, so an update never downloads a model their llama.cpp cannot open', () => {
        for (const runtime of ['1.0.2', '1.0.3', '1.0.0', '0.9.9']) expect(runsQwen(runtime)).toBe(false);
        expect(GEMMA_MODEL.file).toBe('gemma-3n-E2B-it-Q4_K_M.gguf');
    });
});

import { createMcpKey, listMcpKeys, mcpUrl } from '../mcpKeys';

jest.mock('../supabase', () => ({ getSupabase: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));

describe('keys for AI assistants', () => {
    it('gives the address with the key in it, for apps that only take a URL', () => {
        process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        expect(mcpUrl('hby_abc')).toBe('https://example.supabase.co/functions/v1/mcp/hby_abc');
    });
    it('needs an account', async () => {
        await expect(createMcpKey('Claude')).rejects.toThrow('Sign in to Habyss first');
        expect(await listMcpKeys()).toEqual([]);
    });
});

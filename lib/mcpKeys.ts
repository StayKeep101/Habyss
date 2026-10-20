import { getSupabase } from './supabase';

/**
 * Keys for AI assistants (MCP). Each one lets an assistant — Claude, ChatGPT,
 * any MCP client — read today's plan and add or tick tasks and habits, through
 * the `mcp` edge function. A key is shown once, when made; the server keeps
 * only its hash. Needs a Habyss account, since the assistant reads the cloud copy.
 */
export interface McpKey { id: string; label: string; createdAt: string; lastUsedAt: string | null }

/** The address an assistant connects to, with the key in it (for clients that only take a URL). */
export function mcpUrl(key: string): string {
    return `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/mcp/${key}`;
}

async function signedIn() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session ? sb : null;
}

export async function mcpAvailable(): Promise<boolean> {
    return !!(await signedIn());
}

export async function listMcpKeys(): Promise<McpKey[]> {
    const sb = await signedIn();
    if (!sb) return [];
    const { data, error } = await sb.from('mcp_keys').select('id, label, created_at, last_used_at').is('revoked_at', null).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(row => ({ id: row.id, label: row.label, createdAt: row.created_at, lastUsedAt: row.last_used_at }));
}

/** Makes a key and returns it: the only time it can be seen. */
export async function createMcpKey(label: string): Promise<string> {
    const sb = await signedIn();
    if (!sb) throw new Error('Sign in to Habyss first, so an assistant can reach your habits and tasks.');
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const { data, error } = await sb.rpc('create_mcp_key', { p_label: label, p_time_zone: timeZone });
    if (error || typeof data !== 'string') throw new Error(error?.message.includes('too many') ? 'You have 10 keys already. Remove one first.' : 'Could not make a key. Try again.');
    return data;
}

export async function revokeMcpKey(id: string): Promise<void> {
    const sb = await signedIn();
    if (!sb) return;
    const { error } = await sb.rpc('revoke_mcp_key', { p_id: id });
    if (error) throw new Error('Could not remove that key. Try again.');
}

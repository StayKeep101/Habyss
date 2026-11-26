import { Platform } from 'react-native';
import SharedDefaults from './SharedDefaults';
import { onAccountChange } from './account';
import { PUBLIC_MCP_URL, createMcpKey, listMcpKeys, mcpAvailable, mcpUrl, revokeMcpKey } from './mcpKeys';

/**
 * Siri, Shortcuts and the Action button act on the account without opening
 * Habyss (ios/Habyss/HabyssIntents.swift). They reach the same server as
 * Claude and ChatGPT, with a key of their own, named Siri, that shows in
 * Connected apps and can be removed there. The address with the key is kept
 * in the App Group for the intents; signed out, it is removed and they fall
 * back to the queue the app applies when it next opens.
 */
export const SIRI_LABEL = 'Siri';
const URL_KEY = 'siri_mcp_url';
const ID_KEY = 'siri_mcp_key_id';

let running: Promise<void> | null = null;

async function forget(): Promise<void> {
    await SharedDefaults.remove(URL_KEY).catch(() => false);
    await SharedDefaults.remove(ID_KEY).catch(() => false);
}

async function ensure(): Promise<void> {
    if (!(await mcpAvailable())) return forget();
    const keys = await listMcpKeys();
    const storedId = await SharedDefaults.get(ID_KEY).catch(() => null);
    const storedUrl = await SharedDefaults.get(URL_KEY).catch(() => null);
    if (storedId && storedUrl && keys.some(key => key.id === storedId)) return;
    // A Siri key whose address this phone no longer has (a reinstall) is useless: removed, not piled up.
    for (const key of keys.filter(key => key.label === SIRI_LABEL)) await revokeMcpKey(key.id).catch(() => undefined);
    const secret = await createMcpKey(SIRI_LABEL);
    const made = (await listMcpKeys()).find(key => key.label === SIRI_LABEL);
    await SharedDefaults.set(URL_KEY, PUBLIC_MCP_URL ? `${PUBLIC_MCP_URL}/${secret}` : mcpUrl(secret));
    if (made) await SharedDefaults.set(ID_KEY, made.id);
}

/** Gives Siri its key when signed in (once), and takes it away when signed out. Never throws. */
export function ensureSiriAccess(): Promise<void> {
    if (Platform.OS !== 'ios') return Promise.resolve();
    running ??= ensure().catch(error => console.warn('[Siri] access not set up:', error)).finally(() => { running = null; });
    return running;
}

/** Keeps Siri's access in step with the account for as long as the app runs. */
export function startSiriAccess(): () => void {
    void ensureSiriAccess();
    return onAccountChange(() => void ensureSiriAccess());
}

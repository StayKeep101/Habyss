/**
 * Searching the settings: type what you want to change, see exactly that.
 *
 * The Settings page filters its own rows (components/ui/SettingsList.tsx
 * reads the words typed). What lives one page deeper is listed here, with
 * the page it is on, so a search finds "Face ID" or "Theme" without knowing
 * which page holds it. Each entry has the words people might use for it.
 */

/** Lower case, no accents, no punctuation: "Face ID" and "face-id" read the same. */
const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Every word typed appears somewhere in these texts (as the start of a word, so "noti" finds Notifications). */
export function matchesSearch(query: string, ...texts: (string | undefined)[]): boolean {
    const words = fold(query).split(' ').filter(Boolean);
    if (!words.length) return true;
    const haystack = ` ${fold(texts.filter(Boolean).join(' '))}`;
    return words.every(word => haystack.includes(` ${word}`));
}

export interface SettingEntry { label: string; page: string; route: string; icon: string; keywords?: string }

export const DEEP_SETTINGS: SettingEntry[] = [
    { label: 'Theme', page: 'Appearance', route: '/(root)/appearance', icon: 'color-palette', keywords: 'dark light mode colour color accent look' },
    { label: 'Cards', page: 'Appearance', route: '/(root)/appearance', icon: 'albums', keywords: 'style look' },
    { label: 'Sound', page: 'Appearance', route: '/(root)/appearance', icon: 'volume-high', keywords: 'audio mute' },
    { label: 'Vibration', page: 'Appearance', route: '/(root)/appearance', icon: 'phone-portrait', keywords: 'haptics' },
    { label: 'Morning alarm', page: 'Notifications', route: '/(root)/notifications', icon: 'alarm', keywords: 'wake up echo' },
    { label: 'Morning check-in', page: 'Notifications', route: '/(root)/notifications', icon: 'sunny', keywords: 'nudge echo' },
    { label: 'Halfway recap', page: 'Notifications', route: '/(root)/notifications', icon: 'hourglass', keywords: 'midday half day recap summary analytics progress' },
    { label: 'Before bed', page: 'Notifications', route: '/(root)/notifications', icon: 'moon', keywords: 'evening night nudge echo' },
    { label: 'Weekly review', page: 'Notifications', route: '/(root)/notifications', icon: 'calendar', keywords: 'week reminder' },
    { label: 'Call me by name', page: 'Echo', route: '/(root)/ai-settings', icon: 'person', keywords: 'name' },
    { label: 'Echo writes reminders', page: 'Echo', route: '/(root)/ai-settings', icon: 'create', keywords: 'ai text' },
    { label: 'Echo’s voice', page: 'Echo', route: '/(root)/ai-settings', icon: 'chatbubble-ellipses', keywords: 'personality tone friendly bully dad' },
    { label: 'What Echo remembers', page: 'Echo', route: '/(root)/ai-settings', icon: 'library', keywords: 'memory forget' },
    { label: 'On-device model', page: 'Echo', route: '/(root)/ai-settings', icon: 'hardware-chip', keywords: 'ai download remove llm' },
    { label: 'Community', page: 'Notifications', route: '/(root)/notifications', icon: 'people', keywords: 'friend requests nudges reactions comments challenges push inbox' },
    { label: 'Wake up time', page: 'Day & calendar', route: '/(root)/meals', icon: 'sunny', keywords: 'morning day start' },
    { label: 'Bedtime', page: 'Day & calendar', route: '/(root)/meals', icon: 'moon', keywords: 'sleep night day end quiet hours do not disturb silent' },
    { label: 'Use my calendar', page: 'Day & calendar', route: '/(root)/meals', icon: 'calendar', keywords: 'events google apple' },
    { label: 'Auto-reschedule', page: 'Day & calendar', route: '/(root)/meals', icon: 'shuffle', keywords: 'move plan timeline' },
    { label: 'Week starts', page: 'Day & calendar', route: '/(root)/meals', icon: 'calendar', keywords: 'monday sunday' },
    { label: 'Clock style', page: 'Focus', route: '/(root)/focus-settings', icon: 'timer', keywords: 'ring digital timer' },
    { label: 'Block apps while focusing', page: 'Focus', route: '/(root)/focus-settings', icon: 'hand-left', keywords: 'screen time' },
    { label: 'Add apps', page: 'App blocking', route: '/(root)/app-blocking', icon: 'add-circle', keywords: 'screen time choose block apps' },
    { label: 'Remove apps', page: 'App blocking', route: '/(root)/app-blocking', icon: 'remove-circle', keywords: 'unblock' },
    { label: '1 hour of your apps', page: 'App blocking', route: '/(root)/app-blocking', icon: 'diamond', keywords: 'shards unlock earn your scroll gate' },
    { label: 'Block every app', page: 'App blocking', route: '/(root)/app-blocking', icon: 'moon', keywords: 'bedtime night sleep block asleep' },
    { label: 'Meals', page: 'Day & calendar', route: '/(root)/meals', icon: 'restaurant', keywords: 'lunch dinner breakfast flexible food' },
    { label: 'Apple & Google Calendar', page: 'Connected apps', route: '/(root)/integrations', icon: 'calendar', keywords: 'integrations sync' },
    { label: 'Sleep from Apple Health', page: 'Connected apps', route: '/(root)/integrations', icon: 'heart', keywords: 'healthkit integrations' },
    { label: 'AI assistants (MCP)', page: 'Connected apps', route: '/(root)/integrations', icon: 'key', keywords: 'claude chatgpt api key' },
    { label: 'Siri & Shortcuts', page: 'Connected apps', route: '/(root)/integrations', icon: 'mic', keywords: 'voice automation' },
    { label: 'Face ID lock', page: 'Privacy & security', route: '/(root)/privacy', icon: 'scan', keywords: 'touch id passcode biometric lock' },
    { label: 'Post my day to the feed', page: 'Friends & sharing', route: '/(root)/sharing', icon: 'megaphone', keywords: 'daily post community' },
    { label: 'Friends see', page: 'Friends & sharing', route: '/(root)/sharing', icon: 'eye', keywords: 'privacy visible share progress' },
    { label: 'Blocked people', page: 'Friends & sharing', route: '/(root)/sharing', icon: 'ban', keywords: 'block' },
    { label: 'Sign out', page: 'Privacy & security', route: '/(root)/privacy', icon: 'log-out', keywords: 'logout account' },
    { label: 'Backup', page: 'Privacy & security', route: '/(root)/privacy', icon: 'cloud-upload', keywords: 'sync restore cloud' },
    { label: 'Delete account', page: 'Privacy & security', route: '/(root)/privacy', icon: 'trash', keywords: 'remove erase' },
];

/** The deeper settings that match, best first: a match in the name before one only in the keywords. */
export function searchDeep(query: string): SettingEntry[] {
    if (!fold(query)) return [];
    const hits = DEEP_SETTINGS.filter(entry => matchesSearch(query, entry.label, entry.page, entry.keywords));
    return hits.sort((a, b) => Number(matchesSearch(query, b.label)) - Number(matchesSearch(query, a.label)));
}

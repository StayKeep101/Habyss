import { Share } from 'react-native';
import type { Thought } from './brainDump';

/**
 * Thoughts as text other notes apps keep the shape of: Markdown, a heading per
 * day and a bullet per thought (a thought on several lines stays one bullet).
 * Notion, Apple Notes, Obsidian and Bear read it as headings and lists.
 */
export function thoughtsAsMarkdown(thoughts: Thought[], title = 'Brain dump'): string {
    if (thoughts.length === 1) return thoughts[0].text.trim();
    const days = new Map<string, Thought[]>();
    for (const thought of [...thoughts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
        const day = new Date(thought.createdAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        days.set(day, [...(days.get(day) ?? []), thought]);
    }
    const bullet = (text: string) => `- ${text.trim().split('\n').map((line, index) => (index ? `  ${line}` : line)).join('\n')}`;
    return [`# ${title}`, ...[...days].map(([day, list]) => `## ${day}\n${list.map(item => bullet(item.text)).join('\n')}`)].join('\n\n');
}

/** Opens the share sheet with them: straight into Notion, Notes, Obsidian, Mail… */
export async function shareThoughts(thoughts: Thought[]): Promise<boolean> {
    if (!thoughts.length) return false;
    const result = await Share.share({ message: thoughtsAsMarkdown(thoughts), title: 'Brain dump' }).catch(() => null);
    return result?.action === Share.sharedAction;
}

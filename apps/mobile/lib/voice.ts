/**
 * The app's own voice for moments that come back again and again (AGENTS.md,
 * Voice): the title gets the joke, the line under it stays plain. Each picks a
 * line that is not the one it said last time, so it never repeats back to back.
 */

const OOPS = [
    'Well, that’s embarrassing',
    'That one’s on us',
    'The internet blinked',
    'Plot twist',
    'Not our finest moment',
] as const;

const PERMISSION = [
    'We need a yes first',
    'Locked door',
    'Permission, please',
] as const;

const last = new Map<readonly string[], number>();

/** A line from `lines`, never the same one twice in a row. `random` is for tests. */
export function pick(lines: readonly string[], random = Math.random): string {
    const before = last.get(lines) ?? -1;
    let index = Math.floor(random() * lines.length);
    if (lines.length > 1 && index === before) index = (index + 1) % lines.length;
    last.set(lines, index);
    return lines[index];
}

/** Title for "something didn't save / didn't go through". The message says what to do. */
export const oopsTitle = (): string => pick(OOPS);

/** Title for "iOS needs a permission first". The message says where to allow it. */
export const permissionTitle = (): string => pick(PERMISSION);

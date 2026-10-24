/**
 * Keeps slurs out of what other people see.
 *
 * Apple asks apps that show what users write to filter objectionable material
 * as well as offer report and block. What one person writes that others can
 * read in Habyss is their name, @username, bio and the names of the habits
 * and tasks on their day card. This catches slurs and hate terms in them,
 * including common disguises (l33t letters, dots or dashes between letters);
 * it is not a swear filter, since swearing at yourself in a habit name is
 * nobody else's business.
 *
 * Saving a profile field with one is refused (`isObjectionable`); a day card
 * from somebody else shows the word masked (`maskObjectionable`).
 */

// Stored reversed, so the list is not a page of slurs to whoever opens the file.
const REVERSED = [
    'reggin', 'aggin', 'raggin', 'rekkin', 'toggaf', 'ggaf', 'cips', 'kips', 'knihc', 'koog',
    'ekik', 'kcabtew', 'ekyd', 'ynnart', 'drater', 'nooc', 'renaeb', 'daehlewot', 'daehgar', 'ikap',
].map(word => [...word].reverse().join(''));

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't' };

/** Lower case, l33t undone, accents dropped. */
function normal(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[0-9!@$]/g, c => LEET[c] ?? c);
}

const TERMS = REVERSED.map(normal);
/** One term, allowing a dot, dash, star or underscore between letters, and a plural. */
const pattern = (term: string) =>
    new RegExp(`(^|[^a-z])(${[...term].map(c => (c === ' ' ? '\\W*' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[.*_\\-]*')).join('')}(?:e?s)?)(?=$|[^a-z])`, 'gi');
const PATTERNS = TERMS.map(pattern);

/** Whether this has a slur in it. */
export function isObjectionable(text: string | null | undefined): boolean {
    if (!text) return false;
    const plain = normal(text);
    return PATTERNS.some(re => { re.lastIndex = 0; return re.test(plain); });
}

/**
 * The same text with any slur replaced by dots, the rest untouched. Positions
 * line up because normalising keeps one character per character (accents
 * aside, which only drop marks).
 */
export function maskObjectionable(text: string): string {
    if (!isObjectionable(text)) return text;
    const plain = normal(text);
    const chars = [...text];
    if (plain.length !== text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').length) return '•••';
    for (const re of PATTERNS) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(plain))) {
            const start = match.index + match[1].length;
            for (let i = start; i < start + match[2].length; i++) chars[i] = '•';
        }
    }
    return chars.join('');
}

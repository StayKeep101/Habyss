/**
 * Prints Echo's lines for the blind test (docs/echo-blind-test.md):
 *   npm run echo:sample            (Normal voice)
 *   ECHO_VOICE=bully_mode npm run echo:sample
 * Run through Jest only so the app's path aliases resolve; it asserts nothing.
 */
import { sampleLines } from '../lib/echoBlindTest';

it('prints the blind-test sheet', () => {
    const voice = (process.env.ECHO_VOICE ?? 'normal') as Parameters<typeof sampleLines>[0];
    const rows = sampleLines(voice);
    const sheet = [`# Echo blind test (${voice})`, '', '## Situations (give these to the human coach)', '',
        ...rows.map((row, index) => `${index + 1}. ${row.plainly}`), '', '## Echo’s lines', '',
        ...rows.map((row, index) => `${index + 1}. ${row.line}`)].join('\n');
    // eslint-disable-next-line no-console
    console.log(sheet);
});

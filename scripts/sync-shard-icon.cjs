#!/usr/bin/env node
/**
 * The Shard icon has one source: assets/shard.svg. Replace that file with a
 * new design and run `npm run shard:sync`; every Shard in the app (flying,
 * on Home, the wallet, bets, duels, receipts) and the iOS Shards widget take
 * it from there:
 *   - theme/shardArt.ts                          (the app: ShardIcon draws it)
 *   - ios/Widget/Assets.xcassets/Shard.imageset  (the widget, as a vector image)
 *
 * `node scripts/sync-shard-icon.cjs --check` (run by `npm run check:ui`) fails
 * when either copy is out of date, so a stale Shard never ships.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'assets/shard.svg');
const artFile = path.join(root, 'theme/shardArt.ts');
const imageset = path.join(root, 'ios/Widget/Assets.xcassets/Shard.imageset');
const widgetSvg = path.join(imageset, 'shard.svg');
const contents = path.join(imageset, 'Contents.json');

const svg = fs.readFileSync(source, 'utf8').trim();
if (!/^<svg[\s>]/.test(svg) || /<script|javascript:|href\s*=\s*["']https?:/i.test(svg)) {
    console.error('assets/shard.svg must be a plain, self-contained SVG (no scripts, no outside links).');
    process.exit(1);
}

const art = `/**
 * The Shard artwork, generated from assets/shard.svg by scripts/sync-shard-icon.cjs.
 * Do not edit by hand: replace assets/shard.svg and run \`npm run shard:sync\`.
 */
export const SHARD_SVG = ${JSON.stringify(svg)};
`;
const contentsJson = JSON.stringify({
    images: [{ filename: 'shard.svg', idiom: 'universal' }],
    info: { author: 'xcode', version: 1 },
    properties: { 'preserves-vector-representation': true },
}, null, 2) + '\n';

const want = [[artFile, art], [widgetSvg, svg + '\n'], [contents, contentsJson]];

if (process.argv.includes('--check')) {
    const stale = want.filter(([file, text]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text);
    if (stale.length) {
        console.error(`Shard icon out of date: ${stale.map(([file]) => path.relative(root, file)).join(', ')}. Run npm run shard:sync.`);
        process.exit(1);
    }
    console.log('Shard icon in sync.');
    process.exit(0);
}

fs.mkdirSync(imageset, { recursive: true });
for (const [file, text] of want) fs.writeFileSync(file, text);
console.log('Shard icon synced: theme/shardArt.ts and the widget asset.');

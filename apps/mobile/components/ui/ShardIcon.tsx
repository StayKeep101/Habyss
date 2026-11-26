import React, { useId, useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { SHARD_SVG } from '@/theme/shardArt';

/** Below this the facets blur into a blob, so it is never drawn smaller. */
const SMALLEST = 14;

/**
 * A Shard: Habyss's currency, drawn as its own crystal. Used wherever Shards
 * are counted, earned, bet or spent (and flying, lib/marksOrbs.ts), so the
 * Shard is one object everywhere.
 *
 * Its look has one source: assets/shard.svg. Replace that file and run
 * `npm run shard:sync`: this component and the iOS Shards widget both take
 * the new design (scripts/sync-shard-icon.cjs), and `npm run check:ui` fails
 * if either is left behind.
 *
 * Decorative by default (the number beside it says what it is); give it an
 * `accessibilityLabel` when it stands alone.
 */
export function ShardIcon({ size: asked = 16, accessibilityLabel }: { size?: number; accessibilityLabel?: string }) {
    const size = Math.max(SMALLEST, asked);
    // Each copy names its gradients apart, so two Shards on one screen never borrow each other's.
    const suffix = useId().replace(/[^a-zA-Z0-9]/g, '');
    const xml = useMemo(() => uniqueIds(SHARD_SVG, suffix), [suffix]);
    return (
        <SvgXml xml={xml} width={size} height={size}
            accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityLabel ? 'image' : undefined} />
    );
}

/** Every id in the artwork, and every reference to it, with a suffix. */
export function uniqueIds(svg: string, suffix: string): string {
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    return ids.reduce((text, id) => text
        .split(`id="${id}"`).join(`id="${id}${suffix}"`)
        .split(`url(#${id})`).join(`url(#${id}${suffix})`)
        .split(`href="#${id}"`).join(`href="#${id}${suffix}"`), svg);
}

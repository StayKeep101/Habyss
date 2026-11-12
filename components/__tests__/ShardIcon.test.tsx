import { uniqueIds } from '../ui/ShardIcon';
import { SHARD_SVG } from '../../theme/shardArt';

describe('the Shard icon', () => {
    it('draws the artwork from assets/shard.svg', () => {
        expect(SHARD_SVG.startsWith('<svg')).toBe(true);
    });
    it('names each copy’s gradients apart, references included', () => {
        const xml = uniqueIds(SHARD_SVG, 'x1');
        expect(xml).toContain('id="bodyx1"');
        expect(xml).toContain('url(#bodyx1)');
        expect(xml).not.toMatch(/url\(#body\)/);
    });
});

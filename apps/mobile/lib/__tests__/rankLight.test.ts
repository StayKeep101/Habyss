import { glassDesign } from '@/theme/hourglassDesigns';
import { RANKS } from '@/lib/marks';
it('every rank light is #rrggbb', () => {
    for (const rank of [...RANKS.map(r => r.name), null]) expect(glassDesign(rank).sand[0]).toMatch(/^#[0-9a-fA-F]{6}$/);
});

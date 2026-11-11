import { RANK_ORDER, rankGradient } from '../../theme/rankLooks';
import { RANKS } from '../marks';
import { contrastRatio, mixHex } from '../colorContrast';

describe('the app dressed for each rank', () => {
    it('has a look for every rank, in climbing order', () => {
        expect(RANK_ORDER).toEqual(RANKS.map(rank => rank.name));
        for (const name of RANK_ORDER) expect(rankGradient(name)).toHaveLength(2);
    });
    it('gives every rank its own colour', () => {
        const solids = RANK_ORDER.map(name => mixHex(...rankGradient(name)));
        expect(new Set(solids).size).toBe(RANK_ORDER.length);
    });
    it('keeps every accent visible on the dark page (3:1 for icons and rings)', () => {
        for (const name of RANK_ORDER) expect(contrastRatio(mixHex(...rankGradient(name)), '#000000')).toBeGreaterThanOrEqual(3);
    });
    it('reads an unknown rank as Lost', () => {
        expect(rankGradient('Nobody')).toEqual(rankGradient('Lost'));
    });
});

describe('previewing a rank', () => {
    it('is for this session only and leaves your rank alone', () => {
        jest.isolateModules(() => {
            jest.doMock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
            const look = require('../rankLook') as typeof import('../rankLook');
            look.setRankLook('Growing');
            look.previewRankLook('Master');
            expect(look.currentRankLook()).toEqual({ rank: 'Growing', preview: 'Master' });
            look.previewRankLook(null);
            expect(look.currentRankLook()).toEqual({ rank: 'Growing', preview: null });
        });
    });
});

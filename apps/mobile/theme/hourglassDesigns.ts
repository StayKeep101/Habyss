import { Colors, EternalIridescence, RankColors } from '@/theme/colors';
import { mixHex } from '@/lib/colorContrast';
import type { RankLookName } from '@/theme/rankLooks';

/**
 * Each rank's hourglass (components/Home/DayHourglass.tsx). Placeholders:
 * the shapes and colours are a first pass, meant to be redrawn rank by rank.
 * Everything a design is made of lives here, so changing one rank's glass is
 * one entry, nothing else.
 *
 * - frame: the wood or metal of the stands and caps.
 * - sand: [top of the pile, deep in it].
 * - rings: bands turned into each pillar (0 plain, up to 3 ornate).
 * - finials: knobs on the caps' corners.
 * - glow: light from the glass, 0 none to 1 radiant.
 */
export interface GlassDesign {
    frame: string;
    frameLight: string;
    sand: [string, string];
    rings: 0 | 1 | 2 | 3;
    finials: boolean;
    glow: number;
}

const white = Colors.common.white;
const sandOf = (rank: RankLookName): [string, string] => {
    if (rank === 'Eternal') return [EternalIridescence[1], EternalIridescence[2]];
    const gem = RankColors[rank];
    return [mixHex(gem, white, 0.25), gem];
};

// Driftwood grey at the bottom of the abyss, through bronze and steel, to gold and light.
const WOOD = '#4A4038';
const BRONZE = '#8C6239';
const STEEL = '#7D8794';
const GOLD = '#C9A227';
const PEARL = '#E8E4F0';

export const GLASS_DESIGNS: Record<RankLookName, GlassDesign> = {
    Lost:        { frame: WOOD,   frameLight: mixHex(WOOD, white, 0.2),   sand: sandOf('Lost'),        rings: 0, finials: false, glow: 0 },
    Beginner:    { frame: WOOD,   frameLight: mixHex(WOOD, white, 0.25),  sand: sandOf('Beginner'),    rings: 1, finials: false, glow: 0.1 },
    Growing:     { frame: BRONZE, frameLight: mixHex(BRONZE, white, 0.3), sand: sandOf('Growing'),     rings: 1, finials: false, glow: 0.15 },
    Consistent:  { frame: BRONZE, frameLight: mixHex(BRONZE, white, 0.3), sand: sandOf('Consistent'),  rings: 2, finials: false, glow: 0.2 },
    Disciplined: { frame: STEEL,  frameLight: mixHex(STEEL, white, 0.35), sand: sandOf('Disciplined'), rings: 2, finials: true,  glow: 0.3 },
    Focused:     { frame: STEEL,  frameLight: mixHex(STEEL, white, 0.35), sand: sandOf('Focused'),     rings: 2, finials: true,  glow: 0.4 },
    Master:      { frame: GOLD,   frameLight: mixHex(GOLD, white, 0.35),  sand: sandOf('Master'),      rings: 3, finials: true,  glow: 0.5 },
    Unbreakable: { frame: GOLD,   frameLight: mixHex(GOLD, white, 0.35),  sand: sandOf('Unbreakable'), rings: 3, finials: true,  glow: 0.65 },
    Timekeeper:  { frame: GOLD,   frameLight: mixHex(GOLD, white, 0.5),   sand: sandOf('Timekeeper'),  rings: 3, finials: true,  glow: 0.8 },
    Eternal:     { frame: PEARL,  frameLight: white,                      sand: sandOf('Eternal'),     rings: 3, finials: true,  glow: 1 },
};

export const glassDesign = (rank: string | null | undefined): GlassDesign =>
    GLASS_DESIGNS[(rank ?? 'Lost') as RankLookName] ?? GLASS_DESIGNS.Lost;

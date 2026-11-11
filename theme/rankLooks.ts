import { Colors, EternalIridescence, RankColors } from '@/theme/colors';
import { mixHex } from '@/lib/colorContrast';

/**
 * The app's look at each rank: as you climb out of the abyss, its colour
 * climbs with you — slate when Lost, through indigo and blue, cyan and
 * emerald, to amber and orange, pale gold, and Eternal's split white light.
 *
 * Each is a two-stop gradient made from the rank's own gem colour (the same
 * colour its gem and its rank line already wear), so nothing new is invented:
 * the deep end is the gem colour, the light end the same colour lifted
 * towards white. Eternal takes its iridescence.
 */
export type RankLookName = keyof typeof RankColors;

export const RANK_ORDER: RankLookName[] = ['Lost', 'Beginner', 'Growing', 'Consistent', 'Disciplined', 'Focused', 'Master', 'Unbreakable', 'Timekeeper', 'Eternal'];

export function rankGradient(name: string): [string, string] {
    if (name === 'Eternal') return [EternalIridescence[1], EternalIridescence[2]];
    const gem = RankColors[name as RankLookName] ?? RankColors.Lost;
    // Lost's slate is lifted: still colourless, but bright enough that a chosen
    // tab or chip stands apart from the grey around it.
    const base = name === 'Lost' || !(name in RankColors) ? mixHex(gem, Colors.common.white, 0.35) : gem;
    return [base, mixHex(base, Colors.common.white, 0.3)];
}

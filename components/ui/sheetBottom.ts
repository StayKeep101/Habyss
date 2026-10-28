/**
 * The room under the last button of anything that rises from the bottom (a
 * sheet, a popup card): the home indicator's gap where the phone has one, and
 * never less than a thumb's margin where it does not (a phone with a Home
 * button reports no gap, which left Done eight points from the edge).
 */
export const sheetBottom = (inset: number): number => Math.max(inset, 16) + 8;

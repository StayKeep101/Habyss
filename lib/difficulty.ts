/** How hard something is, as the sheets offer it. 1 easy … 3 hard; unset reads as medium. */
export type Difficulty = 1 | 2 | 3;
export const DIFFICULTIES: { id: Difficulty; label: string }[] = [
    { id: 1, label: 'Easy' },
    { id: 2, label: 'Medium' },
    { id: 3, label: 'Hard' },
];
/** The chip's text: nothing for medium (the default), else Easy or Hard. */
export const difficultyLabel = (value?: Difficulty) => !value || value === 2 ? undefined : DIFFICULTIES.find(item => item.id === value)?.label;

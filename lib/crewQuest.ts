/**
 * The weekly crew quest (20261028000500): you and your friends, a shared
 * number of show-ups by Sunday. A show-up is a habit or task done, at most
 * three a day per person. The target is ten for each person around (anyone
 * who wrote a card in the last two weeks), so a quiet friend never makes it
 * out of reach; reaching it is a crew trophy, missing it costs nothing.
 */

export interface CrewMember { userId: string; name: string; avatarUrl?: string; showUps: number; active: boolean; mine: boolean }

/** Show-ups each person around adds to the week's target. */
export const PER_PERSON = 10;

/** The week holding `today`, Monday or Sunday first, as YYYY-MM-DD. */
export function questWeek(today: string, mondayFirst: boolean): { from: string; to: string } {
    const date = new Date(`${today}T12:00:00`);
    const back = mondayFirst ? (date.getDay() + 6) % 7 : date.getDay();
    const start = new Date(date); start.setDate(date.getDate() - back);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: key(start), to: key(end) };
}

/** Where the crew stands: done, the target, and who brought what (most first). */
export function questStanding(members: CrewMember[]): { done: number; target: number; reached: boolean; crew: CrewMember[] } {
    const around = members.filter(member => member.active || member.mine || member.showUps > 0);
    const target = Math.max(PER_PERSON, around.length * PER_PERSON);
    const done = around.reduce((sum, member) => sum + member.showUps, 0);
    const crew = [...around].sort((a, b) => b.showUps - a.showUps || Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
    return { done, target, reached: done >= target, crew };
}

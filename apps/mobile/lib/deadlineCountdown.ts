/** Date-only goals end at local midnight after the deadline day (DST-safe). */
export function deadlineInstant(value: string): number {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const end = new Date(`${value}T00:00:00`);
        end.setDate(end.getDate() + 1);
        return end.getTime();
    }
    return new Date(value).getTime();
}

export function deadlineCountdown(value: string, now = Date.now()): string {
    const end = deadlineInstant(value);
    if (!Number.isFinite(end)) return 'No deadline';
    const seconds = Math.max(0, Math.ceil((end - now) / 1000));
    if (!seconds) return 'Deadline reached';
    return `${Math.floor(seconds / 86400)}d ${Math.floor(seconds / 3600) % 24}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s left`;
}

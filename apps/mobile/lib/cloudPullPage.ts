/** Stable paging: equal timestamps are ordered by id, without growing OFFSET scans. */
export interface PullPosition { updated_at: string; id: string }
export function cloudPullPage(sb: any, table: string, userId: string, since: string | null, after: PullPosition | null, limit: number) {
    let query = sb.from(table).select('*').eq('user_id', userId)
        .order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
    if (since) query = query.gte('updated_at', since);
    if (after) query = query.or(`updated_at.gt.${after.updated_at},and(updated_at.eq.${after.updated_at},id.gt.${after.id})`);
    return query;
}

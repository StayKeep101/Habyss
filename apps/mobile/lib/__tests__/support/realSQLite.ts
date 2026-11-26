interface SQLiteTestAdapter {
    raw: any;
    failSQL: string;
    execAsync(sql: string): Promise<void>;
    getAllAsync(sql: string, ...params: any[]): Promise<any[]>;
    getFirstAsync(sql: string, ...params: any[]): Promise<any>;
    runAsync(sql: string, ...params: any[]): Promise<{ changes: number; lastInsertRowId: number }>;
    closeAsync(): Promise<void>;
    withTransactionAsync(work: () => Promise<void>): Promise<void>;
    withExclusiveTransactionAsync(work: (tx: SQLiteTestAdapter) => Promise<void>): Promise<void>;
}

/** Real SQLite for integration tests; only the Expo transport is replaced. */
export function sqliteAdapter(path: string) {
    const { DatabaseSync } = (process as any).getBuiltinModule('node:sqlite');
    const raw = new DatabaseSync(path);
    let writes = Promise.resolve();
    const adapter: SQLiteTestAdapter = {
        raw,
        failSQL: '' as string,
        async execAsync(sql: string) { raw.exec(sql); },
        async getAllAsync(sql: string, ...params: any[]) { return raw.prepare(sql).all(...params); },
        async getFirstAsync(sql: string, ...params: any[]) { return raw.prepare(sql).get(...params) ?? null; },
        async runAsync(sql: string, ...params: any[]) {
            if (adapter.failSQL && sql.includes(adapter.failSQL)) throw new Error('Simulated disk full');
            const result = raw.prepare(sql).run(...params);
            return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
        },
        async closeAsync() { raw.close(); },
        withTransactionAsync(work: () => Promise<void>): Promise<void> {
            return adapter.withExclusiveTransactionAsync(() => work());
        },
        withExclusiveTransactionAsync(work: (tx: SQLiteTestAdapter) => Promise<void>): Promise<void> {
            const next = writes.catch(() => undefined).then(async () => {
                raw.exec('BEGIN IMMEDIATE');
                try { await work(adapter); raw.exec('COMMIT'); }
                catch (error) { raw.exec('ROLLBACK'); throw error; }
            });
            writes = next;
            return next;
        },
    };
    return adapter;
}

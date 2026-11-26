import { closeDatabase, getDatabase } from '../database';
const mockOpen = jest.fn();
/** Kept in step with SCHEMA_VERSION in lib/database.ts. */
const CURRENT_SCHEMA = 12;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpen(...args) }));


const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
};
const connection = () => ({
    execAsync: jest.fn(async () => undefined),
    // Already at the newest schema, so no migration runs. getAllAsync is here
    // anyway: a migration that reads PRAGMA table_info would otherwise make
    // this fixture fail on the next schema bump rather than on a real defect.
    getFirstAsync: jest.fn(async () => ({ version: CURRENT_SCHEMA })),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => undefined),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => { await work(); }),
    closeAsync: jest.fn(async () => undefined),
});
afterEach(async () => { await closeDatabase(); jest.clearAllMocks(); });

it('keeps every startup reader waiting until initialization finishes', async () => {
    const db = connection();
    const entered = deferred();
    const release = deferred();
    db.execAsync.mockImplementationOnce(async () => { entered.resolve(); await release.promise; });
    mockOpen.mockResolvedValue(db);
    const first = getDatabase();
    await entered.promise;
    let ready = 0;
    const others = Array.from({ length: 100 }, () => getDatabase().then(value => { ready++; return value; }));
    await Promise.resolve();
    expect(ready).toBe(0);
    release.resolve();
    const results = await Promise.all([first, ...others]);
    expect(results.every(result => result === db)).toBe(true);
    expect(mockOpen).toHaveBeenCalledTimes(1);
});

it('closes a failed initialization and successfully retries', async () => {
    const broken = connection();
    broken.execAsync.mockRejectedValueOnce(new Error('Disk unavailable'));
    const healthy = connection();
    mockOpen.mockResolvedValueOnce(broken).mockResolvedValueOnce(healthy);
    expect(await getDatabase()).toBeNull();
    expect(broken.closeAsync).toHaveBeenCalledTimes(1);
    expect(await getDatabase()).toBe(healthy);
});

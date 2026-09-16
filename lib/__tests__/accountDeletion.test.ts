import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { deleteAllLocalData } from '../accountDeletion';
import { closeDatabase } from '../database';
import { SecureTokenService } from '../secureStorage';
import SharedDefaults from '../SharedDefaults';

jest.mock('expo-sqlite', () => ({ deleteDatabaseAsync: jest.fn(async () => undefined) }));
jest.mock('../database', () => ({ closeDatabase: jest.fn(async () => undefined) }));
jest.mock('../secureStorage', () => ({
    SecureTokenService: { clearServiceTokens: jest.fn(async () => undefined) },
}));
jest.mock('../SharedDefaults', () => ({
    __esModule: true,
    default: { remove: jest.fn(async () => true), reloadTimelines: jest.fn(async () => true) },
}));
jest.mock('../RevenueCat', () => ({ __esModule: true, default: { logOut: jest.fn(async () => undefined) } }));
jest.mock('../LocalLLMService', () => ({ __esModule: true, default: { deleteModel: jest.fn(async () => undefined) } }));

const STEP_KEYS = ['purchases', 'aiModel', 'shared', 'database', 'tokens', 'settings'];

describe('deleteAllLocalData', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('clears every local store', async () => {
        const report = await deleteAllLocalData();

        expect(report.ok).toBe(true);
        expect(report.failed).toEqual([]);
        expect(report.steps.map(step => step.key)).toEqual(STEP_KEYS);

        expect(closeDatabase).toHaveBeenCalled();
        expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledWith('habyss.db');
        expect(AsyncStorage.clear).toHaveBeenCalled();
        expect(SecureTokenService.clearServiceTokens).toHaveBeenCalledTimes(4);
        expect(SharedDefaults.remove).toHaveBeenCalledTimes(5);
    });

    it('closes the database before deleting it', async () => {
        const order: string[] = [];
        (closeDatabase as jest.Mock).mockImplementation(async () => { order.push('close'); });
        (SQLite.deleteDatabaseAsync as jest.Mock).mockImplementation(async () => { order.push('delete'); });

        await deleteAllLocalData();

        // Deleting a database that is still open fails on iOS.
        expect(order).toEqual(['close', 'delete']);
    });

    it('clears settings last, since earlier steps read from them', async () => {
        const order: string[] = [];
        (SQLite.deleteDatabaseAsync as jest.Mock).mockImplementation(async () => { order.push('database'); });
        (AsyncStorage.clear as jest.Mock).mockImplementation(async () => { order.push('settings'); });

        await deleteAllLocalData();

        expect(order).toEqual(['database', 'settings']);
    });

    it('keeps going when a step fails and reports which one', async () => {
        (SQLite.deleteDatabaseAsync as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));

        const report = await deleteAllLocalData();

        expect(report.ok).toBe(false);
        expect(report.failed).toHaveLength(1);
        expect(report.failed[0].key).toBe('database');
        expect(report.failed[0].detail).toContain('database is locked');

        // The remaining stores are still cleared rather than left behind.
        expect(AsyncStorage.clear).toHaveBeenCalled();
        expect(SecureTokenService.clearServiceTokens).toHaveBeenCalled();
        expect(report.steps).toHaveLength(STEP_KEYS.length);
    });

    it('still deletes user data when optional cleanup is unavailable', async () => {
        const RevenueCat = require('../RevenueCat').default;
        const LocalLLM = require('../LocalLLMService').default;
        RevenueCat.logOut.mockRejectedValueOnce(new Error('not configured'));
        LocalLLM.deleteModel.mockRejectedValueOnce(new Error('no model'));

        const report = await deleteAllLocalData();

        expect(report.failed.map(step => step.key)).toEqual(['purchases', 'aiModel']);
        expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledWith('habyss.db');
        expect(AsyncStorage.clear).toHaveBeenCalled();
    });
});

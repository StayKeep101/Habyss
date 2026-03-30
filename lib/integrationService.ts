/**
 * Integration Service — Local Stub
 * Full implementation moved to _premium/integrationService.ts
 * This stub prevents import errors in free tier.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Integration {
    id: string;
    service_name: string;
    is_connected: boolean;
    last_sync?: string;
    sync_status?: string;
    config?: any;
}

const STORAGE_KEY = 'local_integrations';

async function readIntegrations(): Promise<Integration[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeIntegrations(integrations: Integration[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(integrations));
}

export class IntegrationService {
    static async getIntegrations(): Promise<Integration[]> {
        return readIntegrations();
    }

    static async connectService(serviceName: string, config?: any): Promise<boolean> {
        const integrations = await readIntegrations();
        const existingIndex = integrations.findIndex((integration) => integration.service_name === serviceName);
        const nextIntegration: Integration = {
            id: existingIndex >= 0 ? integrations[existingIndex].id : serviceName,
            service_name: serviceName,
            is_connected: true,
            last_sync: new Date().toISOString(),
            sync_status: 'idle',
            config,
        };

        if (existingIndex >= 0) {
            integrations[existingIndex] = nextIntegration;
        } else {
            integrations.push(nextIntegration);
        }

        await writeIntegrations(integrations);
        return true;
    }

    static async disconnectService(id: string): Promise<boolean> {
        const integrations = await readIntegrations();
        const nextIntegrations = integrations.map((integration) =>
            integration.service_name === id
                ? {
                    ...integration,
                    is_connected: false,
                    last_sync: undefined,
                    sync_status: 'idle',
                }
                : integration
        );

        await writeIntegrations(nextIntegrations);
        return true;
    }

    static async updateIntegration(id: string, updates: Partial<Integration>): Promise<void> {
        const integrations = await readIntegrations();
        const nextIntegrations = integrations.map((integration) =>
            integration.id === id || integration.service_name === id
                ? { ...integration, ...updates }
                : integration
        );

        await writeIntegrations(nextIntegrations);
    }

    static async getIntegration(serviceName: string): Promise<Integration | null> {
        const integrations = await readIntegrations();
        return integrations.find((integration) => integration.service_name === serviceName) || null;
    }

    static async recordActivity(_service: string, _type: string, _data?: any): Promise<void> {
        // No-op in local mode — activity recording requires premium
    }

    static async withRetry<T>(fn: () => Promise<T>, _retries: number = 3): Promise<T> {
        // Simply execute the function without retry logic in local mode
        return fn();
    }
}

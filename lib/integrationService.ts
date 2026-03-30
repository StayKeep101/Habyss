/**
 * Integration Service — Local Stub
 * Full implementation moved to _premium/integrationService.ts
 * This stub prevents import errors in free tier.
 */

export interface Integration {
    id: string;
    service_name: string;
    is_connected: boolean;
    last_sync?: string;
    sync_status?: string;
    config?: any;
}

export class IntegrationService {
    static async getIntegrations(): Promise<Integration[]> {
        return [];
    }

    static async connectService(_serviceName: string, _config?: any): Promise<boolean> {
        console.log('[Integration] Cloud integrations require premium');
        return false;
    }

    static async disconnectService(_id: string): Promise<boolean> {
        return true;
    }

    static async updateIntegration(_id: string, _updates: Partial<Integration>): Promise<void> {
        // No-op in local mode
    }

    static async getIntegration(_serviceName: string): Promise<Integration | null> {
        return null;
    }

    static async recordActivity(_service: string, _type: string, _data?: any): Promise<void> {
        // No-op in local mode — activity recording requires premium
    }

    static async withRetry<T>(fn: () => Promise<T>, _retries: number = 3): Promise<T> {
        // Simply execute the function without retry logic in local mode
        return fn();
    }
}
